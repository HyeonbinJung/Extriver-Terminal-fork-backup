"""종목 리서치 (EQUITY RESEARCH) API.

Fincept 데스크톱 앱의 Equity Research 화면을 웹으로 옮긴 것.
개요는 빠르게, 나머지 탭은 필요할 때(lazy) 불러오도록 엔드포인트를 나눴다.

  GET  /api/research/overview?symbol=AAPL
  GET  /api/research/chart?symbol=AAPL&period=1y
  GET  /api/research/financials?symbol=AAPL&freq=annual|quarterly
  GET  /api/research/technicals?symbol=AAPL
  GET  /api/research/dcf_prefill?symbol=AAPL
  POST /api/research/dcf
  GET  /api/research/relative?symbol=AAPL&peers=MSFT,GOOGL
  GET  /api/research/peers?symbol=AAPL&peers=MSFT,GOOGL
  GET  /api/research/analysts?symbol=AAPL
  GET  /api/research/holders?symbol=AAPL
  GET  /api/research/dividends?symbol=AAPL
  GET  /api/research/news?symbol=AAPL
"""

from __future__ import annotations

import contextlib
import io
import math
import re
import time
from concurrent.futures import ThreadPoolExecutor

import numpy as np
import pandas as pd

from api.common import (
    muted,
    BadRequest, benchmark_for, cached, check_symbol, check_symbols, clean, dates, history, info, num,
    ohlcv, profile, quiet, quote, rsi, series_stats, yf_ticker, yfd,
)


# --------------------------------------------------------------------------- #
# helpers
# --------------------------------------------------------------------------- #
def _f(v):
    """float or None (0 / NaN / garbage → None)."""
    try:
        v = float(v)
    except (TypeError, ValueError):
        return None
    if math.isnan(v) or math.isinf(v):
        return None
    return v


def _nz(v):
    v = _f(v)
    return None if v == 0 else v


def _eps(i: dict):
    """Trailing EPS; Yahoo omits it for many Korean stocks → net income ÷ shares."""
    e = _f(i.get("trailingEps"))
    if e is None and _nz(i.get("netIncomeToCommon")) and _nz(i.get("sharesOutstanding")):
        e = i["netIncomeToCommon"] / i["sharesOutstanding"]
    return e


def _pe(i: dict):
    pe = _nz(i.get("trailingPE"))
    if pe is None:
        e, px = _eps(i), _f(i.get("currentPrice")) or _f(i.get("regularMarketPrice"))
        pe = px / e if e and e > 0 and px else None
    return pe


def _evebitda(i: dict):
    # Yahoo sometimes mixes currencies (e.g. SONY: EV in USD, EBITDA in JPY) → absurdly small multiples.
    v = _nz(i.get("enterpriseToEbitda"))
    return v if v is not None and v >= 0.5 else None


def _silent(fn, default=None):
    try:
        with muted():
            return fn()
    except Exception:
        return default


def _sym(q) -> str:
    return check_symbol(q.get("symbol") or "AAPL")


def _df_records(df: pd.DataFrame | None, limit: int = 100) -> list[dict]:
    if df is None or not isinstance(df, pd.DataFrame) or df.empty:
        return []
    out = []
    for _, r in df.head(limit).iterrows():
        row = {}
        for k, v in r.items():
            if isinstance(v, pd.Timestamp):
                v = v.strftime("%Y-%m-%d")
            elif isinstance(v, (np.floating, float)):
                v = None if math.isnan(float(v)) else float(v)
            elif isinstance(v, np.integer):
                v = int(v)
            row[str(k)] = v
        out.append(row)
    return out


def _info_ok(sym: str) -> dict:
    i = _silent(lambda: info(sym), {}) or {}
    return i


# --------------------------------------------------------------------------- #
# OVERVIEW
# --------------------------------------------------------------------------- #
@cached(120)
def _overview(sym: str) -> dict:
    i = _info_ok(sym)
    q = _silent(lambda: quote(sym), {}) or {}
    if "error" in q:
        q = {}
    if not q.get("price") and not (i.get("regularMarketPrice") or i.get("currentPrice")):
        raise BadRequest(f"{sym}: 종목을 찾지 못했습니다. 코드를 확인하세요 (예: AAPL, 005930.KS).")

    try:
        df = ohlcv(sym, "1y", "1d")
    except BadRequest:
        df = None

    price = _f(q.get("price")) or _f(i.get("currentPrice")) or _f(i.get("regularMarketPrice"))
    prev = _nz(q.get("previous_close")) or _nz(i.get("regularMarketPreviousClose")) or _nz(i.get("previousClose"))
    change = _f(q.get("change"))
    chg_pct = _f(q.get("change_percent"))
    if change is None and price and prev:
        change = price - prev
        chg_pct = change / prev * 100

    hi52 = lo52 = None
    if df is not None and len(df):
        hi52, lo52 = float(df["high"].max()), float(df["low"].min())
    hi52 = hi52 or _nz(i.get("fiftyTwoWeekHigh"))
    lo52 = lo52 or _nz(i.get("fiftyTwoWeekLow"))

    # yfinance returns dividendYield in percent units (0.41 = 0.41%)
    dy = _f(i.get("dividendYield"))
    dy = dy / 100 if dy is not None else _f(i.get("trailingAnnualDividendYield"))

    risk, bench = None, benchmark_for(sym)
    if df is not None and len(df) > 30:
        close = df["close"]
        st = series_stats(close)
        beta = corr = None
        try:
            b = history(bench, "1y").pct_change()
            j = pd.concat([close.pct_change(), b], axis=1, join="inner").dropna()
            if len(j) > 20:
                cov = np.cov(j.iloc[:, 0], j.iloc[:, 1])
                beta = cov[0, 1] / cov[1, 1]
                corr = j.iloc[:, 0].corr(j.iloc[:, 1])
        except BadRequest:
            pass
        ma20, ma60 = close.rolling(20).mean().iloc[-1], close.rolling(60).mean().iloc[-1]
        risk = {**st, "beta": beta, "corr": corr, "rsi": float(rsi(close).iloc[-1]),
                "above_ma20": bool(close.iloc[-1] > ma20) if not math.isnan(ma20) else None,
                "above_ma60": bool(close.iloc[-1] > ma60) if not math.isnan(ma60) else None}

    day = {"open": _nz(q.get("open")) or _nz(i.get("regularMarketOpen")),
           "high": _nz(q.get("high")) or _nz(i.get("regularMarketDayHigh")),
           "low": _nz(q.get("low")) or _nz(i.get("regularMarketDayLow")),
           "volume": _nz(q.get("volume")) or _nz(i.get("regularMarketVolume"))}
    if df is not None and len(df) and any(v is None for v in day.values()):
        # Yahoo zeroes the day fields before the next session opens → use the last daily bar.
        last = df.iloc[-1]
        for k in day:
            if day[k] is None:
                day[k] = _nz(last[k])

    return clean({
        "symbol": sym,
        "name": i.get("longName") or i.get("shortName") or sym,
        "short_name": i.get("shortName"),
        "currency": i.get("currency") or ("KRW" if sym.endswith((".KS", ".KQ")) else "USD"),
        "financial_currency": i.get("financialCurrency"),
        "exchange": i.get("fullExchangeName") or i.get("exchange") or q.get("exchange"),
        "quote_type": i.get("quoteType"),
        "market_state": i.get("marketState"),
        "quote": {
            "price": price, "change": change, "change_percent": chg_pct,
            **day, "prev_close": prev,
            "avg_volume": _nz(i.get("averageVolume")),
            "timestamp": q.get("timestamp") or i.get("regularMarketTime"),
        },
        "valuation": {
            "market_cap": _nz(i.get("marketCap")),
            "enterprise_value": _nz(i.get("enterpriseValue")),
            "pe": _pe(i),
            "fpe": _nz(i.get("forwardPE")),
            "peg": _nz(i.get("trailingPegRatio")) or _nz(i.get("pegRatio")),
            "pb": _nz(i.get("priceToBook")) or (price / _bvps(sym) if i.get("quoteType") == "EQUITY" and price and (_bvps(sym) or 0) > 0 else None),
            "ps": _nz(i.get("priceToSalesTrailing12Months")),
            "ev_ebitda": _evebitda(i),
            "div_yield": dy,
            "beta": _f(i.get("beta")),
            "eps": _eps(i),
            "feps": _f(i.get("forwardEps")),
            "bvps": _f(i.get("bookValue")),
        },
        "shares": {
            "outstanding": _nz(i.get("sharesOutstanding")),
            "float": _nz(i.get("floatShares")),
            "insiders": _f(i.get("heldPercentInsiders")),
            "institutions": _f(i.get("heldPercentInstitutions")),
            "short_pct": _f(i.get("shortPercentOfFloat")),
            "short_ratio": _f(i.get("shortRatio")),
        },
        "targets": {
            "high": _nz(i.get("targetHighPrice")), "mean": _nz(i.get("targetMeanPrice")),
            "low": _nz(i.get("targetLowPrice")), "median": _nz(i.get("targetMedianPrice")),
            "analysts": _nz(i.get("numberOfAnalystOpinions")),
            "rec_key": i.get("recommendationKey"), "rec_mean": _f(i.get("recommendationMean")),
        },
        "range52": {"high": hi52, "low": lo52, "price": price, "avg_volume": _nz(i.get("averageVolume")),
                    "ma50": _nz(i.get("fiftyDayAverage")), "ma200": _nz(i.get("twoHundredDayAverage"))},
        "profit": {
            "gross": _f(i.get("grossMargins")), "operating": _f(i.get("operatingMargins")),
            "net": _f(i.get("profitMargins")), "ebitda": _f(i.get("ebitdaMargins")),
            "roa": _f(i.get("returnOnAssets")), "roe": _f(i.get("returnOnEquity")),
        },
        "growth": {
            "revenue": _f(i.get("revenueGrowth")), "earnings": _f(i.get("earningsGrowth")),
            "earnings_q": _f(i.get("earningsQuarterlyGrowth")),
        },
        "health": {
            "total_cash": _nz(i.get("totalCash")), "total_debt": _nz(i.get("totalDebt")),
            "de": _f(i.get("debtToEquity")), "current_ratio": _f(i.get("currentRatio")),
            "fcf": _f(i.get("freeCashflow")), "revenue": _nz(i.get("totalRevenue")),
        },
        "profile": {
            "description": i.get("longBusinessSummary") or "",
            "sector": i.get("sectorDisp") or i.get("sector"), "industry": i.get("industryDisp") or i.get("industry"),
            "employees": _nz(i.get("fullTimeEmployees")), "website": i.get("website"),
            "country": i.get("country"), "city": i.get("city"),
        },
        "risk": risk,
        "benchmark": bench,
    })


def overview(q, body):
    return _overview(_sym(q))


# --------------------------------------------------------------------------- #
# PRICE CHART
# --------------------------------------------------------------------------- #
CHART_PERIODS = {  # ui period -> (fetch period, interval, calendar days to keep)
    "1mo": ("1y", "1d", 31), "3mo": ("1y", "1d", 92), "6mo": ("1y", "1d", 183),
    "1y": ("2y", "1d", 366), "5y": ("5y", "1d", None), "max": ("max", "1wk", None),
}


@cached(300)
def _chart(sym: str, period: str) -> dict:
    fetch, interval, keep = CHART_PERIODS[period]
    df = ohlcv(sym, fetch, interval)
    c = df["close"]
    ma20, ma60 = c.rolling(20).mean(), c.rolling(60).mean()
    if keep:
        m = df.index >= df.index[-1] - pd.Timedelta(days=keep)
        df, ma20, ma60 = df[m], ma20[m], ma60[m]
    ds = dates(df.index)
    candles = [{"time": d, "open": round(o, 4), "high": round(h, 4), "low": round(l, 4), "close": round(cl, 4), "volume": v}
               for d, o, h, l, cl, v in zip(ds, df["open"], df["high"], df["low"], df["close"], df["volume"])]
    return clean({"symbol": sym, "period": period, "interval": interval, "candles": candles,
                  "ma20": [{"time": d, "value": round(v, 4)} for d, v in zip(ds, ma20) if not math.isnan(v)],
                  "ma60": [{"time": d, "value": round(v, 4)} for d, v in zip(ds, ma60) if not math.isnan(v)]})


def chart(q, body):
    p = q.get("period") or "1y"
    if p not in CHART_PERIODS:
        raise BadRequest("기간 값이 올바르지 않습니다 (1mo, 3mo, 6mo, 1y, 5y, max).")
    return _chart(_sym(q), p)


# --------------------------------------------------------------------------- #
# FINANCIALS
# --------------------------------------------------------------------------- #
INCOME_ROWS = [
    ("Total Revenue", "매출액", "rev"), ("Cost Of Revenue", "매출원가", None), ("Gross Profit", "매출총이익", "gp"),
    ("Research And Development", "연구개발비", None), ("Selling General And Administration", "판매관리비", None),
    ("Operating Income", "영업이익", "op"), ("EBITDA", "EBITDA", None), ("Interest Expense", "이자비용", None),
    ("Pretax Income", "세전이익", None), ("Tax Provision", "법인세", None), ("Net Income", "순이익", "ni"),
    ("Basic EPS", "기본 EPS", "eps"), ("Diluted EPS", "희석 EPS", "eps"), ("Diluted Average Shares", "희석 주식수", None),
]
BALANCE_ROWS = [
    ("Total Assets", "자산총계", None), ("Current Assets", "유동자산", None),
    ("Cash Cash Equivalents And Short Term Investments", "현금 및 단기투자", None),
    ("Cash And Cash Equivalents", "현금성자산", None), ("Accounts Receivable", "매출채권", None),
    ("Inventory", "재고자산", None), ("Net PPE", "유형자산", None), ("Goodwill And Other Intangible Assets", "영업권·무형자산", None),
    ("Total Liabilities Net Minority Interest", "부채총계", None), ("Current Liabilities", "유동부채", None),
    ("Total Debt", "총차입금", None), ("Long Term Debt", "장기차입금", None),
    ("Stockholders Equity", "자본총계(지배주주)", None), ("Retained Earnings", "이익잉여금", None),
    ("Net Debt", "순부채", None), ("Working Capital", "운전자본", None), ("Ordinary Shares Number", "발행주식수", None),
]
CASH_ROWS = [
    ("Operating Cash Flow", "영업활동 현금흐름", "ocf"), ("Depreciation And Amortization", "감가상각비", None),
    ("Stock Based Compensation", "주식보상비용", None), ("Change In Working Capital", "운전자본 변동", None),
    ("Capital Expenditure", "설비투자(CAPEX)", None), ("Investing Cash Flow", "투자활동 현금흐름", None),
    ("Financing Cash Flow", "재무활동 현금흐름", None), ("Cash Dividends Paid", "배당금 지급", None),
    ("Repurchase Of Capital Stock", "자사주 매입", None), ("Free Cash Flow", "잉여현금흐름(FCF)", "fcf"),
]
TERM_KEYS = {"Free Cash Flow": "fcf", "EBITDA": "ebitda", "Net Debt": "netdebt", "Basic EPS": "eps", "Diluted EPS": "eps",
             "Capital Expenditure": "capex", "Working Capital": "wc", "Operating Income": "om", "Gross Profit": "gm"}


def _stmt(df: pd.DataFrame | None, spec, quarterly: bool) -> dict:
    if df is None or not isinstance(df, pd.DataFrame) or df.empty:
        return {"columns": [], "rows": []}
    df = df.loc[:, df.notna().sum() > max(3, len(df) * 0.2)]  # drop nearly empty periods
    df = df.reindex(sorted(df.columns, reverse=True), axis=1)  # newest first
    cols = [c.strftime("%Y-%m") if quarterly else c.strftime("%Y") for c in df.columns]
    lag = 4 if quarterly else 1  # YoY: same quarter last year
    rows = []
    for key, label, _ in spec:
        if key not in df.index:
            continue
        vals = [_f(v) for v in df.loc[key].tolist()]
        if all(v is None for v in vals):
            continue
        yoy = []
        for k, v in enumerate(vals):
            p = vals[k + lag] if k + lag < len(vals) else None
            yoy.append((v - p) / abs(p) if v is not None and p not in (None, 0) else None)
        rows.append({"key": key, "label": label, "term": TERM_KEYS.get(key), "values": vals, "yoy": yoy,
                     "per_share": "EPS" in key})
    return {"columns": cols, "rows": rows}


@cached(3600)
def _financials(sym: str, freq: str) -> dict:
    t = yf_ticker(sym)
    qtr = freq == "quarterly"
    inc = _silent(lambda: t.quarterly_income_stmt if qtr else t.income_stmt)
    bal = _silent(lambda: t.quarterly_balance_sheet if qtr else t.balance_sheet)
    cf = _silent(lambda: t.quarterly_cashflow if qtr else t.cashflow)
    out = {"income": _stmt(inc, INCOME_ROWS, qtr), "balance": _stmt(bal, BALANCE_ROWS, qtr), "cashflow": _stmt(cf, CASH_ROWS, qtr)}
    if not any(out[k]["rows"] for k in out):
        raise BadRequest(f"{sym}: 재무제표 데이터가 없습니다 (ETF·지수·암호화폐는 재무제표가 없어요).")

    # ratio rows derived from the income statement / balance sheet
    def row(stmt, key):
        for r in out[stmt]["rows"]:
            if r["key"] == key:
                return r["values"]
        return None

    rev, gp, op, ni = row("income", "Total Revenue"), row("income", "Gross Profit"), row("income", "Operating Income"), row("income", "Net Income")
    ratios = []

    def ratio(label, a, b, term=None):
        if a and b:
            ratios.append({"label": label, "term": term,
                           "values": [x / y if x is not None and y not in (None, 0) else None for x, y in zip(a, b)]})

    ratio("매출총이익률", gp, rev, "gm")
    ratio("영업이익률", op, rev, "om")
    ratio("순이익률", ni, rev, "npm")
    liab, eq = row("balance", "Total Liabilities Net Minority Interest"), row("balance", "Stockholders Equity")
    ca, cl = row("balance", "Current Assets"), row("balance", "Current Liabilities")
    bcols = out["balance"]["columns"]
    if liab and eq:
        ratio_vals = [x / y if x is not None and y not in (None, 0) else None for x, y in zip(liab, eq)]
        out["balance"]["ratios"] = [{"label": "부채비율", "term": "de", "values": ratio_vals}]
        if ca and cl:
            out["balance"]["ratios"].append({"label": "유동비율", "term": "cr", "pct": False,
                                             "values": [x / y if x is not None and y not in (None, 0) else None for x, y in zip(ca, cl)]})
    if ni and eq and out["income"]["columns"] == bcols[:len(out["income"]["columns"])]:
        ratio("ROE (순이익÷자본)", ni, eq[:len(ni)], "roe")
    out["income"]["ratios"] = ratios
    i = _info_ok(sym)
    out.update({"symbol": sym, "freq": freq, "currency": i.get("financialCurrency") or i.get("currency")})
    return clean(out)


def financials(q, body):
    freq = q.get("freq") or "annual"
    if freq not in ("annual", "quarterly"):
        raise BadRequest("freq 값은 annual 또는 quarterly 입니다.")
    return _financials(_sym(q), freq)


# --------------------------------------------------------------------------- #
# TECHNICALS
# --------------------------------------------------------------------------- #
def _ema(s, n):
    return s.ewm(span=n, adjust=False).mean()


def _sig(cond_buy, cond_sell):
    return "BUY" if cond_buy else "SELL" if cond_sell else "NEUTRAL"


@cached(300)
def _technicals(sym: str) -> dict:
    df = ohlcv(sym, "2y", "1d")
    if len(df) < 60:
        raise BadRequest("기술적 분석을 하기에 데이터가 너무 적습니다 (60거래일 미만).")
    c, h, l, v = df["close"], df["high"], df["low"], df["volume"]
    px = float(c.iloc[-1])
    ind, mas = [], []

    def last(s):
        x = s.iloc[-1]
        return None if pd.isna(x) else float(x)

    # moving averages (investing.com style summary)
    for n in (5, 10, 20, 50, 100, 200):
        for kind, s in (("SMA", c.rolling(n).mean()), ("EMA", _ema(c, n))):
            val = last(s)
            if val is None:
                continue
            mas.append({"name": f"{kind}{n}", "value": val, "signal": _sig(px > val, px < val)})

    # RSI
    r = rsi(c)
    rv = last(r)
    ind.append({"key": "rsi", "name": "RSI(14)", "value": rv, "signal": _sig(rv < 30, rv > 70),
                "text": "과매도 구간 — 반등 가능성" if rv < 30 else "과매수 구간 — 단기 과열" if rv > 70 else
                ("상승 힘이 우세" if rv >= 50 else "하락 힘이 우세") + " (30~70 중립)"})
    # MACD
    macd = _ema(c, 12) - _ema(c, 26)
    sig = _ema(macd, 9)
    hist = macd - sig
    mv, sv = last(macd), last(sig)
    crossed = (hist.iloc[-1] > 0) != (hist.iloc[-2] > 0)
    ind.append({"key": "macd", "name": "MACD(12,26,9)", "value": mv, "extra": f"시그널 {sv:,.2f}", "signal": _sig(mv > sv, mv < sv),
                "text": ("방금 " if crossed else "") + ("MACD가 시그널선 위 — 상승 모멘텀" if mv > sv else "MACD가 시그널선 아래 — 하락 모멘텀")})
    # Stochastic
    ll, hh = l.rolling(14).min(), h.rolling(14).max()
    k = 100 * (c - ll) / (hh - ll).replace(0, np.nan)
    d = k.rolling(3).mean()
    kv, dv = last(k), last(d)
    ind.append({"key": "stoch", "name": "Stochastic(14,3)", "value": kv, "extra": f"%D {dv:,.1f}" if dv is not None else "",
                "signal": _sig(kv is not None and kv < 20, kv is not None and kv > 80),
                "text": "최근 14일 범위의 바닥권 — 과매도" if kv is not None and kv < 20 else "최근 14일 범위의 천장권 — 과매수" if kv is not None and kv > 80 else "14일 범위 중간 — 중립"})
    # Williams %R
    wr = -100 * (hh - c) / (hh - ll).replace(0, np.nan)
    wv = last(wr)
    ind.append({"key": "willr", "name": "Williams %R(14)", "value": wv, "signal": _sig(wv is not None and wv < -80, wv is not None and wv > -20),
                "text": "-80 이하 과매도" if wv is not None and wv < -80 else "-20 이상 과매수" if wv is not None and wv > -20 else "-80~-20 중립 구간"})
    # CCI
    tp = (h + l + c) / 3
    md = tp.rolling(20).apply(lambda x: np.mean(np.abs(x - x.mean())), raw=True)
    cci = (tp - tp.rolling(20).mean()) / (0.015 * md.replace(0, np.nan))
    cv = last(cci)
    ind.append({"key": "cci", "name": "CCI(20)", "value": cv, "signal": _sig(cv is not None and cv < -100, cv is not None and cv > 100),
                "text": "-100 이하 — 평균보다 크게 낮음(과매도)" if cv is not None and cv < -100 else "+100 이상 — 평균보다 크게 높음(과매수)" if cv is not None and cv > 100 else "±100 이내 — 평균 근처"})
    # ADX / DI
    up, dn = h.diff(), -l.diff()
    pdm = up.where((up > dn) & (up > 0), 0.0)
    ndm = dn.where((dn > up) & (dn > 0), 0.0)
    tr = pd.concat([h - l, (h - c.shift()).abs(), (l - c.shift()).abs()], axis=1).max(axis=1)
    atr = tr.ewm(alpha=1 / 14, adjust=False).mean()
    pdi = 100 * pdm.ewm(alpha=1 / 14, adjust=False).mean() / atr
    ndi = 100 * ndm.ewm(alpha=1 / 14, adjust=False).mean() / atr
    dx = 100 * (pdi - ndi).abs() / (pdi + ndi).replace(0, np.nan)
    adx = dx.ewm(alpha=1 / 14, adjust=False).mean()
    av, pv, nv = last(adx), last(pdi), last(ndi)
    strong = av is not None and av >= 25
    ind.append({"key": "adx", "name": "ADX(14)", "value": av, "extra": f"+DI {pv:,.1f} / -DI {nv:,.1f}",
                "signal": _sig(strong and pv > nv, strong and pv < nv),
                "text": (("강한 상승 추세" if pv > nv else "강한 하락 추세") if strong else "추세가 약함(횡보) — 25 이상이면 추세 뚜렷")})
    # ATR
    atv = last(atr)
    ind.append({"key": "atr", "name": "ATR(14)", "value": atv, "extra": f"가격의 {atv / px * 100:,.2f}%", "signal": "NEUTRAL",
                "text": f"하루 평균 변동폭 ≈ {atv:,.2f} — 방향이 아닌 변동성 지표"})
    # Bollinger
    mid = c.rolling(20).mean()
    sd = c.rolling(20).std()
    up_b, lo_b = mid + 2 * sd, mid - 2 * sd
    pb = (px - last(lo_b)) / (last(up_b) - last(lo_b)) if last(up_b) != last(lo_b) else None
    ind.append({"key": "bb", "name": "Bollinger %B(20,2)", "value": pb * 100 if pb is not None else None,
                "extra": f"폭 {(last(up_b) - last(lo_b)) / last(mid) * 100:,.1f}%",
                "signal": _sig(pb is not None and pb < 0, pb is not None and pb > 1),
                "text": "하단 밴드 아래 — 과매도" if pb is not None and pb < 0 else "상단 밴드 위 — 과열" if pb is not None and pb > 1 else
                ("밴드 상단 쪽" if pb is not None and pb > .5 else "밴드 하단 쪽") + "(밴드 안)"})
    # OBV
    obv = (np.sign(c.diff()).fillna(0) * v).cumsum()
    slope = obv.iloc[-1] - obv.iloc[-21] if len(obv) > 21 else 0
    ind.append({"key": "obv", "name": "OBV (20일 변화)", "value": float(slope), "big": True, "signal": _sig(slope > 0, slope < 0),
                "text": "최근 20일 매수 거래량 우세 — 자금 유입" if slope > 0 else "최근 20일 매도 거래량 우세 — 자금 유출"})
    # ROC
    roc = (c / c.shift(12) - 1) * 100
    rcv = last(roc)
    ind.append({"key": "roc", "name": "ROC(12)", "value": rcv, "signal": _sig(rcv is not None and rcv > 0, rcv is not None and rcv < 0),
                "text": f"12거래일 전보다 {rcv:+.2f}%" if rcv is not None else ""})
    # trend: EMA12 vs EMA26 & SMA50 vs SMA200
    e12, e26 = last(_ema(c, 12)), last(_ema(c, 26))
    ind.append({"key": "ema", "name": "EMA12 / EMA26", "value": e12, "extra": f"EMA26 {e26:,.2f}", "signal": _sig(e12 > e26, e12 < e26),
                "text": "단기 평균이 장기 평균 위 — 상승 흐름" if e12 > e26 else "단기 평균이 장기 평균 아래 — 하락 흐름"})
    s50, s200 = last(c.rolling(50).mean()), last(c.rolling(200).mean())
    if s50 is not None and s200 is not None:
        ind.append({"key": "ma", "name": "SMA50 / SMA200", "value": s50, "extra": f"SMA200 {s200:,.2f}", "signal": _sig(s50 > s200, s50 < s200),
                    "text": "골든크로스 상태(50일선 > 200일선) — 장기 상승" if s50 > s200 else "데드크로스 상태(50일선 < 200일선) — 장기 약세"})

    def count(lst):
        b = sum(x["signal"] == "BUY" for x in lst)
        s = sum(x["signal"] == "SELL" for x in lst)
        n = len(lst)
        score = (b - s) / n if n else 0
        verdict = "적극 매수" if score > .5 else "매수" if score > .1 else "적극 매도" if score < -.5 else "매도" if score < -.1 else "중립"
        return {"buy": b, "sell": s, "neutral": n - b - s, "score": score, "verdict": verdict}

    keep = int((df.index >= df.index[-1] - pd.Timedelta(days=366)).sum())
    sl = slice(-keep, None)
    ds = dates(df.index[sl])
    rnd = lambda s: [None if pd.isna(x) else round(float(x), 4) for x in s.iloc[sl]]
    candles = [{"time": t, "open": o, "high": hi, "low": lo, "close": cl, "volume": vo}
               for t, o, hi, lo, cl, vo in zip(ds, df["open"].iloc[sl], h.iloc[sl], l.iloc[sl], c.iloc[sl], v.iloc[sl])]
    return clean({
        "symbol": sym, "price": px, "date": ds[-1],
        "indicators": ind, "mas": mas,
        "summary": {"indicators": count(ind), "mas": count(mas), "overall": count(ind + mas)},
        "series": {"dates": ds, "candles": candles, "bb_up": rnd(up_b), "bb_mid": rnd(mid), "bb_lo": rnd(lo_b),
                   "sma50": rnd(c.rolling(50).mean()), "sma200": rnd(c.rolling(200).mean()),
                   "macd": rnd(macd), "signal": rnd(sig), "hist": rnd(hist), "rsi": rnd(r), "stoch_k": rnd(k), "stoch_d": rnd(d)},
    })


def technicals(q, body):
    return _technicals(_sym(q))


# --------------------------------------------------------------------------- #
# DCF + relative valuation
# --------------------------------------------------------------------------- #
@cached(3600)
def _dcf_prefill(sym: str) -> dict:
    i = _info_ok(sym)
    if not i or ("symbol" not in i and "shortName" not in i):
        raise BadRequest(f"{sym}: 기업 정보를 찾지 못했습니다.")
    beta = _f(i.get("beta")) or 1.0
    wacc = min(max(0.04 + beta * 0.055, 0.06), 0.15)  # 단순 CAPM 근사: 무위험 4% + 베타 × 시장위험프리미엄 5.5%
    growth = _f(i.get("earningsGrowth")) or _f(i.get("revenueGrowth")) or 0.05
    fcf = _f(i.get("freeCashflow"))
    fcf_hist = []
    cf = _silent(lambda: yf_ticker(sym).cashflow)
    if isinstance(cf, pd.DataFrame) and "Free Cash Flow" in cf.index:
        s = cf.loc["Free Cash Flow"].dropna().sort_index()
        fcf_hist = [{"year": d.strftime("%Y"), "fcf": float(x)} for d, x in s.items()]
        if fcf is None and fcf_hist:
            fcf = fcf_hist[-1]["fcf"]
    return clean({
        "symbol": sym, "name": i.get("longName") or i.get("shortName"),
        "currency": i.get("financialCurrency") or i.get("currency"), "price_currency": i.get("currency"),
        "price": _f(i.get("currentPrice")) or _f(i.get("regularMarketPrice")),
        "fcf": fcf, "fcf_hist": fcf_hist,
        "net_debt": (_f(i.get("totalDebt")) or 0) - (_f(i.get("totalCash")) or 0),
        "shares": _nz(i.get("sharesOutstanding")),
        "growth": round(min(max(float(growth), -0.05), 0.15), 4),
        "wacc": round(wacc, 4), "terminal_growth": 0.025, "years": 5, "beta": beta,
    })


def dcf_prefill(q, body):
    return _dcf_prefill(_sym(q))


def _dcf_value(fcf, g, years, wacc, tg, net_debt, shares):
    f, s = fcf, 0.0
    for t in range(1, years + 1):
        f *= 1 + g
        s += f / (1 + wacc) ** t
    s += f * (1 + tg) / (wacc - tg) / (1 + wacc) ** years
    return (s - net_debt) / shares


def dcf(q, body):
    p = body or {}
    fcf = num(p.get("fcf"), "기준 FCF")
    g = num(p.get("growth"), "성장률", -0.5, 1.0)
    years = int(num(p.get("years"), "예측 기간", 1, 15, 5))
    tg = num(p.get("terminal_growth"), "영구 성장률", -0.05, 0.1)
    wacc = num(p.get("wacc"), "할인율", 0.01, 0.5)
    if wacc <= tg:
        raise BadRequest("할인율(WACC)은 영구 성장률보다 커야 합니다.")
    net_debt = num(p.get("net_debt"), "순부채", default=0)
    shares = num(p.get("shares"), "주식 수", 1, default=1)
    price = _f(p.get("price"))

    flows, pv_sum, f = [], 0.0, fcf
    for t in range(1, years + 1):
        f *= 1 + g
        pv = f / (1 + wacc) ** t
        pv_sum += pv
        flows.append({"year": t, "fcf": f, "pv": pv})
    tv = f * (1 + tg) / (wacc - tg)
    pv_tv = tv / (1 + wacc) ** years
    ev = pv_sum + pv_tv
    equity = ev - net_debt
    per_share = equity / shares

    waccs = [round(wacc + d, 4) for d in (-0.02, -0.01, 0, 0.01, 0.02)]
    tgs = [round(tg + d, 4) for d in (-0.01, -0.005, 0, 0.005, 0.01)]
    grid = [[None if w_ <= t_ or w_ <= 0 else _dcf_value(fcf, g, years, w_, t_, net_debt, shares) for t_ in tgs] for w_ in waccs]
    return clean({"flows": flows, "pv_flows": pv_sum, "terminal_value": tv, "pv_terminal": pv_tv,
                  "enterprise_value": ev, "equity_value": equity, "per_share": per_share,
                  "upside": per_share / price - 1 if price else None,
                  "tv_share": pv_tv / ev if ev else None,
                  "sensitivity": {"wacc": waccs, "tg": tgs, "values": grid}})


# --------------------------------------------------------------------------- #
# PEERS
# --------------------------------------------------------------------------- #
PEER_MAP = {
    # US mega caps
    "AAPL": ["MSFT", "GOOGL", "META", "AMZN", "SONY", "005930.KS"],
    "MSFT": ["AAPL", "GOOGL", "AMZN", "ORCL", "CRM", "IBM"],
    "GOOGL": ["MSFT", "META", "AMZN", "AAPL", "BIDU", "035420.KS"],
    "GOOG": ["MSFT", "META", "AMZN", "AAPL", "BIDU", "035420.KS"],
    "META": ["GOOGL", "SNAP", "PINS", "RDDT", "MSFT", "035420.KS"],
    "AMZN": ["WMT", "BABA", "SHOP", "EBAY", "MSFT", "GOOGL"],
    "NVDA": ["AMD", "INTC", "AVGO", "QCOM", "TSM", "000660.KS"],
    "AMD": ["NVDA", "INTC", "QCOM", "ARM", "AVGO", "MU"],
    "INTC": ["AMD", "NVDA", "TSM", "QCOM", "TXN", "005930.KS"],
    "AVGO": ["NVDA", "QCOM", "MRVL", "TXN", "AMD", "ADI"],
    "TSM": ["005930.KS", "INTC", "GFS", "UMC", "ASML", "NVDA"],
    "MU": ["000660.KS", "005930.KS", "WDC", "STX", "INTC", "SNDK"],
    "ASML": ["AMAT", "LRCX", "KLAC", "TSM", "TER"],
    "TSLA": ["GM", "F", "RIVN", "TM", "005380.KS", "BYDDY"],
    "ORCL": ["MSFT", "SAP", "CRM", "IBM", "NOW"],
    "CRM": ["MSFT", "ORCL", "NOW", "ADBE", "SAP", "WDAY"],
    "ADBE": ["CRM", "MSFT", "INTU", "NOW", "FIG"],
    "NFLX": ["DIS", "WBD", "ROKU", "SPOT", "PARA"],
    "DIS": ["NFLX", "CMCSA", "WBD", "PARA", "SONY"],
    "JPM": ["BAC", "C", "WFC", "GS", "MS", "105560.KS"],
    "BAC": ["JPM", "C", "WFC", "USB", "PNC"],
    "WFC": ["JPM", "BAC", "C", "USB", "PNC"],
    "GS": ["MS", "JPM", "C", "SCHW", "BAC"],
    "V": ["MA", "AXP", "PYPL", "COF", "FI"],
    "MA": ["V", "AXP", "PYPL", "COF", "FI"],
    "KO": ["PEP", "MNST", "KDP", "CELH"],
    "PEP": ["KO", "MDLZ", "KDP", "MNST"],
    "WMT": ["COST", "TGT", "AMZN", "KR", "DG"],
    "COST": ["WMT", "TGT", "BJ", "KR", "AMZN"],
    "XOM": ["CVX", "COP", "BP", "SHEL", "TTE"],
    "CVX": ["XOM", "COP", "BP", "SHEL", "OXY"],
    "JNJ": ["PFE", "MRK", "ABBV", "LLY", "BMY"],
    "PFE": ["MRK", "JNJ", "ABBV", "BMY", "LLY"],
    "LLY": ["NVO", "MRK", "PFE", "ABBV", "207940.KS"],
    "UNH": ["ELV", "CI", "HUM", "CVS"],
    "BRK-B": ["JPM", "BAC", "AXP", "MKL"],
    "MCD": ["SBUX", "YUM", "CMG", "QSR"],
    "NKE": ["ADS.DE", "LULU", "UA", "DECK"],
    # indices / crypto
    "^GSPC": ["^IXIC", "^DJI", "^RUT", "^KS11", "^N225"], "^IXIC": ["^GSPC", "^DJI", "^SOX", "^KQ11"], "^DJI": ["^GSPC", "^IXIC", "^RUT"],
    "^KS11": ["^KQ11", "^GSPC", "^N225", "^HSI", "000001.SS"], "^KQ11": ["^KS11", "^IXIC", "^RUT"],
    "BTC-USD": ["ETH-USD", "SOL-USD", "XRP-USD", "BNB-USD", "DOGE-USD"], "ETH-USD": ["BTC-USD", "SOL-USD", "BNB-USD", "ADA-USD"],
    "SPY": ["QQQ", "DIA", "IWM", "VTI", "VOO"], "QQQ": ["SPY", "DIA", "IWM", "XLK", "SMH"],
    # Korea
    "005930.KS": ["000660.KS", "066570.KS", "009150.KS", "011070.KS", "AAPL", "TSM"],
    "005935.KS": ["005930.KS", "000660.KS", "066570.KS", "009150.KS"],
    "000660.KS": ["005930.KS", "MU", "042700.KS", "403870.KQ", "SNDK"],
    "035420.KS": ["035720.KS", "036570.KS", "251270.KS", "259960.KS", "GOOGL"],
    "035720.KS": ["035420.KS", "036570.KS", "251270.KS", "259960.KS", "377300.KS"],
    "005380.KS": ["000270.KS", "012330.KS", "TM", "GM", "HMC"],
    "000270.KS": ["005380.KS", "012330.KS", "TM", "GM"],
    "012330.KS": ["005380.KS", "000270.KS", "018880.KS", "204320.KS"],
    "373220.KS": ["006400.KS", "051910.KS", "247540.KQ", "003670.KS", "096770.KS"],
    "006400.KS": ["373220.KS", "051910.KS", "247540.KQ", "003670.KS"],
    "051910.KS": ["373220.KS", "006400.KS", "011170.KS", "011780.KS"],
    "207940.KS": ["068270.KS", "326030.KS", "128940.KS", "000100.KS"],
    "068270.KS": ["207940.KS", "128940.KS", "000100.KS", "326030.KS"],
    "105560.KS": ["055550.KS", "086790.KS", "316140.KS", "024110.KS"],
    "055550.KS": ["105560.KS", "086790.KS", "316140.KS", "024110.KS"],
    "086790.KS": ["105560.KS", "055550.KS", "316140.KS", "024110.KS"],
    "005490.KS": ["004020.KS", "010130.KS", "003670.KS", "001230.KS"],
    "066570.KS": ["005930.KS", "SONY", "009150.KS", "011070.KS"],
    "017670.KS": ["030200.KS", "032640.KS"],
    "030200.KS": ["017670.KS", "032640.KS"],
    "028260.KS": ["000830.KS", "003550.KS", "034730.KS"],
    "034730.KS": ["003550.KS", "028260.KS", "000880.KS"],
    "009150.KS": ["011070.KS", "005930.KS", "066570.KS"],
    "259960.KS": ["036570.KS", "251270.KS", "263750.KQ", "293490.KQ"],
}


@cached(86400)
def _auto_peers(sym: str) -> list[str]:
    if sym in PEER_MAP:
        return PEER_MAP[sym]
    i = _info_ok(sym)
    import yfinance as yf

    # Korean (or other non-US) stocks: same sector, same region, biggest market caps.
    region = "kr" if sym.endswith((".KS", ".KQ")) else None
    sector = i.get("sector")
    if region and sector:
        from yfinance import EquityQuery as Q

        res = _silent(lambda: yf.screen(Q("and", [Q("eq", ["region", region]), Q("eq", ["sector", sector])]),
                                        sortField="intradaymarketcap", sortAsc=False, size=8), {}) or {}
        out = [x["symbol"] for x in res.get("quotes", []) if x.get("symbol") and x["symbol"] != sym]
        if out:
            return out[:6]
    key = i.get("industryKey")
    if key:
        tc = _silent(lambda: yf.Industry(key).top_companies)
        if isinstance(tc, pd.DataFrame) and not tc.empty:
            return [s for s in tc.index.tolist() if s != sym][:6]
    return []


@cached(86400)
def _bvps(sym: str):
    """Book value per share from the latest balance sheet (Yahoo omits bookValue for many Korean stocks)."""
    bs = _silent(lambda: yf_ticker(sym).balance_sheet)
    if not isinstance(bs, pd.DataFrame) or bs.empty:
        return None
    eq = next((bs.loc[k].dropna() for k in ("Stockholders Equity", "Common Stock Equity") if k in bs.index and bs.loc[k].notna().any()), None)
    sh = next((bs.loc[k].dropna() for k in ("Ordinary Shares Number", "Share Issued") if k in bs.index and bs.loc[k].notna().any()), None)
    if eq is None or sh is None or not len(eq) or not len(sh) or not sh.iloc[0]:
        return None
    return float(eq.iloc[0]) / float(sh.iloc[0])


def _row_for(sym: str) -> dict:
    i = _info_ok(sym)
    bvps = _f(i.get("bookValue"))
    price = _f(i.get("currentPrice")) or _f(i.get("regularMarketPrice"))
    pb = _nz(i.get("priceToBook"))
    if pb is None and i.get("quoteType") == "EQUITY":
        bvps = bvps or _bvps(sym)
        pb = price / bvps if bvps and bvps > 0 and price else None
    dy = _f(i.get("dividendYield"))
    ret1y = None
    try:
        c = history(sym, "1y")
        ret1y = float(c.iloc[-1] / c.iloc[0] - 1) if len(c) > 5 else None
    except BadRequest:
        pass
    return {
        "symbol": sym, "name": i.get("shortName") or i.get("longName") or sym, "currency": i.get("currency"),
        "price": _f(i.get("currentPrice")) or _f(i.get("regularMarketPrice")),
        "change_pct": _f(i.get("regularMarketChangePercent")),
        "mcap": _nz(i.get("marketCap")), "pe": _pe(i), "fpe": _nz(i.get("forwardPE")),
        "pb": pb, "ps": _nz(i.get("priceToSalesTrailing12Months")),
        "ev_ebitda": _evebitda(i), "roe": _f(i.get("returnOnEquity")),
        "margin": _f(i.get("profitMargins")), "op_margin": _f(i.get("operatingMargins")),
        "growth": _f(i.get("revenueGrowth")), "div_yield": dy / 100 if dy is not None else None,
        "beta": _f(i.get("beta")), "ret1y": ret1y,
        "eps": _eps(i), "bvps": bvps, "sps": _f(i.get("revenuePerShare")),
        "ebitda": _f(i.get("ebitda")), "net_debt": (_f(i.get("totalDebt")) or 0) - (_f(i.get("totalCash")) or 0),
        "shares": _nz(i.get("sharesOutstanding")), "sector": i.get("sector"), "industry": i.get("industry"),
    }


def _peer_list(q, sym):
    raw = q.get("peers")
    if raw:
        return [p for p in check_symbols(raw, 1, 12) if p != sym]
    return _auto_peers(sym)


@cached(600)
def _peers(sym: str, peers: tuple) -> dict:
    syms = [sym, *peers]
    with ThreadPoolExecutor(max_workers=8) as ex:
        rows = list(ex.map(lambda s: _silent(lambda: _row_for(s)), syms))
    rows = [r for r in rows if r and r.get("price") is not None]
    # normalized 1Y performance
    series = {}
    for r in rows:
        try:
            series[r["symbol"]] = history(r["symbol"], "1y")
        except BadRequest:
            pass
    perf = {"dates": [], "series": {}}
    if series:
        df = pd.concat(series, axis=1, join="outer").sort_index().ffill().dropna(how="all")
        df = df.bfill()
        norm = df / df.iloc[0] * 100
        perf = {"dates": dates(norm.index), "series": {k: norm[k].round(2).tolist() for k in norm.columns}}
    return clean({"symbol": sym, "peers": list(peers), "rows": rows, "perf": perf})


def peers(q, body):
    sym = _sym(q)
    return _peers(sym, tuple(_peer_list(q, sym)))


def _median(vals):
    v = [x for x in vals if x is not None and x > 0]
    return float(np.median(v)) if v else None


def relative(q, body):
    """PER/PBR/PSR/EV-EBITDA implied price from peer medians."""
    sym = _sym(q)
    data = _peers(sym, tuple(_peer_list(q, sym)))
    me = next((r for r in data["rows"] if r["symbol"] == sym), None)
    if not me:
        raise BadRequest(f"{sym}: 기업 정보를 찾지 못했습니다.")
    others = [r for r in data["rows"] if r["symbol"] != sym]
    out = []
    for key, label, base_key, base_label in (("pe", "PER", "eps", "주당순이익(EPS)"), ("pb", "PBR", "bvps", "주당순자산(BPS)"),
                                              ("ps", "PSR", "sps", "주당매출(SPS)")):
        med = _median([r.get(key) for r in others])
        base = me.get(base_key)
        implied = med * base if med and base and base > 0 else None
        out.append({"key": key, "label": label, "mine": me.get(key), "peer_median": med, "base": base, "base_label": base_label,
                    "implied": implied, "upside": implied / me["price"] - 1 if implied and me.get("price") else None})
    med = _median([r.get("ev_ebitda") for r in others])
    if med and me.get("ebitda") and me.get("shares"):
        implied = (med * me["ebitda"] - me["net_debt"]) / me["shares"]
        out.append({"key": "ev_ebitda", "label": "EV/EBITDA", "mine": me.get("ev_ebitda"), "peer_median": med, "base": me["ebitda"],
                    "base_label": "EBITDA", "implied": implied if implied > 0 else None,
                    "upside": implied / me["price"] - 1 if implied > 0 and me.get("price") else None})
    vals = [x["implied"] for x in out if x["implied"]]
    return clean({"symbol": sym, "price": me.get("price"), "currency": me.get("currency"), "peers": [r["symbol"] for r in others],
                  "methods": out, "average": float(np.mean(vals)) if vals else None,
                  "mixed_currency": len({r.get("currency") for r in data["rows"]}) > 1})


# --------------------------------------------------------------------------- #
# ANALYSTS
# --------------------------------------------------------------------------- #
@cached(1800)
def _analysts(sym: str) -> dict:
    t = yf_ticker(sym)
    rec = _silent(lambda: t.recommendations)
    ud = _silent(lambda: t.upgrades_downgrades)
    pt = _silent(lambda: t.analyst_price_targets, {}) or {}
    eh = _silent(lambda: t.earnings_history)
    ee = _silent(lambda: t.earnings_estimate)
    re_ = _silent(lambda: t.revenue_estimate)
    et = _silent(lambda: t.eps_trend)
    i = _info_ok(sym)

    def with_index(df, name):
        if not isinstance(df, pd.DataFrame) or df.empty:
            return []
        d = df.reset_index().rename(columns={df.index.name or "index": name})
        return _df_records(d)

    return clean({
        "symbol": sym, "currency": i.get("currency"),
        "price": _f(i.get("currentPrice")) or _f(i.get("regularMarketPrice")),
        "rec_key": i.get("recommendationKey"), "rec_mean": _f(i.get("recommendationMean")),
        "analysts": _nz(i.get("numberOfAnalystOpinions")),
        "recommendations": _df_records(rec),
        "upgrades": with_index(ud, "date")[:40],
        "targets": {k: _f(v) for k, v in pt.items()} if isinstance(pt, dict) else {},
        "earnings_history": with_index(eh, "quarter"),
        "earnings_estimate": with_index(ee, "period"),
        "revenue_estimate": with_index(re_, "period"),
        "eps_trend": with_index(et, "period"),
    })


def analysts(q, body):
    return _analysts(_sym(q))


# --------------------------------------------------------------------------- #
# HOLDERS
# --------------------------------------------------------------------------- #
@cached(3600)
def _holders(sym: str) -> dict:
    t = yf_ticker(sym)
    mh = _silent(lambda: t.major_holders)
    major = {}
    if isinstance(mh, pd.DataFrame) and not mh.empty:
        col = mh.columns[0]
        major = {str(k): _f(v) for k, v in mh[col].items()}
    i = _info_ok(sym)
    return clean({
        "symbol": sym, "currency": i.get("currency"), "shares_out": _nz(i.get("sharesOutstanding")),
        "float": _nz(i.get("floatShares")),
        "major": major,
        "institutional": _df_records(_silent(lambda: t.institutional_holders), 15),
        "mutualfund": _df_records(_silent(lambda: t.mutualfund_holders), 15),
        "insider": _df_records(_silent(lambda: t.insider_transactions), 40),
    })


def holders(q, body):
    return _holders(_sym(q))


# --------------------------------------------------------------------------- #
# DIVIDENDS
# --------------------------------------------------------------------------- #
@cached(3600)
def _dividends(sym: str) -> dict:
    t = yf_ticker(sym)
    dv = _silent(lambda: t.dividends)
    sp = _silent(lambda: t.splits)
    i = _info_ok(sym)
    hist, annual, splits = [], [], []
    if isinstance(dv, pd.Series) and len(dv):
        dv.index = pd.to_datetime(dv.index).tz_localize(None) if dv.index.tz is not None else pd.to_datetime(dv.index)
        hist = [{"date": d.strftime("%Y-%m-%d"), "amount": float(a)} for d, a in dv.items()][::-1]
        yearly = dv.groupby(dv.index.year).agg(["sum", "count"])
        px = None
        try:
            m = ohlcv(sym, "max", "1mo")["close"]
            px = m.groupby(m.index.year).mean()
        except BadRequest:
            pass
        cur_year = pd.Timestamp.now().year
        prev = None
        yearly = yearly.reindex(range(int(yearly.index.min()), int(yearly.index.max()) + 1), fill_value=0)
        for y, r in yearly.iterrows():
            avg = float(px.get(y)) if px is not None and y in px.index else None
            annual.append({"year": int(y), "total": float(r["sum"]), "count": int(r["count"]),
                           "yield": float(r["sum"]) / avg if avg else None,
                           "growth": float(r["sum"]) / prev - 1 if prev else None, "partial": int(y) == cur_year})
            if not r["count"]:
                annual[-1]["yield"] = None
            prev = float(r["sum"])
    if isinstance(sp, pd.Series) and len(sp):
        splits = [{"date": pd.Timestamp(d).strftime("%Y-%m-%d"), "ratio": float(x)} for d, x in sp.items()][::-1]
    dy = _f(i.get("dividendYield"))
    fy = _f(i.get("fiveYearAvgDividendYield"))
    ex = i.get("exDividendDate")
    return clean({
        "symbol": sym, "currency": i.get("currency"),
        "price": _f(i.get("currentPrice")) or _f(i.get("regularMarketPrice")),
        "rate": _f(i.get("dividendRate")), "yield": dy / 100 if dy is not None else None,
        "trailing_rate": _f(i.get("trailingAnnualDividendRate")), "trailing_yield": _f(i.get("trailingAnnualDividendYield")),
        "five_year_yield": fy / 100 if fy is not None else None,
        "payout": _f(i.get("payoutRatio")),
        "ex_date": time.strftime("%Y-%m-%d", time.gmtime(ex)) if isinstance(ex, (int, float)) and ex > 0 else None,
        "last_value": _f(i.get("lastDividendValue")),
        "history": hist[:80], "annual": annual[-20:], "splits": splits,
    })


def dividends(q, body):
    return _dividends(_sym(q))


# --------------------------------------------------------------------------- #
# NEWS
# --------------------------------------------------------------------------- #
@cached(900)
def _news(sym: str) -> dict:
    res = _silent(lambda: quiet(yfd.get_news, sym, 20), {}) or {}
    arts = res.get("articles") or []
    source = "yfinance_data.get_news"
    if not arts:
        import yfinance as yf

        items = _silent(lambda: yf.Search(sym, news_count=15).news, []) or []
        source = "yf.Search"
        if not items:  # e.g. 005930.KS — search by company name instead
            name = (_silent(lambda: profile(sym), {}) or {}).get("companyName") or ""
            name = re.sub(r",?\s*(Co\.,?\s*)?(Ltd\.?|Inc\.?|Corp(oration)?\.?)$", "", name).strip()
            if name:
                items = _silent(lambda: yf.Search(name, news_count=15).news, []) or []
                source = f"yf.Search('{name}')"
        arts = [{"title": n.get("title", ""), "url": n.get("link", ""), "publisher": n.get("publisher", ""), "description": "",
                 "published_date": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(n["providerPublishTime"])) if n.get("providerPublishTime") else ""}
                for n in items if n.get("title")]
    return clean({"symbol": sym, "source": source, "articles": arts})


def news(q, body):
    return _news(_sym(q))


# --------------------------------------------------------------------------- #
# QUOTE FALLBACK (watchlist: symbols the batch endpoint missed)
# --------------------------------------------------------------------------- #
def quotes_fallback(q, body):
    """GET /api/research/quotes?symbols=A,B → per-symbol Fincept get_quote (slower, but reliable)."""
    syms = check_symbols(q.get("symbols"), 1, 30)
    with ThreadPoolExecutor(max_workers=8) as ex:
        res = list(ex.map(lambda s: _silent(lambda: quote(s), {}) or {}, syms))
    return clean({"quotes": [r if r.get("price") is not None and "error" not in r else {"symbol": s, "price": None} for s, r in zip(syms, res)]})


ROUTES = {
    ("GET", "/api/research/quotes"): quotes_fallback,
    ("GET", "/api/research/overview"): overview,
    ("GET", "/api/research/chart"): chart,
    ("GET", "/api/research/financials"): financials,
    ("GET", "/api/research/technicals"): technicals,
    ("GET", "/api/research/dcf_prefill"): dcf_prefill,
    ("POST", "/api/research/dcf"): dcf,
    ("GET", "/api/research/relative"): relative,
    ("GET", "/api/research/peers"): peers,
    ("GET", "/api/research/analysts"): analysts,
    ("GET", "/api/research/holders"): holders,
    ("GET", "/api/research/dividends"): dividends,
    ("GET", "/api/research/news"): news,
}

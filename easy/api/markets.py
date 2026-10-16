"""Markets / Dashboard / Forex endpoints.

Quotes for the panels come from the shared /api/quotes endpoint (Fincept yfinance_data
get_batch_quotes / get_batch_sparklines). This module adds what those screens need on top:
top movers, market news headlines, market pulse (Fincept alternative_me_data fear & greed,
VIX, breadth), multi-horizon returns (sector rotation), a quote card and FX tools.
"""

from __future__ import annotations

import contextlib
import io
import math

import numpy as np
import pandas as pd

from api.common import (
    muted,
    BadRequest,
    batch_quotes,
    cached,
    check_period,
    check_symbol,
    check_symbols,
    clean,
    num,
    ohlcv,
    quiet,
    quote,
    yf_ticker,
)

NET_TIMEOUT = 15

# --------------------------------------------------------------------------- #
# helpers
# --------------------------------------------------------------------------- #


def _yf():
    import yfinance as yf

    return yf


def _download_closes(symbols: list[str], period: str, interval: str = "1d") -> pd.DataFrame:
    yf = _yf()
    with muted():
        data = yf.download(symbols, period=period, interval=interval, progress=False,
                           auto_adjust=True, threads=True, timeout=NET_TIMEOUT)
    if data is None or data.empty:
        raise BadRequest("시세 데이터를 가져오지 못했습니다. 잠시 후 다시 시도하세요.")
    if isinstance(data.columns, pd.MultiIndex):
        close = data["Close"]
    else:
        close = data[["Close"]].rename(columns={"Close": symbols[0]})
    if isinstance(close, pd.Series):
        close = close.to_frame(symbols[0])
    close.index = pd.to_datetime(close.index).tz_localize(None) if getattr(close.index, "tz", None) else pd.to_datetime(close.index)
    return close.sort_index()


def _ret(s: pd.Series, n: int):
    s = s.dropna()
    if len(s) <= n:
        return None
    a, b = s.iloc[-1 - n], s.iloc[-1]
    return float(b / a - 1) if a else None


# --------------------------------------------------------------------------- #
# Top movers  (yfinance predefined screeners; basket fallback)
# --------------------------------------------------------------------------- #
FALLBACK_BASKET = ("AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "TSLA", "AVGO", "AMD", "INTC", "NFLX",
                   "JPM", "BAC", "XOM", "CVX", "UNH", "LLY", "PFE", "WMT", "COST", "KO", "DIS", "BA", "ORCL",
                   "CRM", "ADBE", "QCOM", "MU", "PLTR", "UBER", "COIN", "SMCI", "MSTR", "SHOP", "PYPL")

SCREENS = {"gainers": "day_gainers", "losers": "day_losers", "actives": "most_actives"}


@cached(180)
def _screen(kind: str, n: int) -> list:
    yf = _yf()
    with muted():
        res = yf.screen(SCREENS[kind], count=n)
    out = []
    for r in (res or {}).get("quotes", []):
        out.append({
            "symbol": r.get("symbol"),
            "name": r.get("shortName") or r.get("longName") or "",
            "price": r.get("regularMarketPrice"),
            "change": r.get("regularMarketChange"),
            "change_percent": r.get("regularMarketChangePercent"),
            "volume": r.get("regularMarketVolume"),
            "market_cap": r.get("marketCap"),
        })
    return out


def movers(q, body):
    """GET /api/markets/movers?n=8 → {gainers, losers, actives, source}"""
    n = int(num(q.get("n"), "n", 3, 25, 8))
    try:
        data = {k: _screen(k, n) for k in SCREENS}
        if not data["gainers"] and not data["losers"]:
            raise ValueError("empty")
        data["source"] = "Yahoo Finance 스크리너 (미국 전체)"
    except Exception:
        rows = [r for r in _robust_batch(FALLBACK_BASKET) if r.get("change_percent") is not None]
        rows.sort(key=lambda r: r["change_percent"], reverse=True)
        data = {
            "gainers": rows[:n],
            "losers": list(reversed(rows[-n:])),
            "actives": sorted(rows, key=lambda r: r.get("volume") or 0, reverse=True)[:n],
            "source": f"미국 대형주 {len(FALLBACK_BASKET)}종목 기준",
        }
    return clean(data)


# --------------------------------------------------------------------------- #
# News headlines
# --------------------------------------------------------------------------- #
@cached(300)
def _news(term: str, n: int) -> list:
    yf = _yf()
    with muted():
        s = yf.Search(term, news_count=n, max_results=1, timeout=NET_TIMEOUT)
        items = s.news or []
    out = []
    for it in items:
        if not it.get("title"):
            continue
        out.append({
            "title": it.get("title"),
            "publisher": it.get("publisher") or "",
            "link": it.get("link") or "",
            "time": it.get("providerPublishTime"),
            "tickers": it.get("relatedTickers") or [],
        })
    out.sort(key=lambda x: x.get("time") or 0, reverse=True)
    return out


def news(q, body):
    """GET /api/markets/news?q=stock+market&n=12"""
    term = (q.get("q") or "stock market").strip()[:40] or "stock market"
    n = int(num(q.get("n"), "n", 1, 30, 12))
    try:
        items = _news(term, n)
    except Exception as e:  # network
        raise BadRequest(f"뉴스를 가져오지 못했습니다 ({type(e).__name__}).")
    return clean({"query": term, "items": items})


# --------------------------------------------------------------------------- #
# Market pulse: fear & greed, VIX, breadth
# --------------------------------------------------------------------------- #
BREADTH = {
    "미국 대형주": ("AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "TSLA", "AVGO", "BRK-B", "JPM", "LLY", "V",
                 "UNH", "XOM", "MA", "JNJ", "PG", "HD", "COST", "ABBV", "WMT", "NFLX", "CRM", "BAC", "KO",
                 "ORCL", "AMD", "PEP", "CVX", "MRK"),
    "한국 대형주": ("005930.KS", "000660.KS", "373220.KS", "207940.KS", "005380.KS", "000270.KS", "068270.KS",
                 "035420.KS", "005490.KS", "105560.KS", "055550.KS", "012330.KS", "035720.KS", "051910.KS",
                 "006400.KS", "028260.KS", "066570.KS", "003550.KS", "032830.KS", "096770.KS"),
    "미국 섹터 ETF": ("XLK", "XLF", "XLV", "XLE", "XLY", "XLP", "XLI", "XLB", "XLU", "XLRE", "XLC"),
}


@cached(600)
def _fng() -> dict:
    import alternative_me_data as am  # Fincept script

    res = quiet(am.get_crypto_fear_greed, 30)
    if not isinstance(res, dict) or "error" in res:
        return {}
    hist = [{"value": int(h.get("value") or 0), "label": h.get("value_classification"), "time": int(h.get("timestamp") or 0)}
            for h in res.get("history", []) if h.get("value")]
    cur = hist[0] if hist else {}
    return {
        "value": cur.get("value"),
        "label": cur.get("label"),
        "time": cur.get("time"),
        "avg30": res.get("30_day_average"),
        "yesterday": hist[1]["value"] if len(hist) > 1 else None,
        "week_ago": hist[7]["value"] if len(hist) > 7 else None,
        "history": list(reversed([h["value"] for h in hist])),
    }


def _breadth_group(name: str, syms: tuple) -> dict:
    rows = _robust_batch(syms)
    adv = sum(1 for r in rows if (r.get("change_percent") or 0) > 0)
    dec = sum(1 for r in rows if (r.get("change_percent") or 0) < 0)
    unch = len(rows) - adv - dec
    avg = float(np.mean([r["change_percent"] for r in rows if r.get("change_percent") is not None])) if rows else None
    return {"name": name, "advancers": adv, "decliners": dec, "unchanged": unch, "total": len(rows), "avg_change": avg}


def _vix_text(v):
    if v is None:
        return ""
    if v < 15:
        return "매우 안정 — 시장이 평온해요"
    if v < 20:
        return "보통 — 평균적인 변동성"
    if v < 30:
        return "불안 — 변동성이 커지고 있어요"
    return "공포 — 급락 위험이 큰 구간"


def pulse(q, body):
    """GET /api/markets/pulse → {fng, vix, breadth[], snapshot[]}"""
    out: dict = {}
    try:
        out["fng"] = _fng()
    except Exception:
        out["fng"] = {}
    snap_syms = ("^VIX", "^TNX", "DX-Y.NYB", "GC=F", "CL=F", "BTC-USD", "KRW=X")
    snap = {r["symbol"]: r for r in _robust_batch(snap_syms)}
    vix = snap.get("^VIX") or {}
    out["vix"] = {"value": vix.get("price"), "change_percent": vix.get("change_percent"), "text": _vix_text(vix.get("price"))}
    out["snapshot"] = [snap.get(s) or {"symbol": s} for s in snap_syms]
    out["breadth"] = [_breadth_group(k, v) for k, v in BREADTH.items()]
    return clean(out)


# --------------------------------------------------------------------------- #
# Multi-horizon returns (sector rotation)
# --------------------------------------------------------------------------- #
SECTORS = ("XLK", "XLC", "XLY", "XLF", "XLI", "XLV", "XLE", "XLB", "XLP", "XLU", "XLRE", "SPY")


@cached(900)
def _returns(symbols: tuple) -> list:
    close = _download_closes(list(symbols), "2y")
    out = []
    for s in symbols:
        if s not in close:
            out.append({"symbol": s})
            continue
        c = close[s].dropna()
        if len(c) < 2:
            out.append({"symbol": s})
            continue
        prev_year = c[c.index.year < c.index[-1].year]
        ytd = float(c.iloc[-1] / prev_year.iloc[-1] - 1) if len(prev_year) else None
        out.append({
            "symbol": s, "price": float(c.iloc[-1]),
            "1D": _ret(c, 1), "1W": _ret(c, 5), "1M": _ret(c, 21), "3M": _ret(c, 63),
            "6M": _ret(c, 126), "YTD": ytd, "1Y": _ret(c, 252),
            "spark": [round(float(x), 4) for x in c.iloc[-63:].tolist()],
        })
    return out


def returns(q, body):
    """GET /api/markets/returns?symbols=XLK,XLF  (default: SPDR sector ETFs + SPY)"""
    syms = tuple(check_symbols(q.get("symbols"), 1, 30)) if q.get("symbols") else SECTORS
    return clean({"rows": _returns(syms)})


# --------------------------------------------------------------------------- #
# Quote card
# --------------------------------------------------------------------------- #
@cached(3600)
def _name(sym: str) -> dict:
    try:
        with muted():
            fi = yf_ticker(sym).info or {}
        return {"name": fi.get("shortName") or fi.get("longName") or "", "currency": fi.get("currency") or "",
                "exchange": fi.get("fullExchangeName") or fi.get("exchange") or "",
                "market_cap": fi.get("marketCap"), "pe": fi.get("trailingPE"),
                "w52_high": fi.get("fiftyTwoWeekHigh") or None, "w52_low": fi.get("fiftyTwoWeekLow") or None,
                "avg_volume": fi.get("averageVolume")}
    except Exception:
        return {}


def quote_card(q, body):
    """GET /api/markets/quote?symbol=AAPL → quote + meta + intraday (5d/30m) closes"""
    sym = check_symbol(q.get("symbol") or "AAPL")
    qt = quote(sym)
    if not isinstance(qt, dict) or "error" in qt or qt.get("price") is None:
        rows = _robust_batch((sym,))
        if not rows:
            raise BadRequest(f"{sym}: 시세를 찾을 수 없습니다.")
        qt = rows[0]
    out = dict(qt)
    if any(not out.get(k) for k in ("open", "high", "low", "volume")):  # Yahoo sometimes zero-fills today's bar
        try:
            alt = (_robust_batch((sym,)) or [{}])[0]
        except Exception:
            alt = {}
        for k in ("open", "high", "low", "volume"):
            if not out.get(k):
                out[k] = alt.get(k) or None
    if out.get("price") and not out.get("change"):  # info.previousClose sometimes already rolled to today's close
        try:
            c = ohlcv(sym, "1mo", "1d")["close"].dropna()
            prev = float(c.iloc[-2] if abs(c.iloc[-1] / out["price"] - 1) < 1e-4 else c.iloc[-1])
            if prev and abs(prev / out["price"] - 1) > 1e-9:
                out.update(previous_close=prev, change=out["price"] - prev, change_percent=round((out["price"] / prev - 1) * 100, 2))
        except Exception:
            pass
    out.update({k: v for k, v in _name(sym).items() if v is not None})
    try:
        df = ohlcv(sym, "5d", "30m")
        out["intraday"] = [{"t": int(ts.timestamp()), "c": float(c)} for ts, c in df["close"].items()]
    except Exception:
        out["intraday"] = []
    return clean(out)


# --------------------------------------------------------------------------- #
# Forex
# --------------------------------------------------------------------------- #
CCYS = ("USD", "KRW", "EUR", "JPY", "CNY", "GBP", "AUD", "CAD", "CHF", "HKD", "SGD", "VND", "TWD", "INR",
        "THB", "NZD", "SEK", "NOK", "MXN", "BRL", "PHP", "IDR", "MYR", "ZAR", "TRY", "DKK", "PLN")


def _check_ccy(c, name="통화") -> str:
    c = str(c or "").strip().upper()
    if c not in CCYS:
        raise BadRequest(f"지원하지 않는 {name}입니다: {c or '(빈 값)'} — 지원: {', '.join(CCYS)}")
    return c


@cached(180)
def _usd_table() -> pd.DataFrame:
    """Daily units-of-currency per 1 USD for every supported currency (1y)."""
    syms = [f"{c}=X" for c in CCYS if c != "USD"]
    close = _download_closes(syms, "1y").ffill()
    close.columns = [c.replace("=X", "") for c in close.columns]
    close["USD"] = 1.0
    return close.dropna(how="all")


def _rate_series(a: str, b: str) -> pd.Series:
    t = _usd_table()
    return (t[b] / t[a]).dropna()


def fx_rates(q, body):
    """GET /api/markets/fx/rates?base=KRW → every currency vs base with 1D/1W/1M/3M/1Y change.

    Rows give the price of 1 unit of each currency in ``base`` (원화 기준: 1 USD = 1,340 KRW)."""
    base = _check_ccy(q.get("base") or "KRW", "기준 통화")
    t = _usd_table()
    rows = []
    for c in CCYS:
        if c == base:
            continue
        s = (t[base] / t[c]).dropna()
        if s.empty:
            continue
        rows.append({"ccy": c, "rate": float(s.iloc[-1]), "1D": _ret(s, 1), "1W": _ret(s, 5), "1M": _ret(s, 21),
                     "3M": _ret(s, 63), "1Y": _ret(s, 250), "hi52": float(s.max()), "lo52": float(s.min()),
                     "spark": [round(float(x), 6) for x in s.iloc[-30:].tolist()]})
    asof = t.index[-1].strftime("%Y-%m-%d") if len(t) else None
    return clean({"base": base, "asof": asof, "rows": rows})


def fx_convert(q, body):
    """GET /api/markets/fx/convert?amount=100&from=USD&to=KRW"""
    amt = num(q.get("amount"), "금액", 0, 1e15, 1)
    a, b = _check_ccy(q.get("from") or "USD", "출발 통화"), _check_ccy(q.get("to") or "KRW", "도착 통화")
    s = _rate_series(a, b) if a != b else pd.Series([1.0, 1.0])
    if s.empty:
        raise BadRequest("환율 데이터를 가져오지 못했습니다.")
    rate = float(s.iloc[-1])
    return clean({"amount": amt, "from": a, "to": b, "rate": rate, "inverse": 1 / rate if rate else None,
                  "result": amt * rate, "change_1d": _ret(s, 1), "change_1m": _ret(s, 21)})


def fx_matrix(q, body):
    """GET /api/markets/fx/matrix?ccys=USD,EUR,... → m[i][j] = 1 ccy_i in ccy_j, plus 1D % change."""
    raw = q.get("ccys") or "USD,EUR,JPY,GBP,CNY,KRW,AUD,CAD,CHF,HKD"
    ccys = []
    for c in raw.split(","):
        c = _check_ccy(c)
        if c not in ccys:
            ccys.append(c)
    if not 2 <= len(ccys) <= 14:
        raise BadRequest("통화는 2~14개를 고르세요.")
    t = _usd_table()
    last, prev = t.iloc[-1], t.iloc[-2]
    m = [[float(last[b] / last[a]) for b in ccys] for a in ccys]
    ch = [[(float((last[b] / last[a]) / (prev[b] / prev[a]) - 1) if a != b else 0.0) for b in ccys] for a in ccys]
    return clean({"ccys": ccys, "matrix": m, "change": ch})


FX_PERIODS = {"1mo", "3mo", "6mo", "ytd", "1y", "2y", "5y", "10y"}


def fx_chart(q, body):
    """GET /api/markets/fx/chart?from=USD&to=KRW&period=1y → candles + stats"""
    a, b = _check_ccy(q.get("from") or "USD", "출발 통화"), _check_ccy(q.get("to") or "KRW", "도착 통화")
    if a == b:
        raise BadRequest("서로 다른 두 통화를 고르세요.")
    period = check_period(q.get("period"), "1y")
    if period not in FX_PERIODS:
        raise BadRequest("기간 값이 올바르지 않습니다.")
    sym = f"{b}=X" if a == "USD" else f"{a}{b}=X"
    candles, source = [], sym
    try:
        df = ohlcv(sym, period, "1d")
        candles = [{"time": d.strftime("%Y-%m-%d"), "open": r.open, "high": r.high, "low": r.low, "close": r.close}
                   for d, r in df.iterrows()]
    except Exception:
        candles = []
    if len(candles) < 5:  # cross not listed → compute via USD
        close = _download_closes([f"{c}=X" for c in (a, b) if c != "USD"], period).ffill()
        close.columns = [c.replace("=X", "") for c in close.columns]
        close["USD"] = 1.0
        s = (close[b] / close[a]).dropna()
        candles = [{"time": d.strftime("%Y-%m-%d"), "open": v, "high": v, "low": v, "close": v} for d, v in s.items()]
        source = f"USD 경유 계산 ({a}→USD→{b})"
    if not candles:
        raise BadRequest("환율 차트 데이터를 가져오지 못했습니다.")
    c = pd.Series([x["close"] for x in candles], dtype=float)
    r = c.pct_change().dropna()
    stats = {
        "last": float(c.iloc[-1]), "first": float(c.iloc[0]), "change": float(c.iloc[-1] / c.iloc[0] - 1),
        "high": float(max(x["high"] for x in candles)), "low": float(min(x["low"] for x in candles)),
        "mean": float(c.mean()), "vol": float(r.std() * math.sqrt(252)) if len(r) > 2 else None,
        "best": float(r.max()) if len(r) else None, "worst": float(r.min()) if len(r) else None,
        "days": len(c),
    }
    return clean({"from": a, "to": b, "period": period, "source": source, "candles": candles, "stats": stats})


def fx_list(q, body):
    return {"ccys": list(CCYS)}


# --------------------------------------------------------------------------- #
# Robust quotes: core /api/quotes + fallback for symbols whose latest bar has a NaN close
# (Yahoo sometimes publishes an empty current-day row for CN/HK indices).
# --------------------------------------------------------------------------- #
@cached(60)
def _fallback_quotes(symbols: tuple) -> dict:
    yf = _yf()
    with muted():
        data = yf.download(list(symbols), period="10d", interval="1d", group_by="ticker", progress=False,
                           auto_adjust=True, threads=True, timeout=NET_TIMEOUT)
    out = {}
    for s in symbols:
        try:
            h = data[s] if isinstance(data.columns, pd.MultiIndex) else data
            h = h.dropna(subset=["Close"])
            if h.empty:
                continue
            last, prev = float(h["Close"].iloc[-1]), float(h["Close"].iloc[-2]) if len(h) > 1 else float(h["Close"].iloc[-1])
            out[s] = {"symbol": s, "price": last, "change": last - prev, "change_percent": round((last / prev - 1) * 100, 2) if prev else 0,
                      "high": float(h["High"].iloc[-1]), "low": float(h["Low"].iloc[-1]), "open": float(h["Open"].iloc[-1]),
                      "previous_close": prev, "volume": int(h["Volume"].iloc[-1] or 0), "stale": True}
        except Exception:
            continue
    return out


def _robust_batch(symbols: tuple) -> list:
    got = {r["symbol"]: r for r in batch_quotes(symbols) if r.get("price") is not None}
    missing = tuple(x for x in symbols if x not in got)
    if missing:
        try:
            got.update(_fallback_quotes(missing))
        except Exception:
            pass
    return [got[x] for x in symbols if x in got]


def robust_quotes(q, body):
    """GET /api/markets/quotes?symbols=...&names=1&spark=1 — same shape as /api/quotes."""
    from api.core import quotes as core_quotes

    res = core_quotes(q, body)
    missing = tuple(r["symbol"] for r in res["quotes"] if r.get("price") is None)
    if missing:
        try:
            fb = _fallback_quotes(missing)
        except Exception:
            fb = {}
        for r in res["quotes"]:
            if r["symbol"] in fb:
                r.update(fb[r["symbol"]])
    return clean(res)


ROUTES = {
    ("GET", "/api/markets/quotes"): robust_quotes,
    ("GET", "/api/markets/movers"): movers,
    ("GET", "/api/markets/news"): news,
    ("GET", "/api/markets/pulse"): pulse,
    ("GET", "/api/markets/returns"): returns,
    ("GET", "/api/markets/quote"): quote_card,
    ("GET", "/api/markets/fx/rates"): fx_rates,
    ("GET", "/api/markets/fx/convert"): fx_convert,
    ("GET", "/api/markets/fx/matrix"): fx_matrix,
    ("GET", "/api/markets/fx/chart"): fx_chart,
    ("GET", "/api/markets/fx/list"): fx_list,
}

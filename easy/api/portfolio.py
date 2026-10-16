"""포트폴리오 — 거래내역 기반 보유현황, NAV 재생(replay), 성과·위험, 최적화, 상관관계.

모든 엔드포인트는 브라우저가 보관하는 거래내역(transactions)을 받아 계산합니다.
거래 가격은 각 종목의 현지 통화(예: 005930.KS → KRW), 결과 금액은 포트폴리오
기준 통화(USD 또는 KRW)로 환산됩니다. 환율은 yfinance의 "{통화}=X"(1 USD당 통화) 종가.
"""

from __future__ import annotations

import json
import math
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime

import numpy as np
import pandas as pd

from api.common import (
    TRADING_DAYS,
    BadRequest,
    cached,
    check_period,
    check_symbol,
    check_symbols,
    clean,
    dates,
    info,
    num,
    quiet,
    series_stats,
    yfd,
)

BASES = ("USD", "KRW")
SUFFIX_CCY = {
    ".KS": "KRW", ".KQ": "KRW", ".T": "JPY", ".HK": "HKD", ".DE": "EUR", ".PA": "EUR", ".AS": "EUR",
    ".MI": "EUR", ".TO": "CAD", ".AX": "AUD", ".NS": "INR", ".BO": "INR", ".SS": "CNY", ".SZ": "CNY",
    ".L": "GBP", ".SW": "CHF", ".TW": "TWD",
}
MARKET_INDEX = {"KRW": "^KS11", "JPY": "^N225", "HKD": "^HSI", "EUR": "^STOXX50E", "GBP": "^FTSE"}
_POOL = ThreadPoolExecutor(max_workers=8)


# --------------------------------------------------------------------------- #
# helpers
# --------------------------------------------------------------------------- #
def ccy_of(sym: str) -> str:
    for suf, c in SUFFIX_CCY.items():
        if sym.endswith(suf):
            return c
    return "USD"


def _safe_info(sym: str) -> dict:
    try:
        return info(sym)
    except Exception:
        return {}


def _pmap(fn, items):
    return list(_POOL.map(fn, items))


def _period_for(start: pd.Timestamp, min_years: float = 1.0) -> str:
    yrs = max((pd.Timestamp.today() - start).days / 365.25, min_years)
    for p, y in (("1y", 0.95), ("2y", 1.95), ("5y", 4.9), ("10y", 9.9)):
        if yrs <= y:
            return p
    return "max"


@cached(300)
def daily(symbol: str, period: str = "1y") -> pd.DataFrame:
    """Daily OHLCV with correct *local* trading dates.

    common.ohlcv normalises the UTC timestamp, which labels Asian bars (midnight KST =
    15:00 UTC of the previous day) one day early. Shifting by +12h before normalising
    gives the right date for Asia, Europe and the US alike.
    """
    rows = quiet(yfd.get_historical_period, symbol, period, "1d")
    if isinstance(rows, dict) or not rows:
        msg = rows.get("error") if isinstance(rows, dict) else "데이터 없음"
        raise BadRequest(f"{symbol}: 가격 데이터를 가져오지 못했습니다 ({msg}).")
    df = pd.DataFrame(rows)
    df.index = pd.DatetimeIndex(pd.to_datetime(df.pop("timestamp"), unit="s") + pd.Timedelta(hours=12)).normalize()
    df = df[~df.index.duplicated(keep="last")].astype(float)
    return df.dropna(subset=["close"])


def _close(sym: str, period: str) -> pd.Series:
    s = daily(sym, period)["close"].copy()
    s.name = sym
    return s


def _fx(ccy: str, period: str) -> pd.Series | None:
    """Units of ``ccy`` per 1 USD (None for USD)."""
    if ccy == "USD":
        return None
    return _close(f"{ccy}=X", period)


def _parse_date(s) -> pd.Timestamp:
    try:
        d = datetime.strptime(str(s)[:10], "%Y-%m-%d")
    except ValueError:
        raise BadRequest(f"날짜 형식이 올바르지 않습니다: {s} (YYYY-MM-DD)")
    if d.date() > date.today() + pd.Timedelta(days=1):  # 1-day slack for time zones
        raise BadRequest(f"미래 날짜의 거래는 입력할 수 없습니다: {s}")
    if d.year < 1980:
        raise BadRequest(f"날짜가 너무 오래되었습니다: {s}")
    return pd.Timestamp(d)


def _check_txns(raw) -> list[dict]:
    if not isinstance(raw, list) or not raw:
        raise BadRequest("거래내역이 비어 있습니다. BUY 버튼으로 첫 거래를 추가하세요.")
    if len(raw) > 3000:
        raise BadRequest("거래내역은 최대 3000건까지 분석할 수 있습니다.")
    out = []
    for i, t in enumerate(raw):
        if not isinstance(t, dict):
            raise BadRequest("거래 형식이 올바르지 않습니다.")
        typ = str(t.get("type", "")).upper()
        if typ in ("DIVIDEND",):
            typ = "DIV"
        if typ not in ("BUY", "SELL", "DIV"):
            raise BadRequest(f"거래 유형은 BUY/SELL/DIV 중 하나여야 합니다 ({typ or '빈 값'}).")
        out.append({
            "i": i, "date": _parse_date(t.get("date")), "symbol": check_symbol(t.get("symbol")), "type": typ,
            "qty": num(t.get("qty", t.get("quantity")), "수량", 0, 1e12),
            "price": num(t.get("price"), "가격", 0, 1e12),
            "fee": num(t.get("fee"), "수수료", 0, 1e12, default=0),
        })
        if out[-1]["qty"] <= 0 and typ != "DIV":
            raise BadRequest(f"{out[-1]['symbol']}: 수량은 0보다 커야 합니다.")
    out.sort(key=lambda x: (x["date"], {"BUY": 0, "DIV": 1, "SELL": 2}[x["type"]], x["i"]))
    if len({t["symbol"] for t in out}) > 30:
        raise BadRequest("종목은 최대 30개까지 지원합니다.")
    return out


def _ols(y: np.ndarray, X: np.ndarray) -> dict:
    """OLS with intercept. Returns coef (first=intercept), t-stats, R²."""
    X1 = np.column_stack([np.ones(len(y)), X])
    coef, *_ = np.linalg.lstsq(X1, y, rcond=None)
    resid = y - X1 @ coef
    dof = max(len(y) - X1.shape[1], 1)
    s2 = resid @ resid / dof
    cov = s2 * np.linalg.pinv(X1.T @ X1)
    se = np.sqrt(np.clip(np.diag(cov), 1e-30, None))
    ss_tot = ((y - y.mean()) ** 2).sum()
    return {"coef": coef, "t": coef / se, "r2": 1 - (resid @ resid) / ss_tot if ss_tot else 0.0, "resid": resid}


def _ncdf(x):
    return 0.5 * (1 + math.erf(x / math.sqrt(2)))


def _npdf(x):
    return math.exp(-x * x / 2) / math.sqrt(2 * math.pi)


# --------------------------------------------------------------------------- #
# core model: holdings + NAV replay (cached by request content)
# --------------------------------------------------------------------------- #
def _key(body: dict) -> str:
    txns = body.get("transactions") or body.get("txns")
    base = str(body.get("base") or "USD").upper()
    bench = body.get("benchmark") or ("^KS11" if base == "KRW" else "SPY")
    return json.dumps({"t": txns, "b": base, "m": bench}, sort_keys=True, default=str)


def model(body: dict) -> dict:
    return _model(_key(body))


@cached(240)
def _model(key: str) -> dict:
    req = json.loads(key)
    base = req["b"]
    if base not in BASES:
        raise BadRequest("기준 통화는 USD 또는 KRW만 지원합니다.")
    bench = check_symbol(req["m"])
    txns = _check_txns(req["t"])
    syms = list(dict.fromkeys(t["symbol"] for t in txns))
    start = txns[0]["date"]
    period = _period_for(start)

    infos = dict(zip(syms, _pmap(_safe_info, syms)))
    ccys = {}
    for s in syms:
        c = str(infos[s].get("currency") or "") or ccy_of(s)
        ccys[s] = c.upper() if c != "GBp" else "GBP"
    fx_needed = sorted({c for c in ccys.values() if c != "USD"} | ({"KRW"} if base == "KRW" else set()))

    def load(sym):
        try:
            return sym, _close(sym, period)
        except Exception:
            return sym, None

    loaded = dict(_pmap(load, syms + [bench]))
    fx = dict(zip(fx_needed, _pmap(lambda c: _fx(c, period), fx_needed)))
    missing = [s for s in syms if loaded.get(s) is None or loaded[s].empty]
    if len(missing) == len(syms):
        raise BadRequest("보유 종목의 가격 데이터를 가져오지 못했습니다. 종목 코드를 확인하세요.")
    pence = {s: 0.01 if infos[s].get("currency") == "GBp" else 1.0 for s in syms}

    # calendar = business days from first transaction to latest price
    last_day = max(loaded[s].index[-1] for s in syms if s not in missing)
    cal = pd.bdate_range(min(start, last_day), last_day)
    px = pd.DataFrame({s: loaded[s].reindex(loaded[s].index.union(cal)).ffill().reindex(cal) * pence[s]
                       for s in syms if s not in missing})
    px = px.bfill()

    def conv_series(ccy):  # local → base multiplier on calendar
        def per_usd(c):
            if c == "USD":
                return pd.Series(1.0, index=cal)
            f = fx[c]
            return f.reindex(f.index.union(cal)).ffill().reindex(cal).bfill()
        return per_usd(base) / per_usd(ccy)

    conv = pd.DataFrame({s: conv_series(ccys[s]) for s in syms})

    def conv_at(sym, d):
        i = min(cal.searchsorted(d), len(cal) - 1)
        return float(conv[sym].iloc[i])

    # ---- event loop: holdings, cost basis (base), realised P&L, flows -------
    H = {s: {"qty": 0.0, "cost": 0.0, "cost_base": 0.0, "realized": 0.0, "realized_base": 0.0,
             "div": 0.0, "div_base": 0.0, "fees": 0.0, "buys": 0, "sells": 0, "first": None} for s in syms}
    qty_steps = {s: [] for s in syms}
    flows = pd.Series(0.0, index=cal)
    divs = pd.Series(0.0, index=cal)
    cost_steps = []
    warnings = []
    for t in txns:
        s, h = t["symbol"], H[t["symbol"]]
        c = conv_at(s, t["date"])
        di = cal[min(cal.searchsorted(t["date"]), len(cal) - 1)]
        h["fees"] += t["fee"]
        if t["type"] == "BUY":
            amt = t["qty"] * t["price"] + t["fee"]
            h["qty"] += t["qty"]; h["cost"] += amt; h["cost_base"] += amt * c; h["buys"] += 1
            h["first"] = h["first"] or t["date"]
            flows[di] += amt * c
        elif t["type"] == "SELL":
            q = t["qty"]
            if q > h["qty"] + 1e-9:
                warnings.append(f"{s} {t['date'].date()}: 보유 수량({h['qty']:g})보다 많이 매도 → 보유분만 반영")
                q = h["qty"]
            if q <= 0:
                continue
            frac = q / h["qty"]
            proceeds = q * t["price"] - t["fee"]
            h["realized"] += proceeds - h["cost"] * frac
            h["realized_base"] += proceeds * c - h["cost_base"] * frac
            h["cost"] -= h["cost"] * frac; h["cost_base"] -= h["cost_base"] * frac
            h["qty"] -= q; h["sells"] += 1
            flows[di] -= proceeds * c
            t = {**t, "qty": q}
        else:  # DIV: qty × price = 배당금 (현지 통화)
            amt = t["qty"] * t["price"] - t["fee"]
            h["div"] += amt; h["div_base"] += amt * c
            divs[di] += amt * c
        if t["type"] in ("BUY", "SELL"):
            qty_steps[s].append((di, h["qty"]))
        cost_steps.append((di, sum(x["cost_base"] for x in H.values())))

    qty = pd.DataFrame(index=cal)
    for s in syms:
        q = pd.Series(np.nan, index=cal)
        for d, v in qty_steps[s]:
            q[d] = v
        qty[s] = q.ffill().fillna(0.0)
    held = [s for s in syms if s not in missing]
    val_local = qty[held] * px[held]
    val_base = val_local * conv[held]
    nav = val_base.sum(axis=1)
    cost_line = pd.Series(np.nan, index=cal)
    for d, v in cost_steps:
        cost_line[d] = v
    cost_line = cost_line.ffill().fillna(0.0)

    # time-weighted daily returns (flows at start of day, dividends as income)
    prev = nav.shift(1).fillna(0.0)
    denom = prev + flows.clip(lower=0)
    r = ((nav - prev - flows + divs) / denom.where(denom > 0)).fillna(0.0)
    r = r.clip(-0.9, 5)
    first = int(np.argmax(denom.values > 0)) if (denom > 0).any() else 0
    r = r.iloc[first:]
    twr = (1 + r).cumprod()

    # benchmark aligned to calendar
    b = loaded.get(bench)
    bench_idx = None
    if b is not None and not b.empty:
        bb = b.reindex(b.index.union(cal)).ffill().reindex(cal).bfill().iloc[first:]
        bench_idx = bb / bb.iloc[0]

    # ---- holdings snapshot ----------------------------------------------------
    total_val = float(nav.iloc[-1])
    rows = []
    for s in syms:
        h, inf = H[s], infos[s]
        if s in missing:
            last = prevc = None
            spark = []
        else:
            ser = loaded[s] * pence[s]
            last, prevc = float(ser.iloc[-1]), float(ser.iloc[-2]) if len(ser) > 1 else None
            spark = [round(float(v), 4) for v in ser.iloc[-30:]]
        cnow = float(conv[s].iloc[-1])
        mv = h["qty"] * last * cnow if last is not None else None
        pnl = mv - h["cost_base"] if mv is not None and h["qty"] > 0 else None
        sector = inf.get("sector") or ("ETF" if inf.get("quoteType") == "ETF" else
                                      "암호화폐" if inf.get("quoteType") == "CRYPTOCURRENCY" else "기타")
        rows.append({
            "symbol": s, "name": inf.get("shortName") or inf.get("longName") or s, "sector": sector,
            "industry": inf.get("industry"), "currency": ccys[s], "qty": h["qty"],
            "avg_cost": h["cost"] / h["qty"] if h["qty"] > 0 else None, "last": last, "prev": prevc,
            "day_chg_pct": (last / prevc - 1) if last and prevc else None,
            "day_chg": h["qty"] * (last - prevc) * cnow if last and prevc else None,
            "mkt_val": mv, "cost_basis": h["cost_base"], "pnl": pnl,
            "pnl_pct": pnl / h["cost_base"] if pnl is not None and h["cost_base"] > 0 else None,
            "realized": h["realized_base"], "dividends": h["div_base"], "fees": h["fees"],
            "weight": (mv / total_val) if mv and total_val > 0 else 0.0, "fx": cnow,
            "buys": h["buys"], "sells": h["sells"], "spark": spark, "missing": s in missing,
            "beta": None,
        })
    open_rows = [x for x in rows if x["qty"] > 1e-12]
    closed_rows = [x for x in rows if x["qty"] <= 1e-12]
    return {
        "base": base, "benchmark": bench, "period": period, "syms": syms, "held": held, "ccys": ccys,
        "rows": rows, "open": open_rows, "closed": closed_rows, "missing": missing, "warnings": warnings,
        "nav": nav, "cost_line": cost_line, "twr": twr, "ret": r, "bench_idx": bench_idx,
        "px": px, "conv": conv, "loaded": loaded, "total": total_val, "first": first, "cal": cal,
    }


def _risk_core(m: dict) -> dict:
    r = m["ret"].iloc[1:] if len(m["ret"]) > 1 else m["ret"]
    r1y = r.iloc[-TRADING_DAYS:]
    vol = float(r1y.std() * math.sqrt(TRADING_DAYS)) if len(r1y) > 5 else None
    vol30 = float(r.iloc[-21:].std() * math.sqrt(TRADING_DAYS)) if len(r) > 10 else None
    mu = float(r1y.mean() * TRADING_DAYS) if len(r1y) else None
    sharpe = (mu - 0.03) / vol if vol else None
    twr = m["twr"]
    mdd = float((twr / twr.cummax() - 1).min()) if len(twr) else None
    beta = None
    if m["bench_idx"] is not None and len(r1y) > 20:
        br = m["bench_idx"].pct_change().reindex(r1y.index).fillna(0)
        v = br.var()
        beta = float(r1y.cov(br) / v) if v else None
    w = np.array([x["weight"] for x in m["open"]])
    return {"sharpe": sharpe, "beta": beta, "mdd": mdd, "vol": vol, "vol30": vol30,
            "conc_top": float(w.max()) if len(w) else None, "hhi": float((w ** 2).sum()) if len(w) else None,
            "n_eff": float(1 / (w ** 2).sum()) if len(w) and (w ** 2).sum() else None}


# --------------------------------------------------------------------------- #
# endpoints
# --------------------------------------------------------------------------- #
def analyze(q, body):
    """POST /api/portfolio/analyze {transactions, base, benchmark} → 보유현황 전체."""
    m = model(body)
    rows = m["open"]
    tot = m["total"]
    cost = sum(x["cost_basis"] for x in rows)
    unreal = sum(x["pnl"] or 0 for x in rows)
    day = sum(x["day_chg"] or 0 for x in rows)
    realized = sum(x["realized"] for x in m["rows"])
    divs = sum(x["dividends"] for x in m["rows"])
    sectors: dict[str, float] = {}
    for x in rows:
        sectors[x["sector"]] = sectors.get(x["sector"], 0) + (x["mkt_val"] or 0)
    sec = sorted(({"sector": k, "value": v, "weight": v / tot if tot else 0,
                   "count": sum(1 for x in rows if x["sector"] == k)} for k, v in sectors.items()),
                 key=lambda d: -d["value"])
    # correlation of the top-6 holdings by weight (1y daily, local currency)
    top = [x["symbol"] for x in sorted(rows, key=lambda d: -(d["weight"] or 0)) if not x["missing"]][:6]
    corr = None
    if len(top) >= 2:
        try:
            rets = pd.concat([_close(s, "1y").pct_change() for s in top], axis=1)
            corr = {"symbols": top, "matrix": rets.corr(min_periods=30).round(3).values.tolist()}
        except Exception:
            corr = None
    twr, nav = m["twr"], m["nav"]
    idx = twr.index
    perf = {
        "dates": dates(idx),
        "nav": nav.reindex(idx).round(2).tolist(),
        "cost": m["cost_line"].reindex(idx).round(2).tolist(),
        "twr": twr.round(6).tolist(),
        "bench": m["bench_idx"].reindex(idx).round(6).tolist() if m["bench_idx"] is not None else None,
    }
    gainers = sum(1 for x in rows if (x["pnl"] or 0) > 0)
    return clean({
        "base": m["base"], "benchmark": m["benchmark"],
        "summary": {
            "value": tot, "cost": cost, "unrealized": unreal, "unrealized_pct": unreal / cost if cost else None,
            "day": day, "day_pct": day / (tot - day) if tot - day else None, "realized": realized, "dividends": divs,
            "total_pnl": unreal + realized + divs, "positions": len(rows), "gainers": gainers,
            "losers": len(rows) - gainers, "twr_total": float(twr.iloc[-1] - 1) if len(twr) else None,
            "inception": dates(idx[:1])[0] if len(idx) else None,
            "fx_usdkrw": _usdkrw(),
        },
        "risk": _risk_core(m),
        "holdings": rows, "closed": m["closed"], "sectors": sec, "correlation": corr, "performance": perf,
        "missing": m["missing"], "warnings": m["warnings"],
    })


SCENARIOS = [
    {"id": "gfc", "name": "2008 글로벌 금융위기", "desc": "리먼 파산 · S&P500 −56.8%, 코스피 −54.5%, 원/달러 +50%",
     "shock": {"USD": -0.568, "KRW": -0.545, "other": -0.55}, "fx": 0.50},
    {"id": "dotcom", "name": "2000 닷컴 버블 붕괴", "desc": "기술주 거품 붕괴 · S&P500 −49.1%, 코스피 −52%",
     "shock": {"USD": -0.491, "KRW": -0.52, "other": -0.45}, "fx": 0.10},
    {"id": "covid", "name": "2020 코로나 폭락", "desc": "팬데믹 공포 · S&P500 −33.9%, 코스피 −35.7%, 원/달러 +10%",
     "shock": {"USD": -0.339, "KRW": -0.357, "other": -0.33}, "fx": 0.10},
    {"id": "rate22", "name": "2022 금리 쇼크", "desc": "급격한 금리 인상 · S&P500 −25.4%, 코스피 −28%, 원/달러 +21%",
     "shock": {"USD": -0.254, "KRW": -0.28, "other": -0.22}, "fx": 0.21},
    {"id": "bm87", "name": "1987 블랙먼데이 (하루)", "desc": "하루 만에 S&P500 −20.5%",
     "shock": {"USD": -0.205, "KRW": -0.10, "other": -0.15}, "fx": 0.0},
    {"id": "mild", "name": "일반 조정 −10%", "desc": "흔히 1~2년에 한 번 오는 10% 조정 (가상)",
     "shock": {"USD": -0.10, "KRW": -0.10, "other": -0.10}, "fx": 0.03},
]


@cached(1800)
def _beta_vs(sym: str, idx: str) -> float | None:
    try:
        a = pd.concat([_close(sym, "2y"), _close(idx, "2y")], axis=1).ffill().pct_change().dropna()
        if len(a) < 60:
            return None
        return float(a.iloc[:, 0].cov(a.iloc[:, 1]) / a.iloc[:, 1].var())
    except Exception:
        return None


def risk(q, body):
    """POST /api/portfolio/risk → 기간 수익률, 롤링 변동성, 낙폭, VaR/CVaR, 베타·알파, 기여도, 스트레스 테스트."""
    m = model(body)
    r = m["ret"].iloc[1:]
    if len(r) < 10:
        raise BadRequest("성과·위험 분석에는 최소 10거래일 이상의 기록이 필요합니다.")
    twr, bidx = m["twr"], m["bench_idx"]
    idx = twr.index
    today = idx[-1]

    def ret_since(series, start):
        s = series[series.index >= start]
        return float(series.iloc[-1] / s.iloc[0] - 1) if len(s) > 1 else None

    periods = []
    for lab, start in (("1개월", today - pd.DateOffset(months=1)), ("3개월", today - pd.DateOffset(months=3)),
                       ("6개월", today - pd.DateOffset(months=6)), ("연초 이후", pd.Timestamp(today.year, 1, 1)),
                       ("1년", today - pd.DateOffset(years=1)), ("3년", today - pd.DateOffset(years=3)),
                       ("전체", idx[0])):
        if start < idx[0] and lab != "전체":
            continue
        p = ret_since(twr, start)
        bm = ret_since(bidx, start) if bidx is not None else None
        periods.append({"label": lab, "port": p, "bench": bm, "excess": p - bm if p is not None and bm is not None else None})

    rv21 = r.rolling(21).std() * math.sqrt(TRADING_DAYS)
    rv63 = r.rolling(63).std() * math.sqrt(TRADING_DAYS)
    dd = twr / twr.cummax() - 1
    bdd = (bidx / bidx.cummax() - 1) if bidx is not None else None

    r1 = r.iloc[-TRADING_DAYS:]
    mu, sd = float(r1.mean()), float(r1.std())
    nav = m["total"]
    var = {}
    for c, z in ((0.95, 1.6449), (0.99, 2.3263)):
        q_ = float(np.percentile(r1, (1 - c) * 100))
        tail = r1[r1 <= q_]
        var[str(int(c * 100))] = {
            "hist_var": -q_, "hist_cvar": -float(tail.mean()) if len(tail) else None,
            "param_var": -(mu - z * sd), "param_cvar": -(mu - sd * _npdf(z) / (1 - c)),
        }
    hist, edges = np.histogram(r1 * 100, bins=40)

    capm = None
    if bidx is not None:
        br = bidx.pct_change().reindex(r.index).fillna(0)
        rr, bb = r.iloc[-TRADING_DAYS:], br.iloc[-TRADING_DAYS:]
        o = _ols(rr.values, bb.values.reshape(-1, 1))
        te = float((rr - bb).std() * math.sqrt(TRADING_DAYS))
        up, dn = bb > 0, bb < 0
        capm = {"alpha": float(o["coef"][0] * TRADING_DAYS), "beta": float(o["coef"][1]), "r2": float(o["r2"]),
                "alpha_t": float(o["t"][0]), "corr": float(rr.corr(bb)), "tracking_error": te,
                "info_ratio": float((rr.mean() - bb.mean()) * TRADING_DAYS / te) if te else None,
                "up_capture": float(rr[up].mean() / bb[up].mean()) if up.any() and bb[up].mean() else None,
                "down_capture": float(rr[dn].mean() / bb[dn].mean()) if dn.any() and bb[dn].mean() else None,
                "bench_vol": float(bb.std() * math.sqrt(TRADING_DAYS))}

    # contribution: total P&L by holding + 1y return contribution (weight × 1y return in base ccy)
    contrib = []
    total_pnl = sum((x["pnl"] or 0) + x["realized"] + x["dividends"] for x in m["rows"])
    for x in m["rows"]:
        p = (x["pnl"] or 0) + x["realized"] + x["dividends"]
        r1y = None
        if not x["missing"]:
            pb = (m["px"][x["symbol"]] * m["conv"][x["symbol"]]).dropna()
            pb = pb[pb.index >= today - pd.DateOffset(years=1)]
            r1y = float(pb.iloc[-1] / pb.iloc[0] - 1) if len(pb) > 1 else None
        contrib.append({"symbol": x["symbol"], "pnl": p, "unrealized": x["pnl"], "realized": x["realized"],
                        "dividends": x["dividends"], "share": p / total_pnl if total_pnl else None,
                        "weight": x["weight"], "ret_1y": r1y,
                        "contrib_1y": x["weight"] * r1y if r1y is not None else None})
    contrib.sort(key=lambda d: -(d["pnl"] or 0))

    # stress test: holding beta vs its home index × index shock, plus FX move for foreign holdings
    base = m["base"]
    betas = {}
    jobs = [(x["symbol"], MARKET_INDEX.get(x["currency"], "^GSPC")) for x in m["open"] if not x["missing"]]
    for (s, ix), bval in zip(jobs, _pmap(lambda j: _beta_vs(*j), jobs)):
        betas[s] = bval if bval is not None else 1.0
    stress = []
    for sc in SCENARIOS:
        items, loss = [], 0.0
        for x in m["open"]:
            if x["missing"] or not x["mkt_val"]:
                continue
            idx_shock = sc["shock"].get(x["currency"], sc["shock"]["other"])
            eq = max(-0.95, betas.get(x["symbol"], 1.0) * idx_shock)
            # FX: KRW weakens by sc["fx"] (KRW per USD rises). Effect on value in base currency.
            fxm = 1.0
            if base == "KRW" and x["currency"] != "KRW":
                fxm = 1 + sc["fx"]
            elif base == "USD" and x["currency"] == "KRW":
                fxm = 1 / (1 + sc["fx"])
            new = x["mkt_val"] * (1 + eq) * fxm
            items.append({"symbol": x["symbol"], "beta": betas.get(x["symbol"]), "equity_shock": eq,
                          "fx_mult": fxm, "impact": new - x["mkt_val"], "impact_pct": new / x["mkt_val"] - 1})
            loss += new - x["mkt_val"]
        stress.append({**{k: sc[k] for k in ("id", "name", "desc", "fx")}, "us": sc["shock"]["USD"],
                       "kr": sc["shock"]["KRW"], "impact": loss, "impact_pct": loss / nav if nav else None,
                       "items": sorted(items, key=lambda d: d["impact"])})
    monthly = twr.resample("ME").last().pct_change()
    monthly.iloc[0] = twr.resample("ME").last().iloc[0] - 1
    mrows = {}
    for d, v in monthly.items():
        mrows.setdefault(d.year, [None] * 12)[d.month - 1] = v
    st = series_stats(twr)
    return clean({
        "base": base, "benchmark": m["benchmark"], "nav": nav, "periods": periods, "stats": st,
        "dates": dates(idx), "twr": twr.round(6).tolist(),
        "bench": bidx.round(6).tolist() if bidx is not None else None,
        "rolling": {"dates": dates(r.index), "vol21": rv21.round(4).tolist(), "vol63": rv63.round(4).tolist()},
        "drawdown": {"port": dd.round(4).tolist(), "bench": bdd.round(4).tolist() if bdd is not None else None},
        "var": var, "var_window": len(r1), "hist": {"counts": hist.tolist(), "edges": np.round(edges, 3).tolist()},
        "capm": capm, "contribution": contrib, "stress": stress, "betas": betas,
        "monthly": [{"year": y, "months": v} for y, v in sorted(mrows.items())],
    })


# ---------------------------- optimisation --------------------------------- #
def _risk_parity(cov: np.ndarray, iters: int = 500) -> np.ndarray:
    n = len(cov)
    w = np.full(n, 1 / n)
    for _ in range(iters):
        rc = w * (cov @ w)
        tgt = rc.sum() / n
        w = w * np.sqrt(tgt / np.clip(rc, 1e-18, None))
        w = w / w.sum()
    return w


def _refine(w0, score, rng, steps=1500):
    best, bs = w0.copy(), score(w0)
    scale = 0.08
    for i in range(steps):
        cand = np.clip(best + rng.normal(0, scale, len(best)), 0, None)
        if cand.sum() <= 0:
            continue
        cand /= cand.sum()
        sc = score(cand)
        if sc > bs:
            best, bs = cand, sc
        if i % 300 == 299:
            scale *= 0.5
    return best


def optimize(q, body):
    """POST /api/portfolio/optimize {transactions, base, period, rf, max_weight}."""
    m = model(body)
    period = check_period(body.get("period"), "2y")
    rf = num(body.get("rf"), "무위험 이자율", 0, 0.2, default=0.03)
    maxw = num(body.get("max_weight"), "최대 비중", 0.05, 1, default=1)
    hold = [x for x in m["open"] if not x["missing"]]
    if len(hold) < 2:
        raise BadRequest("최적화에는 보유 종목이 2개 이상 필요합니다.")
    syms = [x["symbol"] for x in hold]
    n = len(syms)
    if maxw * n < 1:
        maxw = 1 / n

    base = m["base"]

    def base_px(s):
        p = _close(s, period)
        c = m["ccys"][s]
        if c == base:
            return p
        perusd = lambda cc: (pd.Series(1.0, index=p.index) if cc == "USD"  # noqa: E731
                             else _close(f"{cc}=X", period).reindex(p.index.union(_close(f"{cc}=X", period).index)).ffill().reindex(p.index))
        return p * perusd(base) / perusd(c)

    prices = pd.concat([base_px(s).rename(s) for s in syms], axis=1).ffill().dropna()
    if len(prices) < 60:
        raise BadRequest("공통 거래일이 너무 적습니다. 기간을 늘려 보세요.")
    rets = prices.pct_change().dropna()
    mu = rets.mean().values * TRADING_DAYS
    cov = rets.cov().values * TRADING_DAYS

    rng = np.random.default_rng(42)
    w = np.vstack([rng.dirichlet(np.full(n, a), size=k) for a, k in ((1.0, 6000), (0.3, 4000), (0.1, 3000))])
    w = np.vstack([w, np.eye(n), np.full((1, n), 1 / n)])
    ok = (w <= maxw + 1e-9).all(axis=1)
    w = w[ok] if ok.sum() > 50 else w
    pr = w @ mu
    pv = np.sqrt(np.einsum("ij,jk,ik->i", w, cov, w))
    sh = (pr - rf) / pv

    def proj(x):
        for _ in range(50):
            x = np.clip(x, 0, maxw)
            x = x / x.sum()
            if x.max() <= maxw + 1e-9:
                break
        return x

    def sc_sharpe(x):
        x = proj(x)
        v = math.sqrt(x @ cov @ x)
        return (x @ mu - rf) / v if v else -1e9

    def sc_minvol(x):
        x = proj(x)
        return -math.sqrt(x @ cov @ x)

    w_ms = proj(_refine(w[int(np.argmax(sh))], sc_sharpe, rng))
    w_mv = proj(_refine(w[int(np.argmin(pv))], sc_minvol, rng))
    w_rp = proj(_risk_parity(cov))
    cur = np.array([x["weight"] for x in hold], dtype=float)
    cur = cur / cur.sum() if cur.sum() > 0 else np.full(n, 1 / n)

    def pack(x):
        r_ = float(x @ mu)
        v_ = float(math.sqrt(x @ cov @ x))
        curve = (1 + rets.values @ x).cumprod()
        dd = curve / np.maximum.accumulate(curve) - 1
        rc = x * (cov @ x)
        return {"weights": np.round(x, 4).tolist(), "ret": r_, "vol": v_, "sharpe": (r_ - rf) / v_ if v_ else None,
                "max_drawdown": float(dd.min()), "curve": np.round(curve, 5).tolist(),
                "risk_contrib": np.round(rc / rc.sum(), 4).tolist() if rc.sum() else None,
                "div_ratio": float(x @ np.sqrt(np.diag(cov)) / v_) if v_ else None}

    ports = {"current": pack(cur), "max_sharpe": pack(w_ms), "min_vol": pack(w_mv),
             "risk_parity": pack(w_rp), "equal": pack(np.full(n, 1 / n))}

    # efficient frontier = upper envelope of the cloud (+ refined points)
    allv = np.concatenate([pv, [ports[k]["vol"] for k in ports]])
    allr = np.concatenate([pr, [ports[k]["ret"] for k in ports]])
    vmin = ports["min_vol"]["vol"]
    bins = np.linspace(vmin, allv.max(), 40)
    front = []
    best = -1e9
    for i in range(len(bins) - 1):
        sel = (allv >= bins[i]) & (allv < bins[i + 1] + 1e-12)
        if sel.any():
            j = np.argmax(np.where(sel, allr, -1e9))
            if allr[j] > best:
                best = allr[j]
                front.append({"vol": float(allv[j]), "ret": float(allr[j])})
    sample = rng.choice(len(w), size=min(2000, len(w)), replace=False)

    total = m["total"]
    trades = {}
    for k in ports:
        tw = np.array(ports[k]["weights"])
        lst = []
        for i, x in enumerate(hold):
            dv = (tw[i] - cur[i]) * total
            unit = x["last"] * x["fx"] if x["last"] else None
            sh_ = dv / unit if unit else None
            lst.append({"symbol": x["symbol"], "current": float(cur[i]), "target": float(tw[i]), "delta_value": dv,
                        "shares": sh_, "shares_round": int(round(sh_)) if sh_ is not None else None,
                        "price": x["last"], "currency": x["currency"],
                        "action": "HOLD" if not sh_ or round(sh_) == 0 or abs(dv) < total * 0.002 else "BUY" if dv > 0 else "SELL"})
        trades[k] = lst
    assets = [{"symbol": s, "ret": float(mu[i]), "vol": float(math.sqrt(cov[i, i])),
               "sharpe": float((mu[i] - rf) / math.sqrt(cov[i, i])) if cov[i, i] else None} for i, s in enumerate(syms)]
    return clean({
        "symbols": syms, "base": base, "period": period, "rf": rf, "max_weight": maxw, "total": total,
        "dates": dates(rets.index), "assets": assets, "portfolios": ports, "frontier": front,
        "cloud": {"vol": np.round(pv[sample], 4).tolist(), "ret": np.round(pr[sample], 4).tolist(),
                  "sharpe": np.round(sh[sample], 3).tolist()},
        "trades": trades, "correlation": rets.corr().round(3).values.tolist(),
    })


def correlation(q, body):
    """GET /api/portfolio/correlation?symbols=A,B,C&period=1y&a=A&b=B&window=60"""
    syms = check_symbols(q.get("symbols"), 2, 30)
    period = check_period(q.get("period"), "1y")
    window = int(num(q.get("window"), "기간(일)", 10, 250, default=60))
    series = {}
    for s, p in zip(syms, _pmap(lambda s: _safe_close(s, period), syms)):
        if p is not None:
            series[s] = p
    if len(series) < 2:
        raise BadRequest("가격 데이터를 가져온 종목이 2개 미만입니다.")
    syms = list(series)
    # per-symbol returns on each symbol's own trading calendar, pairwise-complete correlation
    rets = pd.concat([v.pct_change() for v in series.values()], axis=1)
    corr = rets.corr(min_periods=20)
    a = (q.get("a") or syms[0]).upper()
    b = (q.get("b") or syms[1]).upper()
    if a not in syms or b not in syms or a == b:
        a, b = syms[0], syms[1]
    pr = rets[[a, b]].dropna()
    if len(pr) < window + 5:
        raise BadRequest("데이터가 부족합니다. 기간을 늘리거나 롤링 기간을 줄이세요.")
    roll = pr[a].rolling(window).corr(pr[b]).dropna()
    px = pd.concat([series[a], series[b]], axis=1).dropna()
    pairs = []
    for i in range(len(syms)):
        for j in range(i + 1, len(syms)):
            pairs.append({"a": syms[i], "b": syms[j], "corr": float(corr.iloc[i, j])})
    pairs.sort(key=lambda d: -d["corr"])
    avg = float(np.mean([p["corr"] for p in pairs])) if pairs else None
    norm = px[[a, b]] / px[[a, b]].iloc[0] * 100
    return clean({
        "symbols": syms, "matrix": corr.round(3).values.tolist(), "period": period, "window": window,
        "pair": {"a": a, "b": b, "dates": dates(roll.index), "rolling": roll.round(4).tolist(),
                 "full": float(pr[a].corr(pr[b])), "min": float(roll.min()), "max": float(roll.max()),
                 "last": float(roll.iloc[-1]), "price_dates": dates(norm.index),
                 "pa": norm[a].round(3).tolist(), "pb": norm[b].round(3).tolist()},
        "pairs": pairs, "avg": avg,
        "note": "한국·미국 종목은 장 마감 시간이 달라 같은 날짜의 상관관계가 실제보다 낮게 나올 수 있습니다." if
        any(s.endswith((".KS", ".KQ")) for s in syms) and any(not s.endswith((".KS", ".KQ")) for s in syms) else None,
    })


def _usdkrw():
    try:
        return float(_close("KRW=X", "1mo").iloc[-1])
    except Exception:
        return None


def _safe_close(s, period):
    try:
        return _close(s, period)
    except Exception:
        return None


def fx(q, body):
    """GET /api/portfolio/fx → 현재 USD/KRW 환율."""
    s = _close("KRW=X", "1mo")
    return clean({"usdkrw": float(s.iloc[-1]), "date": dates(s.index[-1:])[0]})


def price(q, body):
    """GET /api/portfolio/price?symbol=AAPL&date=YYYY-MM-DD → 해당일(또는 직전 거래일) 종가."""
    sym = check_symbol(q.get("symbol"))
    d = _parse_date(q.get("date") or date.today().isoformat())
    s = _close(sym, _period_for(d - pd.Timedelta(days=10), 0.1))
    s = s[s.index <= d]
    if s.empty:
        raise BadRequest(f"{sym}: {d.date()} 이전 가격 데이터가 없습니다.")
    inf = _safe_info(sym)
    c = str(inf.get("currency") or ccy_of(sym))
    v = float(s.iloc[-1]) * (0.01 if c == "GBp" else 1)
    return clean({"symbol": sym, "date": dates(s.index[-1:])[0], "close": round(v, 4), "currency": "GBP" if c == "GBp" else c.upper(),
                  "name": inf.get("shortName")})


ROUTES = {
    ("GET", "/api/portfolio/price"): price,
    ("POST", "/api/portfolio/analyze"): analyze,
    ("POST", "/api/portfolio/risk"): risk,
    ("POST", "/api/portfolio/optimize"): optimize,
    ("GET", "/api/portfolio/correlation"): correlation,
    ("GET", "/api/portfolio/fx"): fx,
}

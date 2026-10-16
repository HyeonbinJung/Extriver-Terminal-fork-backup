"""Derivatives screen (파생상품): option chains, option pricer, strategy builder, bond
calculator, VIX term structure and futures curves.

Data / engines
  * Option chains  : yfinance ``Ticker.options`` / ``option_chain`` (US listed options only).
  * Bond maths     : Fincept ``derivatives_pricing._bond_core`` (coupon schedule, accrued,
                     duration, convexity). The script's YTM/BSM helpers need SciPy, which the
                     easy venv does not ship, so the solvers here are plain bisection.
  * Black-Scholes  : closed form with ``math.erf`` (ported from the old easy/server.py),
                     CRR binomial tree for American exercise.
  * VIX            : yfinance (^VIX9D ^VIX ^VIX3M ^VIX6M ^VIX1Y) + Fincept ``cboe_vix_data``
                     (VVIX, SKEW from the CBOE CDN).
  * Futures        : yfinance contract-month symbols (e.g. CLZ26.NYM) and continuous =F.
"""

from __future__ import annotations

import contextlib
import io
import math
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta

import numpy as np
import pandas as pd

from api.common import muted, BadRequest, cached, check_symbol, clean, num, quiet, yf_ticker

import derivatives_pricing as dp  # noqa: E402  (Fincept script — bond schedule maths)

NET_TIMEOUT = 15
DEFAULT_R = 0.042


# --------------------------------------------------------------------------- #
# Black-Scholes-Merton (continuous r, q)
# --------------------------------------------------------------------------- #
def _ncdf(x: float) -> float:
    return 0.5 * (1 + math.erf(x / math.sqrt(2)))


def _npdf(x: float) -> float:
    return math.exp(-x * x / 2) / math.sqrt(2 * math.pi)


def bsm(S, K, T, r, sigma, q, kind):
    """Price + Greeks. vega/rho per 1%p, theta per calendar day."""
    if kind == "stock":
        return {"price": S, "delta": 1.0, "gamma": 0.0, "vega": 0.0, "theta": 0.0, "rho": 0.0}
    if T <= 0 or sigma <= 0 or S <= 0:
        intrinsic = max(S - K, 0.0) if kind == "call" else max(K - S, 0.0)
        itm = (S > K) if kind == "call" else (S < K)
        return {"price": intrinsic, "delta": (1.0 if itm else 0.0) * (1 if kind == "call" else -1),
                "gamma": 0.0, "vega": 0.0, "theta": 0.0, "rho": 0.0, "d1": None, "d2": None,
                "prob_itm": 1.0 if itm else 0.0}
    sq = math.sqrt(T)
    d1 = (math.log(S / K) + (r - q + sigma * sigma / 2) * T) / (sigma * sq)
    d2 = d1 - sigma * sq
    dq, dr = math.exp(-q * T), math.exp(-r * T)
    pdf = _npdf(d1)
    if kind == "call":
        price = S * dq * _ncdf(d1) - K * dr * _ncdf(d2)
        delta = dq * _ncdf(d1)
        theta = -S * dq * pdf * sigma / (2 * sq) - r * K * dr * _ncdf(d2) + q * S * dq * _ncdf(d1)
        rho = K * T * dr * _ncdf(d2)
        p_itm = _ncdf(d2)
    else:
        price = K * dr * _ncdf(-d2) - S * dq * _ncdf(-d1)
        delta = -dq * _ncdf(-d1)
        theta = -S * dq * pdf * sigma / (2 * sq) + r * K * dr * _ncdf(-d2) - q * S * dq * _ncdf(-d1)
        rho = -K * T * dr * _ncdf(-d2)
        p_itm = _ncdf(-d2)
    return {"price": price, "delta": delta, "gamma": dq * pdf / (S * sigma * sq),
            "vega": S * dq * pdf * sq / 100, "theta": theta / 365, "rho": rho / 100,
            "d1": d1, "d2": d2, "prob_itm": p_itm}


def crr(S, K, T, r, sigma, q, kind, american=True, steps=250):
    """Cox-Ross-Rubinstein binomial tree price."""
    if T <= 0 or sigma <= 0:
        return max(S - K, 0.0) if kind == "call" else max(K - S, 0.0)
    dt = T / steps
    u = math.exp(sigma * math.sqrt(dt))
    d = 1 / u
    a = math.exp((r - q) * dt)
    p = (a - d) / (u - d)
    if not 0 < p < 1:
        return None
    disc = math.exp(-r * dt)
    j = np.arange(steps + 1)
    prices = S * u ** (steps - j) * d ** j
    vals = np.maximum(prices - K, 0) if kind == "call" else np.maximum(K - prices, 0)
    for i in range(steps - 1, -1, -1):
        vals = disc * (p * vals[:-1] + (1 - p) * vals[1:])
        if american:
            prices = prices[:-1] / u
            ex = np.maximum(prices - K, 0) if kind == "call" else np.maximum(K - prices, 0)
            vals = np.maximum(vals, ex)
    return float(vals[0])


def implied_vol(S, K, T, r, q, kind, price):
    """Bisection IV. Returns (iv, error_message)."""
    if T <= 0:
        return None, "만기까지 남은 기간이 0보다 커야 합니다."
    fwd, disc_k = S * math.exp(-q * T), K * math.exp(-r * T)
    lo_b, hi_b = (max(fwd - disc_k, 0.0), fwd) if kind == "call" else (max(disc_k - fwd, 0.0), disc_k)
    if price < lo_b - 1e-9:
        return None, f"입력 가격 {price:.4f}이(가) 무차익 최저가(내재가치 {lo_b:.4f})보다 낮아 내재변동성이 존재하지 않습니다."
    if price > hi_b + 1e-9:
        return None, f"입력 가격 {price:.4f}이(가) 이론상 최대값({hi_b:.4f})보다 높아 내재변동성이 존재하지 않습니다."
    lo, hi = 1e-4, 5.0
    if bsm(S, K, T, r, hi, q, kind)["price"] < price:
        return None, "내재변동성이 500%를 넘습니다 (계산 범위 밖)."
    for _ in range(200):
        mid = (lo + hi) / 2
        if bsm(S, K, T, r, mid, q, kind)["price"] > price:
            hi = mid
        else:
            lo = mid
        if hi - lo < 1e-8:
            break
    return (lo + hi) / 2, None


def _opt_inputs(p: dict) -> tuple:
    S = num(p.get("S"), "기초자산 가격", 1e-6, 1e9)
    K = num(p.get("K"), "행사가", 1e-6, 1e9)
    days = num(p.get("days"), "만기까지 일수", 0, 3650 * 3)
    r = num(p.get("r"), "무위험 이자율", -20, 50, default=DEFAULT_R * 100) / 100
    q = num(p.get("q"), "배당수익률", 0, 50, default=0) / 100
    kind = p.get("kind", "call")
    if kind not in ("call", "put"):
        raise BadRequest("옵션 종류는 call 또는 put 이어야 합니다.")
    return S, K, days / 365, r, q, kind


# --------------------------------------------------------------------------- #
# Option pricer
# --------------------------------------------------------------------------- #
def price_option(q_: dict, body: dict) -> dict:
    S, K, T, r, q, kind = _opt_inputs(body)
    sigma = num(body.get("sigma"), "변동성", 0.1, 500) / 100
    side = -1 if body.get("side") == "short" else 1
    res = bsm(S, K, T, r, sigma, q, kind)
    other = "put" if kind == "call" else "call"
    res_o = bsm(S, K, T, r, sigma, q, other)
    prem = res["price"]
    amer = crr(S, K, T, r, sigma, q, kind, True)
    euro = crr(S, K, T, r, sigma, q, kind, False)
    intrinsic = max(S - K, 0) if kind == "call" else max(K - S, 0)
    xs = np.linspace(S * 0.6, S * 1.4, 121)
    half = T / 2
    curve = {"x": xs.round(4).tolist(), "expiry": [], "today": [], "half": []}
    greeks = {"delta": [], "gamma": [], "vega": [], "theta": []}
    for x in xs:
        expv = max(x - K, 0) if kind == "call" else max(K - x, 0)
        b = bsm(x, K, T, r, sigma, q, kind)
        curve["expiry"].append(side * (expv - prem))
        curve["today"].append(side * (b["price"] - prem))
        curve["half"].append(side * (bsm(x, K, half, r, sigma, q, kind)["price"] - prem))
        for g in greeks:
            greeks[g].append(side * b[g])
    # time decay: value at the current spot as days pass
    total_days = int(round(T * 365))
    step = max(1, total_days // 60)
    decay_days = list(range(total_days, -1, -step))
    if decay_days[-1] != 0:
        decay_days.append(0)
    decay = {"days_left": decay_days,
             "value": [bsm(S, K, d / 365, r, sigma, q, kind)["price"] for d in decay_days]}
    # price vs volatility
    vols = np.linspace(0.05, max(1.0, sigma * 2), 60)
    volcurve = {"vol": (vols * 100).round(2).tolist(), "value": [bsm(S, K, T, r, v, q, kind)["price"] for v in vols]}
    be = K + prem if kind == "call" else K - prem
    return clean({
        **res, "side": side, "kind": kind, "breakeven": be, "intrinsic": intrinsic, "time_value": prem - intrinsic,
        "parity": {"kind": other, "price": res_o["price"],
                   "check": (prem - res_o["price"]) if kind == "call" else (res_o["price"] - prem),
                   "fwd_minus_k": S * math.exp(-q * T) - K * math.exp(-r * T)},
        "binomial": {"american": amer, "european": euro, "early_premium": (amer - euro) if amer is not None and euro is not None else None, "steps": 250},
        "curve": curve, "greeks_curve": greeks, "decay": decay, "volcurve": volcurve,
    })


def iv_solve(q_: dict, body: dict) -> dict:
    S, K, T, r, q, kind = _opt_inputs(body)
    price = num(body.get("price"), "옵션 시장가격", 1e-6, 1e9)
    iv, err = implied_vol(S, K, T, r, q, kind, price)
    if err:
        raise BadRequest(err)
    g = bsm(S, K, T, r, iv, q, kind)
    return clean({"iv": iv, **g, "model_price": g["price"], "input_price": price})


# --------------------------------------------------------------------------- #
# Option chain (yfinance)
# --------------------------------------------------------------------------- #
KR_MSG = ("{sym}: Yahoo Finance에는 한국 주식·지수 옵션 데이터가 없습니다 (코스피200 옵션 등은 KRX에서만 제공). "
          "미국 상장 종목(SPY, QQQ, AAPL, TSLA, NVDA 등)으로 시도하세요.")


@cached(600)
def _expirations(sym: str) -> tuple:
    try:
        return tuple(yf_ticker(sym).options or ())
    except Exception:
        return ()


def _check_opt_symbol(sym: str) -> tuple:
    if sym.endswith((".KS", ".KQ")) or sym.startswith("^KS"):
        raise BadRequest(KR_MSG.format(sym=sym))
    exps = _expirations(sym)
    if not exps:
        raise BadRequest(f"{sym}: 옵션 만기 목록이 없습니다. 미국에 상장된 옵션 거래 종목인지 확인하세요 "
                         "(한국 종목은 Yahoo 옵션 데이터가 없습니다).")
    return exps


@cached(120)
def _chain_raw(sym: str, exp: str):
    # no stdout redirection here: this runs inside worker threads (redirect_stdout is process-global)
    ch = yf_ticker(sym).option_chain(exp)
    und = getattr(ch, "underlying", None) or {}
    return ch.calls.copy(), ch.puts.copy(), dict(und)


def _dte(exp: str) -> float:
    d = (datetime.strptime(exp, "%Y-%m-%d").date() - date.today()).days
    return max(d, 0) + 0.5  # options settle at the close of the expiry day


def _mid(bid, ask, last):
    if bid and ask and bid > 0 and ask > 0:
        return (bid + ask) / 2
    return last if last and last > 0 else None


def expirations(q: dict, body: dict) -> dict:
    sym = check_symbol(q.get("symbol") or "SPY")
    exps = _check_opt_symbol(sym)
    return {"symbol": sym, "expirations": list(exps), "dte": [round(_dte(e) - 0.5) for e in exps]}


def _side_df(df: pd.DataFrame, pref: str) -> pd.DataFrame:
    keep = {"strike": "strike", "lastPrice": "last", "bid": "bid", "ask": "ask", "change": "chg", "percentChange": "chgp",
            "volume": "vol", "openInterest": "oi", "impliedVolatility": "iv", "inTheMoney": "itm", "contractSymbol": "sym"}
    d = df[[c for c in keep if c in df.columns]].rename(columns=keep)
    d = d.set_index("strike")
    d.columns = [f"{pref}_{c}" for c in d.columns]
    return d


def _chain_analysis(sym: str, exp: str, r: float) -> dict:
    calls, puts, und = _chain_raw(sym, exp)
    if calls.empty and puts.empty:
        raise BadRequest(f"{sym} {exp}: 옵션 체인이 비어 있습니다.")
    spot = und.get("regularMarketPrice") or und.get("bid")
    if not spot:
        try:
            from api.common import quote
            spot = (quote(sym) or {}).get("price")
        except Exception:
            spot = None
    if not spot:
        raise BadRequest(f"{sym}: 현재가를 가져오지 못했습니다.")
    spot = float(spot)
    T = _dte(exp) / 365
    df = _side_df(calls, "c").join(_side_df(puts, "p"), how="outer").sort_index()
    for c in ("c_vol", "c_oi", "p_vol", "p_oi"):
        if c in df:
            df[c] = df[c].fillna(0)
    strikes = df.index.to_numpy(dtype=float)
    c_oi = df.get("c_oi", pd.Series(0, index=df.index)).to_numpy(dtype=float)
    p_oi = df.get("p_oi", pd.Series(0, index=df.index)).to_numpy(dtype=float)
    # max pain: payout to option holders if the underlying settles at each strike
    pain = []
    for k in strikes:
        pain.append(float((c_oi * np.maximum(k - strikes, 0)).sum() + (p_oi * np.maximum(strikes - k, 0)).sum()) * 100)
    mp_i = int(np.argmin(pain)) if pain else None
    rows = []
    atm_i = int(np.argmin(np.abs(strikes - spot)))
    for i, (k, row) in enumerate(df.iterrows()):
        rec = {"strike": float(k)}
        for side in ("c", "p"):
            kind = "call" if side == "c" else "put"
            iv = row.get(f"{side}_iv")
            bid, ask, last = row.get(f"{side}_bid"), row.get(f"{side}_ask"), row.get(f"{side}_last")
            has_quote = (bid is not None and bid == bid and bid > 0) or (row.get(f"{side}_vol", 0) or 0) > 0
            ok_iv = iv is not None and iv == iv and 0.01 < iv < 4 and has_quote
            for f in ("last", "bid", "ask", "chg", "chgp", "vol", "oi", "sym"):
                v = row.get(f"{side}_{f}")
                rec[f"{side}_{f}"] = None if (v is None or (isinstance(v, float) and v != v)) else v
            rec[f"{side}_iv"] = float(iv) if ok_iv else None
            rec[f"{side}_mid"] = _mid(bid if bid == bid else None, ask if ask == ask else None, last if last == last else None)
            rec[f"{side}_delta"] = bsm(spot, float(k), T, r, float(iv), 0, kind)["delta"] if ok_iv else None
            rec[f"{side}_itm"] = (k < spot) if side == "c" else (k > spot)
        rows.append(rec)
    atm = rows[atm_i]
    straddle = (atm["c_mid"] or 0) + (atm["p_mid"] or 0) if atm["c_mid"] and atm["p_mid"] else None
    atm_iv = np.nanmean([v for v in (atm["c_iv"], atm["p_iv"]) if v]) if (atm["c_iv"] or atm["p_iv"]) else None
    tot = {k: float(df[k].sum()) if k in df else 0.0 for k in ("c_vol", "p_vol", "c_oi", "p_oi")}
    return {
        "symbol": sym, "expiration": exp, "dte": round(_dte(exp) - 0.5), "spot": spot,
        "name": und.get("shortName") or und.get("longName") or sym, "currency": und.get("currency") or "USD",
        "rows": rows, "atm_strike": float(strikes[atm_i]),
        "totals": tot,
        "pcr_volume": tot["p_vol"] / tot["c_vol"] if tot["c_vol"] else None,
        "pcr_oi": tot["p_oi"] / tot["c_oi"] if tot["c_oi"] else None,
        "max_pain": float(strikes[mp_i]) if mp_i is not None else None,
        "pain": pain,
        "straddle": straddle,
        "expected_move": straddle,
        "expected_move_pct": straddle / spot if straddle else None,
        "atm_iv": atm_iv,
        "iv_move": spot * atm_iv * math.sqrt(T) if atm_iv else None,
        "r": r,
    }


def chain(q: dict, body: dict) -> dict:
    sym = check_symbol(q.get("symbol") or "SPY")
    exps = _check_opt_symbol(sym)
    # default: the first expiry at least a week out (0DTE chains are tiny and noisy)
    exp = q.get("exp") or next((e for e in exps if _dte(e) >= 7), exps[0])
    if exp not in exps:
        raise BadRequest(f"{sym}: '{exp}' 만기는 없습니다. 목록에서 선택하세요.")
    r = num(q.get("r"), "무위험 이자율", -20, 50, default=DEFAULT_R * 100) / 100
    out = _chain_analysis(sym, exp, r)
    out["expirations"] = list(exps)
    return clean(out)


@cached(900)
def _iv_term(sym: str) -> list:
    exps = _check_opt_symbol(sym)[:14]

    def one(e):
        try:
            a = _chain_analysis(sym, e, DEFAULT_R)
            return {"exp": e, "dte": a["dte"], "atm_iv": a["atm_iv"], "pcr_oi": a["pcr_oi"], "pcr_volume": a["pcr_volume"],
                    "oi": a["totals"]["c_oi"] + a["totals"]["p_oi"], "volume": a["totals"]["c_vol"] + a["totals"]["p_vol"],
                    "max_pain": a["max_pain"], "expected_move_pct": a["expected_move_pct"]}
        except Exception:
            return None

    with ThreadPoolExecutor(6) as ex:
        return [x for x in ex.map(one, exps) if x]


def iv_term(q: dict, body: dict) -> dict:
    sym = check_symbol(q.get("symbol") or "SPY")
    return clean({"symbol": sym, "term": _iv_term(sym)})


# --------------------------------------------------------------------------- #
# Strategy builder
# --------------------------------------------------------------------------- #
def strategy(q_: dict, body: dict) -> dict:
    S = num(body.get("S"), "기초자산 가격", 1e-6, 1e9)
    r = num(body.get("r"), "무위험 이자율", -20, 50, default=DEFAULT_R * 100) / 100
    qd = num(body.get("q"), "배당수익률", 0, 50, default=0) / 100
    sigma = num(body.get("sigma"), "변동성", 0.1, 500) / 100
    mult = num(body.get("mult"), "계약 승수", 1, 100000, default=100)
    legs_in = body.get("legs")
    if not isinstance(legs_in, list) or not 1 <= len(legs_in) <= 8:
        raise BadRequest("레그(포지션)를 1~8개 입력하세요.")
    legs = []
    for i, L in enumerate(legs_in, 1):
        if not isinstance(L, dict):
            raise BadRequest(f"{i}번 레그 형식이 올바르지 않습니다.")
        kind = L.get("kind", "call")
        if kind not in ("call", "put", "stock"):
            raise BadRequest(f"{i}번 레그 종류가 올바르지 않습니다.")
        side = -1 if L.get("side") == "short" else 1
        qty = num(L.get("qty"), f"{i}번 레그 수량", 0.0001, 100000, default=1)
        if kind == "stock":
            K, days, iv = 0.0, 0.0, sigma
            prem = num(L.get("premium"), f"{i}번 레그 매입가", 0, 1e9, default=S) if L.get("premium") not in (None, "") else S
        else:
            K = num(L.get("K"), f"{i}번 레그 행사가", 1e-6, 1e9)
            days = num(L.get("days"), f"{i}번 레그 만기 일수", 0, 3650 * 3, default=30)
            iv = num(L.get("iv"), f"{i}번 레그 변동성", 0.1, 500) / 100 if L.get("iv") not in (None, "") else sigma
            if L.get("premium") in (None, ""):
                prem = bsm(S, K, days / 365, r, iv, qd, kind)["price"]
                auto = True
            else:
                prem = num(L.get("premium"), f"{i}번 레그 프리미엄", 0, 1e9)
                auto = False
        legs.append({"kind": kind, "side": side, "qty": qty, "K": K, "days": days, "iv": iv, "premium": prem,
                     "auto": kind != "stock" and auto})
    opt_days = [L["days"] for L in legs if L["kind"] != "stock"]
    horizon = min(opt_days) if opt_days else 30.0

    def value(x, elapsed):
        tot = 0.0
        for L in legs:
            if L["kind"] == "stock":
                v = x
            else:
                rem = (L["days"] - elapsed) / 365
                v = bsm(x, L["K"], rem, r, L["iv"], qd, L["kind"])["price"] if rem > 1e-9 else (
                    max(x - L["K"], 0) if L["kind"] == "call" else max(L["K"] - x, 0))
            tot += L["side"] * L["qty"] * mult * (v - L["premium"])
        return tot

    strikes = [L["K"] for L in legs if L["kind"] != "stock"]
    lo = max(0.0, min([S * 0.5] + [k * 0.8 for k in strikes]))
    hi = max([S * 1.5] + [k * 1.2 for k in strikes])
    xs = sorted(set(np.linspace(lo, hi, 301).round(6).tolist() + [round(k, 6) for k in strikes] + [round(S, 6)]))
    exp_pnl = [value(x, horizon) for x in xs]
    today = [value(x, 0) for x in xs]
    mid = [value(x, horizon / 2) for x in xs]
    # bounds: slope beyond the grid (payoff is linear there at expiry for single-expiry books)
    slope_hi = (value(hi * 1.5, horizon) - value(hi, horizon))
    at_zero = value(0.0, horizon) if lo > 0 else exp_pnl[0]
    max_profit = max(exp_pnl + [at_zero])
    max_loss = min(exp_pnl + [at_zero])
    unl_profit = slope_hi > 1e-6
    unl_loss = slope_hi < -1e-6
    bes = []
    for i in range(1, len(xs)):
        a, b = exp_pnl[i - 1], exp_pnl[i]
        if a == 0 and (i == 1 or exp_pnl[i - 2] != 0):
            bes.append(xs[i - 1])
        elif a * b < 0:
            bes.append(xs[i - 1] + (xs[i] - xs[i - 1]) * (-a) / (b - a))
    # probability of profit under a lognormal at the horizon
    T = horizon / 365
    mu = math.log(S) + (r - qd - sigma * sigma / 2) * T
    sd = sigma * math.sqrt(max(T, 1e-9))

    def cdf(x):
        return 0.0 if x <= 0 else _ncdf((math.log(x) - mu) / sd)

    pop, exp_val = 0.0, 0.0
    edges = [0.0] + [(xs[i] + xs[i + 1]) / 2 for i in range(len(xs) - 1)] + [float("inf")]
    for i, x in enumerate(xs):
        pr = (1.0 if edges[i + 1] == float("inf") else cdf(edges[i + 1])) - cdf(edges[i])
        exp_val += pr * exp_pnl[i]
        if exp_pnl[i] > 0:
            pop += pr
    # net greeks now
    g = {"delta": 0.0, "gamma": 0.0, "vega": 0.0, "theta": 0.0, "rho": 0.0}
    for L in legs:
        b = bsm(S, L["K"], L["days"] / 365, r, L["iv"], qd, L["kind"])
        for k in g:
            g[k] += L["side"] * L["qty"] * mult * (b.get(k) or 0)
    net = sum(L["side"] * L["qty"] * mult * L["premium"] for L in legs)
    return clean({
        "x": xs, "expiry": exp_pnl, "today": today, "half": mid, "horizon": horizon,
        "max_profit": None if unl_profit else max_profit, "max_loss": None if unl_loss else max_loss,
        "unlimited_profit": unl_profit, "unlimited_loss": unl_loss,
        "breakevens": bes, "pop": pop, "expected_pnl": exp_val, "greeks": g,
        "net_premium": net, "legs": legs, "mult": mult,
        "sd_range": [S * math.exp(-sd), S * math.exp(sd)],
    })


# --------------------------------------------------------------------------- #
# Bonds (Fincept derivatives_pricing._bond_core)
# --------------------------------------------------------------------------- #
def _iso(v, name):
    try:
        return datetime.strptime(str(v), "%Y-%m-%d").strftime("%Y-%m-%d")
    except ValueError:
        raise BadRequest(f"'{name}' 날짜 형식은 YYYY-MM-DD 입니다.")


def _core(issue, settle, mat, cpn, ytm, freq):
    res = dp._bond_core(issue, settle, mat, cpn, ytm, freq)
    if "error" in res:
        raise BadRequest({"Settlement must be before maturity": "결제일은 만기일보다 앞서야 합니다."}.get(res["error"], res["error"]))
    return res


def _ytm_from_clean(issue, settle, mat, cpn, clean_px, freq):
    lo, hi = -5.0, 100.0
    f_lo = _core(issue, settle, mat, cpn, lo, freq)["clean_price"] - clean_px
    f_hi = _core(issue, settle, mat, cpn, hi, freq)["clean_price"] - clean_px
    if f_lo * f_hi > 0:
        raise BadRequest("이 가격을 만드는 수익률이 -5%~100% 범위에 없습니다. 가격을 확인하세요.")
    for _ in range(200):
        m = (lo + hi) / 2
        f = _core(issue, settle, mat, cpn, m, freq)["clean_price"] - clean_px
        if f > 0:
            lo = m
        else:
            hi = m
        if hi - lo < 1e-10:
            break
    return (lo + hi) / 2


def bond(q_: dict, body: dict) -> dict:
    today = date.today()
    settle = _iso(body.get("settle") or today.isoformat(), "결제일")
    mat = _iso(body.get("maturity") or today.replace(year=today.year + 10).isoformat(), "만기일")
    issue = _iso(body.get("issue") or (datetime.strptime(settle, "%Y-%m-%d") - timedelta(days=365)).strftime("%Y-%m-%d"), "발행일")
    if issue > settle:
        issue = settle
    if mat <= settle:
        raise BadRequest("만기일은 결제일 이후여야 합니다.")
    if (datetime.strptime(mat, "%Y-%m-%d") - datetime.strptime(settle, "%Y-%m-%d")).days > 365 * 100:
        raise BadRequest("만기는 100년 이내로 입력하세요.")
    cpn = num(body.get("coupon"), "표면금리", 0, 50)
    freq = int(num(body.get("freq"), "이자 지급 횟수", 1, 12, default=2))
    if freq not in (1, 2, 4, 12):
        raise BadRequest("이자 지급 횟수는 연 1·2·4·12회 중 하나입니다.")
    face = num(body.get("face"), "액면가", 1, 1e13, default=100)
    mode = body.get("mode", "ytm")
    if mode == "price":
        clean_px = num(body.get("price"), "채권 가격(액면 100 기준)", 1, 1000)
        ytm = _ytm_from_clean(issue, settle, mat, cpn, clean_px, freq)
    else:
        ytm = num(body.get("ytm"), "만기수익률", -5, 100)
    res = _core(issue, settle, mat, cpn, ytm, freq)
    # cash-flow schedule (same convention as the Fincept core)
    sd, md = datetime.strptime(settle, "%Y-%m-%d"), datetime.strptime(mat, "%Y-%m-%d")
    prev, after = dp._coupon_dates_after(sd, md, freq)
    w = (after[0] - sd).days / (after[0] - prev).days
    cpn_amt = cpn / freq
    y_per = ytm / 100 / freq
    flows = []
    for k, d in enumerate(after):
        prin = 100.0 if k == len(after) - 1 else 0.0
        periods = w + k
        df_ = (1 + y_per) ** (-periods)
        flows.append({"date": d.strftime("%Y-%m-%d"), "t": periods / freq, "coupon": cpn_amt * face / 100,
                      "principal": prin * face / 100, "total": (cpn_amt + prin) * face / 100,
                      "df": df_, "pv": (cpn_amt + prin) * df_ * face / 100})
    # price-yield curve
    ys = np.round(np.arange(max(-1.0, ytm - 5), ytm + 5.0001, 0.1), 4)
    P0, D, C = res["dirty_price"], res["modified_duration"], res["convexity"]
    py = {"ytm": ys.tolist(), "price": [], "dur": [], "durconv": []}
    for y in ys:
        py["price"].append(_core(issue, settle, mat, cpn, float(y), freq)["clean_price"])
        dy = (y - ytm) / 100
        py["dur"].append(P0 * (1 - D * dy) - res["accrued_interest"])
        py["durconv"].append(P0 * (1 - D * dy + 0.5 * C * dy * dy) - res["accrued_interest"])
    shocks = []
    for bp in (-200, -100, -50, -25, 25, 50, 100, 200):
        y2 = ytm + bp / 100
        if y2 <= -5:
            continue
        r2 = _core(issue, settle, mat, cpn, y2, freq)
        dy = bp / 10000
        shocks.append({"bp": bp, "ytm": y2, "clean": r2["clean_price"], "dirty": r2["dirty_price"],
                       "chg_pct": r2["dirty_price"] / P0 - 1, "dur_est": -D * dy,
                       "durconv_est": -D * dy + 0.5 * C * dy * dy,
                       "pnl": (r2["dirty_price"] - P0) * face / 100})
    return clean({
        **res, "ytm": ytm, "coupon": cpn, "freq": freq, "face": face, "settle": settle, "maturity": mat, "issue": issue,
        "current_yield": cpn / res["clean_price"] * 100 if res["clean_price"] else None,
        "dv01": D * P0 / 10000 * face / 100,
        "value_clean": res["clean_price"] * face / 100, "value_dirty": P0 * face / 100,
        "accrued_value": res["accrued_interest"] * face / 100,
        "flows": flows, "py": py, "shocks": shocks,
        "premium_discount": "할증" if res["clean_price"] > 100.0001 else "할인" if res["clean_price"] < 99.9999 else "액면",
    })


# --------------------------------------------------------------------------- #
# VIX term structure & futures
# --------------------------------------------------------------------------- #
def _download(symbols: list[str], period: str) -> pd.DataFrame:
    import yfinance as yf

    with muted():
        data = yf.download(symbols, period=period, interval="1d", progress=False, auto_adjust=False,
                           threads=True, timeout=NET_TIMEOUT)
    if data is None or data.empty:
        raise BadRequest("시세 데이터를 가져오지 못했습니다. 잠시 후 다시 시도하세요.")
    close = data["Close"] if isinstance(data.columns, pd.MultiIndex) else data[["Close"]].rename(columns={"Close": symbols[0]})
    close.index = pd.to_datetime(close.index)
    if getattr(close.index, "tz", None) is not None:
        close.index = close.index.tz_localize(None)
    return close.sort_index()


VIX_TERMS = [("^VIX9D", "9일", 9), ("^VIX", "30일", 30), ("^VIX3M", "3개월", 93), ("^VIX6M", "6개월", 183), ("^VIX1Y", "1년", 365)]


def _cboe_last(name: str):
    try:
        import cboe_vix_data as cb

        res = cb.get_vix_history(name)  # returns data, prints nothing (thread-safe)
        rows = res.get("data") or []
        out = []
        for r_ in rows[-260:]:
            d = r_.get("DATE") or r_.get("Date")
            v = r_.get("CLOSE") or r_.get(name) or r_.get("Close")
            try:
                out.append((datetime.strptime(d, "%m/%d/%Y").strftime("%Y-%m-%d"), float(v)))
            except (TypeError, ValueError):
                continue
        return out
    except Exception:
        return []


@cached(600)
def _vix() -> dict:
    syms = [s for s, _, _ in VIX_TERMS]
    px = _download(syms, "1y").ffill()
    curves = {}
    for key, off in (("now", 0), ("w1", 7), ("m1", 30), ("m3", 91)):
        sub = px[px.index <= px.index[-1] - pd.Timedelta(days=off)]
        if sub.empty:
            continue
        s = sub.iloc[-1]
        curves[key] = {"date": sub.index[-1].strftime("%Y-%m-%d"), "values": [s.get(sym) for sym in syms]}
    hist = px[["^VIX", "^VIX3M"]].dropna()
    ratio = (hist["^VIX"] / hist["^VIX3M"])
    with ThreadPoolExecutor(2) as ex:
        vvix, skew = ex.map(_cboe_last, ["VVIX", "SKEW"])
    return {
        "terms": [{"sym": s, "label": l, "days": d} for s, l, d in VIX_TERMS],
        "curves": curves,
        "history": {"dates": [d.strftime("%Y-%m-%d") for d in hist.index], "vix": hist["^VIX"].tolist(),
                    "vix3m": hist["^VIX3M"].tolist(), "ratio": ratio.tolist()},
        "ratio_now": float(ratio.iloc[-1]) if len(ratio) else None,
        "contango_days_pct": float((ratio < 1).mean()) if len(ratio) else None,
        "vix_pctile": float((hist["^VIX"] <= hist["^VIX"].iloc[-1]).mean()) if len(hist) else None,
        "vvix": {"dates": [d for d, _ in vvix], "values": [v for _, v in vvix]},
        "skew": {"dates": [d for d, _ in skew], "values": [v for _, v in skew]},
    }


def vix(q: dict, body: dict) -> dict:
    return clean(_vix())


MONTH_CODES = "FGHJKMNQUVXZ"
FUT_ROOTS = {
    "CL": ("WTI 원유", "NYM", "FGHJKMNQUVXZ", "USD/배럴"),
    "NG": ("천연가스", "NYM", "FGHJKMNQUVXZ", "USD/MMBtu"),
    "GC": ("금", "CMX", "GJMQVZ", "USD/온스"),
    "SI": ("은", "CMX", "HKNUZ", "USD/온스"),
    "HG": ("구리", "CMX", "HKNUZ", "USD/파운드"),
    "ES": ("S&P500 E-mini", "CME", "HMUZ", "지수 포인트"),
    "NQ": ("나스닥100 E-mini", "CME", "HMUZ", "지수 포인트"),
    "ZC": ("옥수수", "CBT", "HKNUZ", "센트/부셸"),
    "ZN": ("미 10년물 국채", "CBT", "HMUZ", "가격"),
}
INDEX_BASIS = [("ES=F", "^GSPC", "S&P 500"), ("NQ=F", "^NDX", "나스닥 100"), ("YM=F", "^DJI", "다우존스"), ("RTY=F", "^RUT", "러셀 2000")]
FRONT = [("CL=F", "WTI 원유"), ("BZ=F", "브렌트유"), ("NG=F", "천연가스"), ("GC=F", "금"), ("SI=F", "은"), ("HG=F", "구리"),
         ("ZC=F", "옥수수"), ("ZW=F", "밀"), ("ZS=F", "대두"), ("ZN=F", "미 10년물"), ("6E=F", "유로 FX"), ("6J=F", "엔화 FX")]


def _third_friday(y, m):
    d = date(y, m, 15)
    return d + timedelta(days=(4 - d.weekday()) % 7)


@cached(600)
def _futures(root: str) -> dict:
    name, exch, months, unit = FUT_ROOTS[root]
    today = date.today()
    codes = []
    y, m = today.year, today.month
    while len(codes) < 14:
        if MONTH_CODES[m - 1] in months:
            codes.append((f"{root}{MONTH_CODES[m - 1]}{y % 100:02d}.{exch}", f"{y}-{m:02d}"))
        m += 1
        if m > 12:
            m, y = 1, y + 1
    px = _download([c for c, _ in codes] + [f"{root}=F"], "5d")
    curve = []
    newest = px.index[-1]
    for sym, ym in codes:
        if sym not in px:
            continue
        s = px[sym].dropna()
        if s.empty or (newest - s.index[-1]).days > 6:
            continue
        curve.append({"sym": sym, "month": ym, "price": float(s.iloc[-1]),
                      "chg": float(s.iloc[-1] / s.iloc[-2] - 1) if len(s) > 1 else None})
    if len(curve) < 2:
        raise BadRequest(f"{name} 선물 월물 시세를 충분히 가져오지 못했습니다.")
    front = curve[0]["price"]
    for c in curve:
        c["spread"] = c["price"] - front
        c["spread_pct"] = c["price"] / front - 1
    slope = curve[-1]["price"] / front - 1
    return {"root": root, "name": name, "unit": unit, "curve": curve,
            "structure": "콘탱고" if slope > 0.002 else "백워데이션" if slope < -0.002 else "평탄",
            "slope": slope}


@cached(300)
def _basis() -> dict:
    syms = sorted({s for pair in INDEX_BASIS for s in pair[:2]} | {s for s, _ in FRONT})
    px = _download(syms, "1mo").ffill()
    last = px.iloc[-1]
    prev = px.iloc[-2] if len(px) > 1 else last
    today = date.today()
    # front quarterly index futures expire on the 3rd Friday of Mar/Jun/Sep/Dec
    exp = None
    for k in range(0, 5):
        mm = ((today.month - 1 + k) % 12) + 1
        yy = today.year + ((today.month - 1 + k) // 12)
        if mm in (3, 6, 9, 12):
            tf = _third_friday(yy, mm)
            if tf >= today:
                exp = tf
                break
    days = max((exp - today).days, 1) if exp else None
    rows = []
    for f, s, name in INDEX_BASIS:
        F, Sp = last.get(f), last.get(s)
        if F is None or Sp is None or F != F or Sp != Sp:
            continue
        basis = F - Sp
        rows.append({"name": name, "fut": f, "spot": s, "F": F, "S": Sp, "basis": basis, "basis_pct": basis / Sp,
                     "carry_ann": (F / Sp - 1) * 365 / days if days else None, "days": days,
                     "expiry": exp.isoformat() if exp else None})
    fr = []
    for s, name in FRONT:
        v = last.get(s)
        if v is None or v != v:
            continue
        hist = px[s].dropna()
        fr.append({"sym": s, "name": name, "price": float(v), "chg": float(v / prev.get(s) - 1) if prev.get(s) else None,
                   "m1": float(v / hist.iloc[0] - 1) if len(hist) > 1 else None, "spark": hist.tolist()[-22:]})
    return {"basis": rows, "front": fr, "asof": px.index[-1].strftime("%Y-%m-%d")}


def futures(q: dict, body: dict) -> dict:
    root = (q.get("root") or "CL").upper()
    if root not in FUT_ROOTS:
        raise BadRequest("지원하는 선물: " + ", ".join(f"{k}({v[0]})" for k, v in FUT_ROOTS.items()))
    out = {"roots": [{"root": k, "name": v[0]} for k, v in FUT_ROOTS.items()]}
    out.update(_futures(root))
    try:
        out.update(_basis())
    except BadRequest:
        out.update({"basis": [], "front": []})
    return clean(out)


ROUTES = {
    ("GET", "/api/derivatives/expirations"): expirations,
    ("GET", "/api/derivatives/chain"): chain,
    ("GET", "/api/derivatives/ivterm"): iv_term,
    ("POST", "/api/derivatives/price"): price_option,
    ("POST", "/api/derivatives/iv"): iv_solve,
    ("POST", "/api/derivatives/strategy"): strategy,
    ("POST", "/api/derivatives/bond"): bond,
    ("GET", "/api/derivatives/vix"): vix,
    ("GET", "/api/derivatives/futures"): futures,
}

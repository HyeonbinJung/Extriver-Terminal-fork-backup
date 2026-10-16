"""백테스트 — pandas 벡터 연산으로 구현한 단일 종목 롱 전략 엔진.

규칙: 신호는 t일 종가에 계산 → 같은 날 종가에 체결 → t+1일 수익률부터 반영
(미래 데이터 사용 없음). 수수료는 매매 금액 × fee% (진입·청산 각각).
"""

from __future__ import annotations

import math

import numpy as np
import pandas as pd

from api.portfolio import daily  # local-date-correct daily bars
from api.common import TRADING_DAYS, BadRequest, cached, check_period, check_symbol, clean, dates, num, rsi

STRATEGIES = {
    "buyhold": {"name": "매수 후 보유", "params": {}},
    "sma": {"name": "이동평균 교차", "params": {"fast": (20, 2, 200), "slow": (60, 5, 400)}},
    "rsi": {"name": "RSI 역추세", "params": {"n": (14, 2, 50), "lower": (30, 5, 50), "upper": (70, 50, 95)}},
    "bollinger": {"name": "볼린저 밴드 평균회귀", "params": {"n": (20, 5, 100), "k": (2.0, 0.5, 4.0)}},
    "macd": {"name": "MACD 교차", "params": {"fast": (12, 2, 50), "slow": (26, 5, 100), "signal": (9, 2, 50)}},
    "momentum": {"name": "모멘텀", "params": {"lookback": (90, 5, 300), "threshold": (0.0, -0.5, 0.5)}},
    "donchian": {"name": "돌파 (돈치안 채널)", "params": {"entry": (20, 5, 250), "exit": (10, 2, 250)}},
    "dca": {"name": "적립식 매수 (매월)", "params": {}},
}
GRIDS = {
    "sma": ("fast", [5, 10, 15, 20, 30, 40, 50], "slow", [20, 40, 60, 80, 100, 150, 200]),
    "rsi": ("lower", [20, 25, 30, 35, 40], "upper", [60, 65, 70, 75, 80]),
    "bollinger": ("n", [10, 15, 20, 30, 40, 50], "k", [1.0, 1.5, 2.0, 2.5, 3.0]),
    "macd": ("fast", [5, 8, 12, 16, 20], "slow", [20, 26, 35, 50, 70]),
    "momentum": ("lookback", [20, 40, 60, 90, 120, 180, 250], "threshold", [0.0, 0.02, 0.05, 0.1, 0.2]),
    "donchian": ("entry", [10, 20, 40, 55, 100, 150], "exit", [5, 10, 20, 40, 60]),
}


def _params(strategy: str, raw: dict | None) -> dict:
    if strategy not in STRATEGIES:
        raise BadRequest("알 수 없는 전략입니다.")
    raw = raw or {}
    out = {}
    for k, (d, lo, hi) in STRATEGIES[strategy]["params"].items():
        v = num(raw.get(k), k, lo, hi, default=d)
        out[k] = int(round(v)) if isinstance(d, int) else v
    if strategy == "sma" and out["fast"] >= out["slow"]:
        raise BadRequest("단기 이동평균은 장기 이동평균보다 짧아야 합니다.")
    if strategy == "macd" and out["fast"] >= out["slow"]:
        raise BadRequest("MACD 단기 기간은 장기 기간보다 짧아야 합니다.")
    if strategy == "rsi" and out["lower"] >= out["upper"]:
        raise BadRequest("RSI 매수 기준은 매도 기준보다 낮아야 합니다.")
    return out


def _hold_state(enter: pd.Series, exit_: pd.Series) -> pd.Series:
    """Stateful long/flat from entry/exit booleans (exit wins ties)."""
    s = pd.Series(np.nan, index=enter.index)
    s[enter.fillna(False)] = 1.0
    s[exit_.fillna(False)] = 0.0
    return s.ffill().fillna(0.0)


def signals(df: pd.DataFrame, strategy: str, p: dict):
    """→ (position 0/1 Series, price overlays, indicator panel)."""
    c, h, l = df["close"], df["high"], df["low"]
    ov, ind = [], None
    if strategy == "buyhold":
        pos = pd.Series(1.0, index=c.index)
    elif strategy == "sma":
        f, s = c.rolling(p["fast"]).mean(), c.rolling(p["slow"]).mean()
        pos = (f > s).astype(float)
        ov = [("SMA " + str(p["fast"]), "#0891b2", f), ("SMA " + str(p["slow"]), "#ca8a04", s)]
    elif strategy == "rsi":
        r = rsi(c, p["n"])
        pos = _hold_state(r < p["lower"], r > p["upper"])
        ind = {"name": f"RSI({p['n']})", "lines": [("RSI", "#9333ea", r)], "levels": [p["lower"], p["upper"]]}
    elif strategy == "bollinger":
        m, sd = c.rolling(p["n"]).mean(), c.rolling(p["n"]).std()
        up, lo = m + p["k"] * sd, m - p["k"] * sd
        pos = _hold_state(c < lo, c > m)
        ov = [("중심선", "#ca8a04", m), ("상단", "#0891b2", up), ("하단", "#0891b2", lo)]
    elif strategy == "macd":
        macd = c.ewm(span=p["fast"], adjust=False).mean() - c.ewm(span=p["slow"], adjust=False).mean()
        sig = macd.ewm(span=p["signal"], adjust=False).mean()
        pos = (macd > sig).astype(float)
        ind = {"name": "MACD", "lines": [("MACD", "#0891b2", macd), ("시그널", "#d97706", sig)], "levels": [0],
               "hist": macd - sig}
    elif strategy == "momentum":
        mom = c / c.shift(p["lookback"]) - 1
        pos = (mom > p["threshold"]).astype(float)
        ind = {"name": f"{p['lookback']}일 수익률(%)", "lines": [("모멘텀", "#16a34a", mom * 100)],
               "levels": [p["threshold"] * 100]}
    elif strategy == "donchian":
        hi = h.rolling(p["entry"]).max().shift(1)
        lo = l.rolling(p["exit"]).min().shift(1)
        pos = _hold_state(c > hi, c < lo)
        ov = [(f"{p['entry']}일 고가", "#16a34a", hi), (f"{p['exit']}일 저가", "#dc2626", lo)]
    else:
        raise BadRequest("알 수 없는 전략입니다.")
    warm = {"sma": p.get("slow"), "rsi": 2 * p.get("n", 0), "bollinger": p.get("n"), "macd": p.get("slow"),
            "momentum": p.get("lookback"), "donchian": p.get("entry")}.get(strategy) or 0
    pos = pos.fillna(0.0)
    if warm:  # no trades until the indicator has enough history
        pos.iloc[:warm] = 0.0
    return pos, ov, ind


def _sizing(df, mode: str, value: float) -> pd.Series:
    if mode == "voltarget":
        rv = df["close"].pct_change().rolling(20).std() * math.sqrt(TRADING_DAYS)
        return (value / rv).clip(0, 1).bfill().fillna(0.0)
    return pd.Series(value, index=df.index)


def _metrics(equity: pd.Series, held: pd.Series | None, trades: list[dict], rf: float = 0.03) -> dict:
    r = equity.pct_change().dropna()
    years = max(len(r) / TRADING_DAYS, 1e-9)
    total = equity.iloc[-1] / equity.iloc[0] - 1
    cagr = (1 + total) ** (1 / years) - 1 if total > -1 else -1.0
    vol = r.std() * math.sqrt(TRADING_DAYS)
    dn = r[r < 0].std() * math.sqrt(TRADING_DAYS)
    dd = equity / equity.cummax() - 1
    closed = [t for t in trades if t.get("exit_date")]
    wins = [t for t in closed if t["ret"] > 0]
    gp = sum(t["pnl"] for t in closed if t["pnl"] > 0)
    gl = -sum(t["pnl"] for t in closed if t["pnl"] < 0)
    hold_days = [t["days"] for t in trades if t.get("days") is not None]
    return {
        "total_return": total, "cagr": cagr, "volatility": vol,
        "sharpe": (r.mean() * TRADING_DAYS - rf) / vol if vol else None,
        "sortino": (r.mean() * TRADING_DAYS - rf) / dn if dn else None,
        "max_drawdown": dd.min(), "calmar": cagr / abs(dd.min()) if dd.min() else None,
        "win_rate": len(wins) / len(closed) if closed else None, "trades": len(trades),
        "avg_hold": float(np.mean(hold_days)) if hold_days else None,
        "profit_factor": gp / gl if gl else (None if not gp else 99.0),
        "exposure": float((held > 0).mean()) if held is not None else None,
        "avg_trade": float(np.mean([t["ret"] for t in closed])) if closed else None,
        "best_trade": max((t["ret"] for t in closed), default=None),
        "worst_trade": min((t["ret"] for t in closed), default=None),
        "final": equity.iloc[-1],
    }


def simulate(df: pd.DataFrame, strategy: str, p: dict, capital: float, fee: float, size_mode="fixed", size=1.0):
    c = df["close"]
    if strategy == "dca":
        return _dca(df, capital, fee)
    pos, ov, ind = signals(df, strategy, p)
    tgt = (pos * _sizing(df, size_mode, size)).clip(0, 1)
    if size_mode == "voltarget":  # rebalance size only on entries to avoid daily churn
        tgt = tgt.where(pos.diff().fillna(pos) != 0).where(pos > 0, 0).ffill().fillna(0)
    ret = c.pct_change().fillna(0)
    held = tgt.shift(1).fillna(0)
    turn = tgt.diff().abs().fillna(tgt.iloc[0])
    strat = held * ret - turn * fee
    equity = capital * (1 + strat).cumprod()

    trades, entry = [], None
    pv, idx = pos.values, c.index
    for i in range(len(pv)):
        if entry is None and pv[i] > 0:
            entry = i
        elif entry is not None and pv[i] == 0:
            trades.append((entry, i))
            entry = None
    if entry is not None:
        trades.append((entry, None))
    tl = []
    for a, b in trades:
        e_px = float(c.iloc[a])
        x_px = float(c.iloc[b if b is not None else -1])
        rr = x_px / e_px * (1 - fee) ** 2 - 1
        stake = float(equity.iloc[a]) * float(tgt.iloc[a])
        tl.append({"entry_date": idx[a].strftime("%Y-%m-%d"), "entry": e_px,
                   "exit_date": idx[b].strftime("%Y-%m-%d") if b is not None else None, "exit": x_px if b is not None else None,
                   "last": x_px, "ret": rr, "pnl": stake * rr, "size": float(tgt.iloc[a]),
                   "days": int((idx[b if b is not None else -1] - idx[a]).days)})
    markers = []
    for t in tl:
        markers.append({"time": t["entry_date"], "position": "belowBar", "color": "#16a34a", "shape": "arrowUp", "text": "B"})
        if t["exit_date"]:
            markers.append({"time": t["exit_date"], "position": "aboveBar", "color": "#dc2626", "shape": "arrowDown", "text": "S"})
    return {"equity": equity, "held": held, "trades": tl, "markers": markers, "overlays": ov, "indicator": ind}


def _dca(df, capital, fee):
    c = df["close"]
    months = c.groupby([c.index.year, c.index.month]).head(1).index
    amt = capital / len(months)
    buy = pd.Series(0.0, index=c.index)
    buy[months] = amt
    shares = (buy * (1 - fee) / c).cumsum()
    cash = capital - buy.cumsum()
    equity = cash + shares * c
    tl = [{"entry_date": d.strftime("%Y-%m-%d"), "entry": float(c[d]), "exit_date": None, "exit": None,
           "last": float(c.iloc[-1]), "ret": float(c.iloc[-1] / c[d] * (1 - fee) - 1), "pnl": amt * float(c.iloc[-1] / c[d] * (1 - fee) - 1),
           "size": amt / capital, "days": int((c.index[-1] - d).days)} for d in months]
    markers = [{"time": t["entry_date"], "position": "belowBar", "color": "#16a34a", "shape": "arrowUp", "text": ""} for t in tl]
    held = (shares * c) / equity
    return {"equity": equity, "held": held, "trades": tl, "markers": markers, "overlays": [], "indicator": None,
            "dca": {"monthly": amt, "months": len(months), "avg_price": float(capital * (1 - fee) / shares.iloc[-1]) if shares.iloc[-1] else None}}


def _monthly(equity: pd.Series) -> list[dict]:
    me = equity.resample("ME").last()
    m = me.pct_change()
    m.iloc[0] = me.iloc[0] / equity.iloc[0] - 1
    rows = {}
    for d, v in m.items():
        rows.setdefault(d.year, [None] * 12)[d.month - 1] = v
    ye = equity.resample("YE").last()
    yr = ye.pct_change()
    yr.iloc[0] = ye.iloc[0] / equity.iloc[0] - 1
    return [{"year": y, "months": v, "total": float(yr[yr.index.year == y].iloc[0])} for y, v in sorted(rows.items())]


def _inputs(body):
    sym = check_symbol(body.get("symbol"))
    period = check_period(body.get("period"), "5y")
    if period in ("5d", "1mo", "3mo"):
        raise BadRequest("백테스트 기간은 6개월 이상으로 선택하세요.")
    capital = num(body.get("capital"), "초기 자본", 100, 1e13, default=10_000_000 if sym.endswith((".KS", ".KQ")) else 10_000)
    fee = num(body.get("fee"), "수수료(%)", 0, 5, default=0.1) / 100
    mode = body.get("size_mode") or "fixed"
    if mode not in ("fixed", "voltarget"):
        raise BadRequest("포지션 크기 방식이 올바르지 않습니다.")
    size = num(body.get("size"), "포지션 비율", 0.05, 1, default=1) if mode == "fixed" else \
        num(body.get("size"), "목표 변동성", 0.02, 1, default=0.15)
    df = daily(sym, period)
    if len(df) < 60:
        raise BadRequest("가격 데이터가 너무 짧습니다 (60거래일 미만).")
    return sym, period, capital, fee, mode, size, df


def _series(s):
    return [None if pd.isna(v) else round(float(v), 4) for v in s.values]


def run(q, body):
    """POST /api/backtest/run {symbol, period, capital, fee, strategy, params, size_mode, size}"""
    sym, period, capital, fee, mode, size, df = _inputs(body)
    strategy = body.get("strategy") or "sma"
    p = _params(strategy, body.get("params"))
    res = simulate(df, strategy, p, capital, fee, mode, size)
    bh = simulate(df, "buyhold", {}, capital, fee)
    eq, beq = res["equity"], bh["equity"]
    out = {
        "symbol": sym, "period": period, "strategy": strategy, "strategy_name": STRATEGIES[strategy]["name"],
        "params": p, "capital": capital, "fee": fee, "currency": "KRW" if sym.endswith((".KS", ".KQ")) else "USD",
        "dates": dates(df.index), "equity": _series(eq), "bh": _series(beq),
        "drawdown": _series(eq / eq.cummax() - 1), "bh_drawdown": _series(beq / beq.cummax() - 1),
        "metrics": _metrics(eq, res["held"], res["trades"]), "bh_metrics": _metrics(beq, bh["held"], bh["trades"]),
        "trades": res["trades"], "markers": res["markers"],
        "candles": [{"time": d, "open": o, "high": h, "low": l, "close": c, "volume": v} for d, o, h, l, c, v in
                    zip(dates(df.index), *(df[k].round(4).tolist() for k in ("open", "high", "low", "close", "volume")))],
        "overlays": [{"name": n, "color": col, "data": [{"time": d, "value": v} for d, v in zip(dates(s.index), _series(s)) if v is not None]}
                     for n, col, s in res["overlays"]],
        "indicator": None, "monthly": _monthly(eq), "exposure_series": _series(res["held"]),
    }
    ind = res["indicator"]
    if ind:
        out["indicator"] = {"name": ind["name"], "levels": ind["levels"],
                            "lines": [{"name": n, "color": col, "data": _series(s)} for n, col, s in ind["lines"]],
                            "hist": _series(ind["hist"]) if "hist" in ind else None}
    if "dca" in res:
        out["dca"] = res["dca"]
    return clean(out)


def compare(q, body):
    """POST /api/backtest/compare → 모든 전략(기본 파라미터) 비교."""
    sym, period, capital, fee, mode, size, df = _inputs(body)
    rows, curves = [], {}
    for k, meta in STRATEGIES.items():
        p = _params(k, {})
        res = simulate(df, k, p, capital, fee, mode if k not in ("buyhold", "dca") else "fixed", size if k not in ("buyhold", "dca") else 1)
        rows.append({"strategy": k, "name": meta["name"], "params": p, **_metrics(res["equity"], res["held"], res["trades"])})
        curves[k] = _series(res["equity"] / capital * 100)
    return clean({"symbol": sym, "period": period, "dates": dates(df.index), "rows": rows, "curves": curves, "capital": capital})


def optimize(q, body):
    """POST /api/backtest/optimize {symbol, period, strategy, metric} → 2-D 파라미터 격자."""
    sym, period, capital, fee, mode, size, df = _inputs(body)
    strategy = body.get("strategy") or "sma"
    if strategy not in GRIDS:
        raise BadRequest("이 전략은 파라미터 최적화를 지원하지 않습니다.")
    base = _params(strategy, body.get("params"))
    kx, xs, ky, ys = GRIDS[strategy]
    cells = []
    for yv in ys:
        row = []
        for xv in xs:
            p = {**base, kx: xv, ky: yv}
            if (strategy in ("sma", "macd") and p["fast"] >= p["slow"]) or (strategy == "rsi" and p["lower"] >= p["upper"]):
                row.append(None)
                continue
            res = simulate(df, strategy, p, capital, fee, mode, size)
            m = _metrics(res["equity"], res["held"], res["trades"])
            row.append({k: m[k] for k in ("sharpe", "total_return", "cagr", "max_drawdown", "trades", "win_rate")})
        cells.append(row)
    return clean({"symbol": sym, "strategy": strategy, "x": {"key": kx, "values": xs}, "y": {"key": ky, "values": ys},
                  "cells": cells, "base": base,
                  "note": "같은 데이터에서 가장 좋았던 값은 과최적화(curve fitting)일 가능성이 큽니다. 주변 값도 고르게 좋은 영역을 고르세요."})


def strategies(q, body):
    return {"strategies": [{"id": k, "name": v["name"], "params": {pk: {"default": d, "min": lo, "max": hi} for pk, (d, lo, hi) in v["params"].items()},
                            "grid": k in GRIDS} for k, v in STRATEGIES.items()]}


ROUTES = {
    ("POST", "/api/backtest/run"): run,
    ("POST", "/api/backtest/compare"): compare,
    ("POST", "/api/backtest/optimize"): optimize,
    ("GET", "/api/backtest/strategies"): strategies,
}

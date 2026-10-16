"""퀀트 랩 — 몬테카를로, 수익률 분포, 계절성, CAPM 회귀, 롤링 지표, 페어 분석, 팩터 노출.

numpy/pandas만 사용 (외부 통계 패키지 없음).
"""

from __future__ import annotations

import math

import numpy as np
import pandas as pd

from api.portfolio import daily  # local-date-correct daily bars
from api.common import (
    TRADING_DAYS,
    BadRequest,
    benchmark_for,
    cached,
    check_period,
    check_symbol,
    clean,
    dates,
    num,
)


def _close(sym, period):
    s = daily(sym, period)["close"].copy()
    s.name = sym
    return s


def _ols(y, X):
    X = np.asarray(X, float)
    if X.ndim == 1:
        X = X.reshape(-1, 1)
    X1 = np.column_stack([np.ones(len(y)), X])
    coef, *_ = np.linalg.lstsq(X1, y, rcond=None)
    resid = y - X1 @ coef
    dof = max(len(y) - X1.shape[1], 1)
    s2 = resid @ resid / dof
    se = np.sqrt(np.clip(np.diag(s2 * np.linalg.pinv(X1.T @ X1)), 1e-30, None))
    sst = ((y - y.mean()) ** 2).sum()
    r2 = 1 - (resid @ resid) / sst if sst else 0.0
    return {"coef": coef, "se": se, "t": coef / se, "r2": r2, "resid": resid,
            "adj_r2": 1 - (1 - r2) * (len(y) - 1) / dof if dof else r2}


def _ncdf(x):
    return 0.5 * (1 + math.erf(x / math.sqrt(2)))


def _pval_t(t):  # two-sided, normal approximation (n is large)
    return 2 * (1 - _ncdf(abs(t)))


def _sym(q, key="symbol", default="AAPL"):
    return check_symbol(q.get(key) or default)


def _bench(q, sym):
    return check_symbol(q.get("bench") or ("^KS11" if sym.endswith((".KS", ".KQ")) else "SPY"))


def _aligned(a: pd.Series, b: pd.Series) -> pd.DataFrame:
    df = pd.concat([a.pct_change(), b.pct_change()], axis=1).dropna()
    if len(df) < 30:
        raise BadRequest("공통 거래일이 너무 적습니다. 기간을 늘려 보세요.")
    return df


# ------------------------------------------------------------- Monte Carlo
def montecarlo(q, body):
    """GET /api/quant/montecarlo?symbol&period=2y&days=252&sims=2000&target=&model=gbm|bootstrap"""
    sym = _sym(q)
    period = check_period(q.get("period"), "2y")
    days = int(num(q.get("days"), "기간(거래일)", 5, 1260, default=252))
    sims = int(num(q.get("sims"), "시뮬레이션 횟수", 100, 10000, default=2000))
    model = q.get("model") or "gbm"
    if model not in ("gbm", "bootstrap"):
        raise BadRequest("모형은 gbm 또는 bootstrap 입니다.")
    c = _close(sym, period)
    lr = np.log(c / c.shift(1)).dropna().values
    if len(lr) < 30:
        raise BadRequest("가격 데이터가 너무 짧습니다.")
    s0 = float(c.iloc[-1])
    target = num(q.get("target"), "목표가", 0, 1e12, default=round(s0 * 1.1, 2))
    mu, sig = lr.mean(), lr.std(ddof=1)
    drift = q.get("drift") or "hist"
    if drift not in ("hist", "zero", "custom"):
        raise BadRequest("drift는 hist, zero, custom 중 하나입니다.")
    if drift == "zero":  # 기대 가격 = 현재가 (마틴게일)
        mu = -sig ** 2 / 2
    elif drift == "custom":
        mu = math.log(1 + num(q.get("mu"), "연 기대수익률", -0.9, 3, default=0.07)) / TRADING_DAYS - sig ** 2 / 2
    if model == "bootstrap" and drift != "hist":
        lr = lr - lr.mean() + mu
    rng = np.random.default_rng(int(q.get("seed") or 7))
    if model == "gbm":
        steps = rng.normal(mu, sig, size=(sims, days))
    else:
        steps = rng.choice(lr, size=(sims, days), replace=True)
    paths = s0 * np.exp(np.cumsum(steps, axis=1))
    paths = np.column_stack([np.full(sims, s0), paths])
    pct = {str(p): np.percentile(paths, p, axis=0).round(4).tolist() for p in (5, 25, 50, 75, 95)}
    term = paths[:, -1]
    hist, edges = np.histogram(term, bins=50)
    touched = (paths.max(axis=1) >= target) if target >= s0 else (paths.min(axis=1) <= target)
    mdd = (paths / np.maximum.accumulate(paths, axis=1) - 1).min(axis=1)
    sample = paths[rng.choice(sims, size=min(30, sims), replace=False)].round(4).tolist()
    hist_days = min(len(c), 252)
    return clean({
        "symbol": sym, "s0": s0, "days": days, "sims": sims, "model": model, "target": target, "drift": drift,
        "mu_annual": mu * TRADING_DAYS, "sigma_annual": sig * math.sqrt(TRADING_DAYS),
        "percentiles": pct, "sample_paths": sample,
        "history": {"dates": dates(c.index[-hist_days:]), "close": c.iloc[-hist_days:].round(4).tolist()},
        "terminal": {"mean": float(term.mean()), "median": float(np.median(term)), "p5": float(np.percentile(term, 5)),
                     "p95": float(np.percentile(term, 95)), "prob_up": float((term > s0).mean()),
                     "prob_above_target": float((term > target).mean()), "prob_touch_target": float(touched.mean()),
                     "prob_loss_20": float((term < s0 * 0.8).mean()), "exp_return": float(term.mean() / s0 - 1),
                     "median_mdd": float(np.median(mdd)), "hist": hist.tolist(), "edges": np.round(edges, 4).tolist()},
    })


# ------------------------------------------------------------- distribution
def distribution(q, body):
    """GET /api/quant/distribution?symbol&period=5y&freq=d|w|m"""
    sym = _sym(q)
    period = check_period(q.get("period"), "5y")
    freq = q.get("freq") or "d"
    if freq not in ("d", "w", "m"):
        raise BadRequest("빈도는 d, w, m 중 하나입니다.")
    c = _close(sym, period)
    if freq == "w":
        c = c.resample("W-FRI").last().dropna()
    elif freq == "m":
        c = c.resample("ME").last().dropna()
    r = c.pct_change().dropna()
    if len(r) < 20:
        raise BadRequest("표본이 너무 적습니다. 기간을 늘리거나 빈도를 낮추세요.")
    x = r.values
    n = len(x)
    mu, sd = x.mean(), x.std(ddof=1)
    z = (x - mu) / x.std()
    skew = float((z ** 3).mean())
    kurt = float((z ** 4).mean() - 3)
    jb = n / 6 * (skew ** 2 + kurt ** 2 / 4)
    pjb = math.exp(-jb / 2)  # chi-square(2) survival function
    lo, hi = np.percentile(x, 0.5), np.percentile(x, 99.5)
    bins = np.linspace(min(lo, mu - 4 * sd), max(hi, mu + 4 * sd), 51)
    counts, edges = np.histogram(np.clip(x, bins[0], bins[-1]), bins=bins)
    mids = (edges[:-1] + edges[1:]) / 2
    width = edges[1] - edges[0]
    normal = n * width * np.exp(-((mids - mu) ** 2) / (2 * sd ** 2)) / (sd * math.sqrt(2 * math.pi))
    var = {}
    for cl, zz in ((95, 1.6449), (99, 2.3263)):
        qv = np.percentile(x, 100 - cl)
        var[str(cl)] = {"hist": float(-qv), "param": float(-(mu - zz * sd)), "cvar": float(-x[x <= qv].mean())}
    k = math.sqrt({"d": TRADING_DAYS, "w": 52, "m": 12}[freq])
    tail_obs = int((np.abs(z) > 3).sum())
    worst = r.nsmallest(5)
    best = r.nlargest(5)
    return clean({
        "symbol": sym, "period": period, "freq": freq, "n": n,
        "mean": mu, "std": sd, "ann_vol": sd * k, "skew": skew, "kurtosis": kurt, "jb": jb, "jb_p": pjb,
        "normal_rejected": pjb < 0.05, "tail_3sigma": tail_obs, "tail_3sigma_normal": n * 0.0027,
        "positive": float((x > 0).mean()), "median": float(np.median(x)),
        "hist": {"mids": np.round(mids * 100, 3).tolist(), "counts": counts.tolist(), "normal": np.round(normal, 3).tolist()},
        "var": var,
        "worst": [{"date": d.strftime("%Y-%m-%d"), "ret": float(v)} for d, v in worst.items()],
        "best": [{"date": d.strftime("%Y-%m-%d"), "ret": float(v)} for d, v in best.items()],
        "qq": _qq(z),
    })


def _qq(z):
    zs = np.sort(z)
    n = len(zs)
    # Acklam-free normal quantiles via erfinv approximation (Winitzki)
    p = (np.arange(1, n + 1) - 0.5) / n
    a = 0.147
    y = 2 * p - 1
    ln = np.log(1 - y ** 2)
    t = 2 / (math.pi * a) + ln / 2
    erfinv = np.sign(y) * np.sqrt(np.sqrt(t ** 2 - ln / a) - t)
    theo = math.sqrt(2) * erfinv
    idx = np.unique(np.linspace(0, n - 1, min(n, 300)).astype(int))
    return {"theory": np.round(theo[idx], 3).tolist(), "sample": np.round(zs[idx], 3).tolist()}


# ------------------------------------------------------------- seasonality
def seasonality(q, body):
    """GET /api/quant/seasonality?symbol&period=10y"""
    sym = _sym(q)
    period = check_period(q.get("period"), "10y")
    c = _close(sym, period)
    me = c.resample("ME").last()
    m = me.pct_change().dropna()
    if len(m) < 12:
        raise BadRequest("계절성 분석에는 최소 1년 이상의 데이터가 필요합니다.")
    grid = {}
    for d, v in m.items():
        grid.setdefault(d.year, [None] * 12)[d.month - 1] = float(v)
    by_month = []
    for i in range(1, 13):
        v = m[m.index.month == i]
        by_month.append({"month": i, "avg": float(v.mean()) if len(v) else None, "median": float(v.median()) if len(v) else None,
                         "win": float((v > 0).mean()) if len(v) else None, "n": int(len(v)),
                         "best": float(v.max()) if len(v) else None, "worst": float(v.min()) if len(v) else None})
    d = c.pct_change().dropna()
    dow = []
    for i, name in enumerate(["월", "화", "수", "목", "금"]):
        v = d[d.index.dayofweek == i]
        dow.append({"day": name, "avg": float(v.mean()) if len(v) else None, "win": float((v > 0).mean()) if len(v) else None,
                    "vol": float(v.std()) if len(v) > 1 else None, "n": int(len(v))})
    ye = c.resample("YE").last()
    yr = ye.pct_change()
    yr.iloc[0] = ye.iloc[0] / c.iloc[0] - 1
    # turn-of-month: last trading day + first 3 trading days
    tom = d.groupby([d.index.year, d.index.month])
    first3 = tom.head(3)
    last1 = tom.tail(1)
    tom_ret = pd.concat([first3, last1])
    rest = d.drop(tom_ret.index, errors="ignore")
    return clean({
        "symbol": sym, "period": period,
        "grid": [{"year": y, "months": v, "total": float(yr[yr.index.year == y].iloc[0]) if (yr.index.year == y).any() else None}
                 for y, v in sorted(grid.items())],
        "by_month": by_month, "dow": dow,
        "turn_of_month": {"tom_avg": float(tom_ret.mean()), "rest_avg": float(rest.mean()) if len(rest) else None},
        "best_month": max(by_month, key=lambda x: x["avg"] if x["avg"] is not None else -9)["month"],
        "worst_month": min(by_month, key=lambda x: x["avg"] if x["avg"] is not None else 9)["month"],
    })


# ------------------------------------------------------------- CAPM
def capm(q, body):
    """GET /api/quant/capm?symbol&bench&period=2y&rf=0.03&freq=d|w"""
    sym = _sym(q)
    bench = _bench(q, sym)
    period = check_period(q.get("period"), "2y")
    rf = num(q.get("rf"), "무위험 이자율", 0, 0.2, default=0.03)
    freq = q.get("freq") or "d"
    a, b = _close(sym, period), _close(bench, period)
    if freq == "w":
        a, b = a.resample("W-FRI").last(), b.resample("W-FRI").last()
    per = 52 if freq == "w" else TRADING_DAYS
    df = _aligned(a, b)
    ex_a = df.iloc[:, 0].values - rf / per
    ex_b = df.iloc[:, 1].values - rf / per
    o = _ols(ex_a, ex_b)
    alpha, beta = float(o["coef"][0]), float(o["coef"][1])
    ann_ret_a = float(df.iloc[:, 0].mean() * per)
    ann_ret_b = float(df.iloc[:, 1].mean() * per)
    vol_a = float(df.iloc[:, 0].std() * math.sqrt(per))
    resid_vol = float(np.std(o["resid"], ddof=2) * math.sqrt(per))
    idx = np.unique(np.linspace(0, len(df) - 1, min(len(df), 800)).astype(int))
    xs = np.array([ex_b.min(), ex_b.max()])
    return clean({
        "symbol": sym, "bench": bench, "period": period, "freq": freq, "n": len(df),
        "alpha": alpha * per, "alpha_t": float(o["t"][0]), "alpha_p": _pval_t(o["t"][0]),
        "beta": beta, "beta_t": float(o["t"][1]), "beta_se": float(o["se"][1]), "r2": float(o["r2"]),
        "corr": float(np.corrcoef(df.iloc[:, 0], df.iloc[:, 1])[0, 1]),
        "ret": ann_ret_a, "bench_ret": ann_ret_b, "vol": vol_a, "resid_vol": resid_vol,
        "systematic_share": float(o["r2"]),
        "expected_capm": rf + beta * (ann_ret_b - rf),
        "treynor": (ann_ret_a - rf) / beta if beta else None,
        "info_ratio": alpha * per / resid_vol if resid_vol else None,
        "scatter": {"x": np.round(ex_b[idx] * 100, 3).tolist(), "y": np.round(ex_a[idx] * 100, 3).tolist()},
        "line": {"x": np.round(xs * 100, 3).tolist(), "y": np.round((o["coef"][0] + beta * xs) * 100, 3).tolist()},
    })


# ------------------------------------------------------------- rolling
def rolling(q, body):
    """GET /api/quant/rolling?symbol&bench&period=5y&window=60&rf=0.03"""
    sym = _sym(q)
    bench = _bench(q, sym)
    period = check_period(q.get("period"), "5y")
    w = int(num(q.get("window"), "롤링 기간", 10, 252, default=60))
    rf = num(q.get("rf"), "무위험 이자율", 0, 0.2, default=0.03)
    df = _aligned(_close(sym, period), _close(bench, period))
    if len(df) < w + 20:
        raise BadRequest("데이터가 롤링 기간보다 짧습니다. 기간을 늘리거나 롤링 기간을 줄이세요.")
    ra, rb = df.iloc[:, 0], df.iloc[:, 1]
    vol = ra.rolling(w).std() * math.sqrt(TRADING_DAYS)
    bvol = rb.rolling(w).std() * math.sqrt(TRADING_DAYS)
    beta = ra.rolling(w).cov(rb) / rb.rolling(w).var()
    corr = ra.rolling(w).corr(rb)
    sharpe = (ra.rolling(w).mean() * TRADING_DAYS - rf) / vol
    ret = (1 + ra).rolling(w).apply(np.prod, raw=True) - 1
    px = _close(sym, period)
    dd = px / px.cummax() - 1
    keep = vol.dropna().index

    def ser(s):
        return [None if pd.isna(v) else round(float(v), 4) for v in s.reindex(keep).values]

    last = lambda s: float(s.dropna().iloc[-1]) if s.notna().any() else None  # noqa: E731
    return clean({
        "symbol": sym, "bench": bench, "window": w, "dates": dates(keep),
        "vol": ser(vol), "bench_vol": ser(bvol), "beta": ser(beta), "corr": ser(corr), "sharpe": ser(sharpe),
        "ret": ser(ret), "drawdown": ser(dd),
        "last": {"vol": last(vol), "beta": last(beta), "corr": last(corr), "sharpe": last(sharpe), "ret": last(ret)},
        "range": {k: {"min": float(s.min()), "max": float(s.max()), "mean": float(s.mean())}
                  for k, s in (("vol", vol), ("beta", beta), ("sharpe", sharpe), ("corr", corr))},
    })


# ------------------------------------------------------------- pairs
def _adf_t(s: np.ndarray, lags: int = 1) -> float:
    ds = np.diff(s)
    y = ds[lags:]
    cols = [s[lags:-1]] + [ds[lags - k:-k] for k in range(1, lags + 1)]
    o = _ols(y, np.column_stack(cols))
    return float(o["t"][1])


def pairs(q, body):
    """GET /api/quant/pairs?a&b&period=2y&window=60&entry=2"""
    a, b = check_symbol(q.get("a") or "KO"), check_symbol(q.get("b") or "PEP")
    if a == b:
        raise BadRequest("서로 다른 두 종목을 입력하세요.")
    period = check_period(q.get("period"), "2y")
    w = int(num(q.get("window"), "z-score 기간", 10, 252, default=60))
    entry = num(q.get("entry"), "진입 z", 0.5, 4, default=2.0)
    px = pd.concat([_close(a, period), _close(b, period)], axis=1).dropna()
    if len(px) < w + 30:
        raise BadRequest("공통 거래일이 부족합니다. 기간을 늘려 보세요.")
    la, lb = np.log(px.iloc[:, 0]), np.log(px.iloc[:, 1])
    o = _ols(la.values, lb.values)
    hedge, const = float(o["coef"][1]), float(o["coef"][0])
    spread = la - hedge * lb - const
    z = (spread - spread.rolling(w).mean()) / spread.rolling(w).std()
    adf = _adf_t(spread.values)
    # half-life of mean reversion: Δs = λ s_{t-1}
    lam = _ols(np.diff(spread.values), spread.values[:-1])["coef"][1]
    half = float(-math.log(2) / lam) if lam < 0 else None
    ret = px.pct_change().dropna()
    # simple z-score strategy: short spread when z>entry, long when z<-entry, exit at 0
    sig = pd.Series(np.nan, index=z.index)
    sig[z > entry] = -1
    sig[z < -entry] = 1
    sig[(z.shift(1) * z) < 0] = 0
    sig = sig.ffill().fillna(0)
    spr_ret = (ret.iloc[:, 0] - hedge * ret.iloc[:, 1]).reindex(sig.index).fillna(0)
    strat = (sig.shift(1).fillna(0) * spr_ret)
    eq = (1 + strat).cumprod()
    norm = px / px.iloc[0] * 100
    crit = {"1%": -3.90, "5%": -3.34, "10%": -3.04}  # Engle-Granger (2 variables)
    return clean({
        "a": a, "b": b, "period": period, "window": w, "entry": entry, "n": len(px), "dates": dates(px.index),
        "pa": norm.iloc[:, 0].round(3).tolist(), "pb": norm.iloc[:, 1].round(3).tolist(),
        "hedge": hedge, "const": const, "r2": float(o["r2"]),
        "corr": float(ret.iloc[:, 0].corr(ret.iloc[:, 1])), "corr_price": float(px.iloc[:, 0].corr(px.iloc[:, 1])),
        "spread": spread.round(5).tolist(), "z": [None if pd.isna(v) else round(float(v), 3) for v in z.values],
        "z_last": float(z.iloc[-1]) if pd.notna(z.iloc[-1]) else None,
        "adf_t": adf, "crit": crit, "cointegrated": adf < crit["5%"], "half_life": half,
        "strategy": {"equity": eq.round(5).tolist(), "total": float(eq.iloc[-1] - 1),
                     "trades": int((sig.diff().fillna(0) != 0).sum()), "exposure": float((sig != 0).mean())},
    })


# ------------------------------------------------------------- factors
FACTORS = [
    ("MKT", "시장", "SPY", None, "S&P500 ETF 초과수익 (시장 위험)"),
    ("SMB", "규모(소형주)", "IWM", "SPY", "소형주(IWM) − 대형주(SPY): +면 소형주처럼 움직임"),
    ("HML", "가치", "IWD", "IWF", "가치주(IWD) − 성장주(IWF): +면 가치주, −면 성장주 성향"),
    ("MOM", "모멘텀", "MTUM", "SPY", "모멘텀 ETF(MTUM) − 시장: +면 최근 강세주 성향"),
    ("QUAL", "퀄리티", "QUAL", "SPY", "우량주 ETF(QUAL) − 시장"),
    ("LVOL", "저변동성", "USMV", "SPY", "저변동성 ETF(USMV) − 시장: +면 방어적"),
]


@cached(1800)
def _factor_frame(period: str) -> pd.DataFrame:
    need = sorted({f[2] for f in FACTORS} | {f[3] for f in FACTORS if f[3]})
    px = pd.concat([_close(s, period) for s in need], axis=1).dropna()
    r = px.pct_change().dropna()
    out = pd.DataFrame(index=r.index)
    for k, _, long_, short, _ in FACTORS:
        out[k] = r[long_] - (r[short] if short else 0)
    return out


def factors(q, body):
    """GET /api/quant/factors?symbol&period=3y&rf=0.03&freq=d|w"""
    sym = _sym(q)
    period = check_period(q.get("period"), "5y")
    rf = num(q.get("rf"), "무위험 이자율", 0, 0.2, default=0.03)
    freq = q.get("freq") or "w"
    if freq not in ("d", "w"):
        raise BadRequest("빈도는 d 또는 w 입니다.")
    F = _factor_frame(period)
    r = _close(sym, period).pct_change().rename("y")
    df = pd.concat([r, F], axis=1).dropna()
    if freq == "w":
        df = (1 + df).resample("W-FRI").prod() - 1
        df = df[(df != 0).any(axis=1)]
    per = 52 if freq == "w" else TRADING_DAYS
    if len(df) < 40:
        raise BadRequest("공통 데이터가 부족합니다. 기간을 늘려 보세요.")
    keys = [f[0] for f in FACTORS]
    y = df["y"].values - rf / per
    X = df[keys].copy()
    X["MKT"] = X["MKT"] - rf / per
    o = _ols(y, X.values)
    capm_ = _ols(y, X[["MKT"]].values)
    var_y = y.var()
    rows = []
    for i, (k, name, l, s, desc) in enumerate(FACTORS):
        bcoef = float(o["coef"][i + 1])
        contrib = bcoef * float(X[k].mean()) * per
        rows.append({"key": k, "name": name, "proxy": f"{l}" + (f" − {s}" if s else " − 무위험"), "desc": desc,
                     "beta": bcoef, "t": float(o["t"][i + 1]), "p": _pval_t(o["t"][i + 1]),
                     "significant": abs(o["t"][i + 1]) > 1.96, "ret_contrib": contrib,
                     "factor_ret": float(X[k].mean() * per)})
    fc = X.corr().round(3).values.tolist()
    return clean({
        "symbol": sym, "period": period, "freq": freq, "n": len(df),
        "alpha": float(o["coef"][0] * per), "alpha_t": float(o["t"][0]), "r2": float(o["r2"]), "adj_r2": float(o["adj_r2"]),
        "capm_r2": float(capm_["r2"]), "capm_beta": float(capm_["coef"][1]),
        "resid_vol": float(np.std(o["resid"], ddof=len(keys) + 1) * math.sqrt(per)), "total_vol": float(math.sqrt(var_y * per)),
        "factors": rows, "factor_corr": {"keys": keys, "matrix": fc},
        "note": "미국 ETF로 만든 간이 팩터입니다. 한국 종목은 미국 팩터와의 관계로 해석해야 하며 설명력(R²)이 낮게 나옵니다."
        if sym.endswith((".KS", ".KQ")) else None,
    })


ROUTES = {
    ("GET", "/api/quant/montecarlo"): montecarlo,
    ("GET", "/api/quant/distribution"): distribution,
    ("GET", "/api/quant/seasonality"): seasonality,
    ("GET", "/api/quant/capm"): capm,
    ("GET", "/api/quant/rolling"): rolling,
    ("GET", "/api/quant/pairs"): pairs,
    ("GET", "/api/quant/factors"): factors,
}

__all__ = ["ROUTES", "benchmark_for"]

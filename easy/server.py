"""
Fincept Terminal Easy — 한국어 초보자용 웹 대시보드.

Fincept Terminal의 Python 데이터 스크립트(fincept-qt/scripts)를 그대로 불러와
API 키·로그인 없이 쓸 수 있는 기능을 브라우저에서 보여줍니다.

  - 종목 분석      : yfinance_data.py (시세, 과거 가격, 기업 정보, 재무 비율, 뉴스, 검색)
  - 포트폴리오     : yfinance_data.py 과거 가격 + 평균-분산 최적화
  - DCF 가치평가   : yfinance_data.py 재무 데이터 + 현금흐름할인 계산
  - 옵션 계산기    : 블랙-숄즈 가격·그릭스
  - 경제 지표      : worldbank_data.py (세계은행 공개 API)
  - 기능 안내      : Fincept Terminal 데스크톱 앱의 전체 화면 설명

실행:  easy/.venv/Scripts/python easy/server.py --port 8770
"""

from __future__ import annotations

import argparse
import contextlib
import io
import json
import math
import os
import re
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import numpy as np
import pandas as pd

EASY_DIR = Path(__file__).resolve().parent
SCRIPTS_DIR = EASY_DIR.parent / "fincept-qt" / "scripts"
STATIC_DIR = EASY_DIR / "static"
sys.path.insert(0, str(SCRIPTS_DIR))

import worldbank_data as wb  # noqa: E402  (Fincept script)
import yfinance_data as yfd  # noqa: E402  (Fincept script)

TRADING_DAYS = 252
SYMBOL_RE = re.compile(r"^[A-Za-z0-9.\-^=]{1,20}$")
COUNTRY_RE = re.compile(r"^[A-Za-z]{2,3}$")
INDICATOR_RE = re.compile(r"^[A-Za-z0-9._]{2,40}$")
PERIODS = {"3mo", "6mo", "1y", "2y", "5y", "10y", "max"}


class BadRequest(Exception):
    pass


# --------------------------------------------------------------------------- #
# Small TTL cache — Yahoo/World Bank calls are slow and rate limited.
# --------------------------------------------------------------------------- #
_cache: dict[tuple, tuple[float, object]] = {}
_cache_lock = threading.Lock()


def cached(ttl: float):
    def deco(fn):
        def wrapper(*args):
            key = (fn.__name__, *args)
            now = time.time()
            with _cache_lock:
                hit = _cache.get(key)
                if hit and now - hit[0] < ttl:
                    return hit[1]
            value = fn(*args)
            with _cache_lock:
                _cache[key] = (now, value)
            return value

        return wrapper

    return deco


def _quiet(fn, *args):
    """Fincept scripts may print progress text; keep the server console clean."""
    with contextlib.redirect_stdout(io.StringIO()):
        return fn(*args)


def clean(obj):
    """Make values JSON-safe (NaN/inf → None, numpy → python)."""
    if isinstance(obj, dict):
        return {k: clean(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [clean(v) for v in obj]
    if isinstance(obj, (np.floating, float)):
        f = float(obj)
        return None if math.isnan(f) or math.isinf(f) else f
    if isinstance(obj, np.integer):
        return int(obj)
    return obj


def check_symbol(symbol: str) -> str:
    symbol = (symbol or "").strip().upper()
    if not SYMBOL_RE.match(symbol):
        raise BadRequest("종목 코드 형식이 올바르지 않습니다. 예: AAPL, 005930.KS, BTC-USD")
    return symbol


# --------------------------------------------------------------------------- #
# Data access (Fincept scripts)
# --------------------------------------------------------------------------- #
@cached(300)
def history(symbol: str, period: str) -> pd.Series:
    rows = _quiet(yfd.get_historical_period, symbol, period, "1d")
    if isinstance(rows, dict) or not rows:
        msg = rows.get("error") if isinstance(rows, dict) else "데이터 없음"
        raise BadRequest(f"{symbol}: 가격 데이터를 가져오지 못했습니다 ({msg}).")
    idx = pd.to_datetime([r["timestamp"] for r in rows], unit="s").normalize()
    s = pd.Series([r["close"] for r in rows], index=idx, name=symbol, dtype=float)
    return s[~s.index.duplicated(keep="last")].dropna()


@cached(300)
def quote(symbol: str) -> dict:
    return _quiet(yfd.get_quote, symbol)


@cached(3600)
def profile(symbol: str) -> dict:
    return _quiet(yfd.get_company_profile, symbol)


@cached(3600)
def ratios(symbol: str) -> dict:
    res = _quiet(yfd.get_financial_ratios, symbol)
    # The Fincept script fills missing values with 0; show them as "no data" instead.
    return {k: (None if v == 0 else v) for k, v in res.items()}


@cached(900)
def news(symbol: str) -> dict:
    res = _quiet(yfd.get_news, symbol, 8)
    if res.get("articles"):
        return res
    # Yahoo sometimes returns an empty Ticker.news; fall back to the search endpoint.
    import yfinance as yf

    try:
        with contextlib.redirect_stdout(io.StringIO()):
            items = yf.Search(symbol, news_count=8).news or []
            if not items:  # e.g. 005930.KS — search by company name instead
                name = (profile(symbol) or {}).get("companyName") or ""
                name = re.sub(r",?\s*(Co\.,?\s*)?(Ltd\.?|Inc\.?|Corp(oration)?\.?)$", "", name).strip()
                if name:
                    items = yf.Search(name, news_count=8).news or []
    except Exception as e:
        return {"symbol": symbol, "articles": [], "error": str(e)}
    return {"symbol": symbol, "articles": [
        {"title": n.get("title", ""), "url": n.get("link", ""), "publisher": n.get("publisher", ""),
         "published_date": time.strftime("%Y-%m-%d", time.localtime(n["providerPublishTime"])) if n.get("providerPublishTime") else ""}
        for n in items if n.get("title")
    ]}


@cached(3600)
def search(q: str) -> list:
    res = _quiet(yfd.search_symbols, q, 10)
    if isinstance(res, dict):
        res = res.get("results") or res.get("data") or []
    return res if isinstance(res, list) else []


@cached(3600)
def ticker_info(symbol: str) -> dict:
    import yfinance as yf

    with contextlib.redirect_stdout(io.StringIO()):
        return dict(yf.Ticker(symbol).info or {})


# --------------------------------------------------------------------------- #
# Analytics
# --------------------------------------------------------------------------- #
def rsi(close: pd.Series, n: int = 14) -> pd.Series:
    delta = close.diff()
    gain = delta.clip(lower=0).ewm(alpha=1 / n, adjust=False).mean()
    loss = (-delta.clip(upper=0)).ewm(alpha=1 / n, adjust=False).mean()
    rs = gain / loss.replace(0, np.nan)
    return 100 - 100 / (1 + rs)


def series_stats(close: pd.Series, rf: float) -> dict:
    r = close.pct_change().dropna()
    years = max(len(r) / TRADING_DAYS, 1e-9)
    total = close.iloc[-1] / close.iloc[0] - 1
    cagr = (1 + total) ** (1 / years) - 1 if total > -1 else -1
    vol = r.std() * math.sqrt(TRADING_DAYS)
    dd = close / close.cummax() - 1
    downside = r[r < 0].std() * math.sqrt(TRADING_DAYS)
    return {
        "total_return": total,
        "cagr": cagr,
        "volatility": vol,
        "sharpe": (r.mean() * TRADING_DAYS - rf) / vol if vol else None,
        "sortino": (r.mean() * TRADING_DAYS - rf) / downside if downside else None,
        "max_drawdown": dd.min(),
        "best_day": r.max(),
        "worst_day": r.min(),
        "positive_days": float((r > 0).mean()),
    }


def benchmark_for(symbol: str) -> str:
    if symbol.endswith((".KS", ".KQ")):
        return "^KS11"
    if symbol.endswith("-USD"):
        return "BTC-USD" if symbol != "BTC-USD" else "^GSPC"
    return "^GSPC"


def stock_analysis(symbol: str, period: str, rf: float) -> dict:
    close = history(symbol, period)
    if len(close) < 30:
        raise BadRequest("분석하기에 데이터가 너무 적습니다 (30거래일 미만).")
    stats = series_stats(close, rf)
    r = close.pct_change()
    rsi_s = rsi(close)
    ma20, ma60 = close.rolling(20).mean(), close.rolling(60).mean()

    bench_sym = benchmark_for(symbol)
    beta = corr = None
    try:
        b = history(bench_sym, period).pct_change()
        joined = pd.concat([r, b], axis=1, join="inner").dropna()
        if len(joined) > 20:
            cov = np.cov(joined.iloc[:, 0], joined.iloc[:, 1])
            beta = cov[0, 1] / cov[1, 1]
            corr = joined.iloc[:, 0].corr(joined.iloc[:, 1])
    except BadRequest:
        pass

    prof = profile(symbol)
    rat = ratios(symbol)
    q = quote(symbol)
    return clean({
        "symbol": symbol,
        "quote": q if "error" not in q else None,
        "profile": prof if "error" not in prof else None,
        "ratios": rat if "error" not in rat else None,
        "stats": {**stats, "beta": beta, "benchmark_corr": corr, "rsi": rsi_s.iloc[-1],
                  "above_ma20": bool(close.iloc[-1] > ma20.iloc[-1]) if not math.isnan(ma20.iloc[-1]) else None,
                  "above_ma60": bool(close.iloc[-1] > ma60.iloc[-1]) if not math.isnan(ma60.iloc[-1]) else None},
        "benchmark": bench_sym,
        "chart": {
            "dates": [d.strftime("%Y-%m-%d") for d in close.index],
            "close": close.round(4).tolist(),
            "ma20": ma20.round(4).tolist(),
            "ma60": ma60.round(4).tolist(),
            "drawdown": (close / close.cummax() - 1).round(5).tolist(),
            "rsi": rsi_s.round(2).tolist(),
        },
    })


def portfolio_analysis(symbols: list[str], period: str, rf: float, weights_in: list[float] | None) -> dict:
    if not 2 <= len(symbols) <= 10:
        raise BadRequest("종목은 2개 이상 10개 이하로 입력하세요.")
    prices = pd.concat([history(s, period) for s in symbols], axis=1, join="inner").dropna()
    if len(prices) < 60:
        raise BadRequest("공통 거래일이 너무 적습니다. 기간을 늘리거나 종목을 바꿔 보세요.")
    rets = prices.pct_change().dropna()
    mu = rets.mean().values * TRADING_DAYS
    cov = rets.cov().values * TRADING_DAYS
    n = len(symbols)

    rng = np.random.default_rng(42)
    w = rng.dirichlet(np.ones(n), size=6000)
    w = np.vstack([w, np.eye(n), np.full((1, n), 1 / n)])
    port_ret = w @ mu
    port_vol = np.sqrt(np.einsum("ij,jk,ik->i", w, cov, w))
    sharpe = (port_ret - rf) / port_vol

    def pack(weights: np.ndarray) -> dict:
        pr = float(weights @ mu)
        pv = float(math.sqrt(weights @ cov @ weights))
        curve = (1 + rets.values @ weights).cumprod()
        dd = curve / np.maximum.accumulate(curve) - 1
        return {"weights": weights.round(4).tolist(), "ret": pr, "vol": pv, "sharpe": (pr - rf) / pv if pv else None,
                "max_drawdown": float(dd.min()), "curve": np.round(curve, 5).tolist()}

    portfolios = {
        "equal": pack(np.full(n, 1 / n)),
        "max_sharpe": pack(w[int(np.argmax(sharpe))]),
        "min_vol": pack(w[int(np.argmin(port_vol))]),
    }
    if weights_in:
        arr = np.array(weights_in, dtype=float)
        if len(arr) != n or arr.min() < 0 or arr.sum() <= 0:
            raise BadRequest("비중은 종목 수와 같은 개수의 0 이상 숫자여야 합니다.")
        portfolios["custom"] = pack(arr / arr.sum())

    sample = rng.choice(len(w), size=min(1500, len(w)), replace=False)
    corr = rets.corr().round(3).values.tolist()
    assets = [{"symbol": s, **series_stats(prices[s], rf)} for s in symbols]
    return clean({
        "symbols": symbols,
        "dates": [d.strftime("%Y-%m-%d") for d in rets.index],
        "assets": assets,
        "correlation": corr,
        "cloud": {"vol": port_vol[sample].round(4).tolist(), "ret": port_ret[sample].round(4).tolist(),
                  "sharpe": sharpe[sample].round(3).tolist()},
        "portfolios": portfolios,
    })


def dcf(p: dict) -> dict:
    def num(key, lo=-1e15, hi=1e15, default=None):
        v = p.get(key, default)
        try:
            v = float(v)
        except (TypeError, ValueError):
            raise BadRequest(f"'{key}' 값이 숫자가 아닙니다.")
        if not lo <= v <= hi or math.isnan(v):
            raise BadRequest(f"'{key}' 값이 허용 범위를 벗어났습니다.")
        return v

    fcf = num("fcf")
    g = num("growth", -0.5, 1.0)
    years = int(num("years", 1, 15, 5))
    tg = num("terminal_growth", -0.05, 0.1)
    wacc = num("wacc", 0.01, 0.5)
    if wacc <= tg:
        raise BadRequest("할인율(WACC)은 영구 성장률보다 커야 합니다.")
    net_debt = num("net_debt", default=0)
    shares = num("shares", 1, default=1)

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

    waccs = [wacc + d for d in (-0.02, -0.01, 0, 0.01, 0.02)]
    tgs = [tg + d for d in (-0.01, -0.005, 0, 0.005, 0.01)]
    grid = []
    for w_ in waccs:
        row = []
        for t_ in tgs:
            if w_ <= t_ or w_ <= 0:
                row.append(None)
                continue
            f2, s2 = fcf, 0.0
            for t in range(1, years + 1):
                f2 *= 1 + g
                s2 += f2 / (1 + w_) ** t
            s2 += f2 * (1 + t_) / (w_ - t_) / (1 + w_) ** years
            row.append((s2 - net_debt) / shares)
        grid.append(row)
    return clean({"flows": flows, "pv_flows": pv_sum, "terminal_value": tv, "pv_terminal": pv_tv,
                  "enterprise_value": ev, "equity_value": equity, "per_share": per_share,
                  "tv_share": pv_tv / ev if ev else None,
                  "sensitivity": {"wacc": waccs, "tg": tgs, "values": grid}})


def dcf_prefill(symbol: str) -> dict:
    info = ticker_info(symbol)
    if not info or ("symbol" not in info and "shortName" not in info):
        raise BadRequest(f"{symbol}: 기업 정보를 찾지 못했습니다.")
    beta = info.get("beta") or 1.0
    wacc = min(max(0.04 + beta * 0.055, 0.06), 0.15)  # 단순 CAPM 근사: 무위험 4% + 베타 × 시장위험프리미엄 5.5%
    growth = info.get("earningsGrowth") or info.get("revenueGrowth") or 0.05
    return clean({
        "symbol": symbol,
        "name": info.get("longName") or info.get("shortName"),
        "currency": info.get("financialCurrency") or info.get("currency"),
        "price_currency": info.get("currency"),
        "price": info.get("currentPrice") or info.get("regularMarketPrice"),
        "fcf": info.get("freeCashflow"),
        "net_debt": (info.get("totalDebt") or 0) - (info.get("totalCash") or 0),
        "shares": info.get("sharesOutstanding"),
        "growth": round(min(max(float(growth), -0.05), 0.15), 4),
        "wacc": round(wacc, 4),
        "terminal_growth": 0.025,
        "beta": beta,
    })


def _ncdf(x: float) -> float:
    return 0.5 * (1 + math.erf(x / math.sqrt(2)))


def _npdf(x: float) -> float:
    return math.exp(-x * x / 2) / math.sqrt(2 * math.pi)


def bsm(S, K, T, r, sigma, q, kind):
    if T <= 0 or sigma <= 0:
        intrinsic = max(S - K, 0) if kind == "call" else max(K - S, 0)
        return {"price": intrinsic, "delta": None, "gamma": None, "vega": None, "theta": None, "rho": None}
    d1 = (math.log(S / K) + (r - q + sigma**2 / 2) * T) / (sigma * math.sqrt(T))
    d2 = d1 - sigma * math.sqrt(T)
    disc_q, disc_r = math.exp(-q * T), math.exp(-r * T)
    if kind == "call":
        price = S * disc_q * _ncdf(d1) - K * disc_r * _ncdf(d2)
        delta = disc_q * _ncdf(d1)
        theta = -S * disc_q * _npdf(d1) * sigma / (2 * math.sqrt(T)) - r * K * disc_r * _ncdf(d2) + q * S * disc_q * _ncdf(d1)
        rho = K * T * disc_r * _ncdf(d2)
    else:
        price = K * disc_r * _ncdf(-d2) - S * disc_q * _ncdf(-d1)
        delta = -disc_q * _ncdf(-d1)
        theta = -S * disc_q * _npdf(d1) * sigma / (2 * math.sqrt(T)) + r * K * disc_r * _ncdf(-d2) - q * S * disc_q * _ncdf(-d1)
        rho = -K * T * disc_r * _ncdf(-d2)
    return {"price": price, "delta": delta, "gamma": disc_q * _npdf(d1) / (S * sigma * math.sqrt(T)),
            "vega": S * disc_q * _npdf(d1) * math.sqrt(T) / 100, "theta": theta / 365, "rho": rho / 100,
            "d1": d1, "d2": d2, "prob_itm": _ncdf(d2) if kind == "call" else _ncdf(-d2)}


def option_calc(p: dict) -> dict:
    try:
        S, K = float(p["S"]), float(p["K"])
        T = float(p["days"]) / 365
        r, sigma, q = float(p.get("r", 0.035)), float(p["sigma"]), float(p.get("q", 0))
    except (KeyError, TypeError, ValueError):
        raise BadRequest("모든 입력값을 숫자로 채워 주세요.")
    kind = p.get("kind", "call")
    if kind not in ("call", "put") or S <= 0 or K <= 0 or not 0 < sigma < 5 or T < 0 or T > 30:
        raise BadRequest("입력값 범위를 확인하세요 (가격>0, 변동성 0~500%, 만기 0~30년).")
    side = 1 if p.get("side", "long") == "long" else -1
    res = bsm(S, K, T, r, sigma, q, kind)
    prem = res["price"]
    xs = np.linspace(S * 0.6, S * 1.4, 81)
    payoff = [side * ((max(x - K, 0) if kind == "call" else max(K - x, 0)) - prem) for x in xs]
    today = [side * (bsm(x, K, T, r, sigma, q, kind)["price"] - prem) for x in xs]
    breakeven = K + prem if kind == "call" else K - prem
    return clean({**res, "breakeven": breakeven, "curve": {"x": xs.round(4).tolist(), "expiry": payoff, "today": today}})


@cached(6 * 3600)
def macro(countries: str, indicator: str, years: int) -> dict:
    now = time.localtime().tm_year
    res = _quiet(wb.get_indicators, countries, indicator, f"{now - years}:{now}", 2000)
    if res.get("error"):
        raise BadRequest(f"세계은행 API 오류: {res['error']}")
    series: dict[str, dict] = {}
    for row in res.get("data", []):
        if row.get("value") is None:
            continue
        s = series.setdefault(row["country_id"] or row["country_name"], {"name": row["country_name"], "points": {}})
        s["points"][row["date"]] = row["value"]
    out = []
    for cid, s in series.items():
        pts = sorted(s["points"].items())
        out.append({"id": cid, "name": s["name"], "dates": [d for d, _ in pts], "values": [v for _, v in pts]})
    name = (res.get("data") or [{}])[0].get("indicator_name") if res.get("data") else indicator
    return clean({"indicator": indicator, "indicator_name": name, "series": out})


# --------------------------------------------------------------------------- #
# HTTP
# --------------------------------------------------------------------------- #
class Handler(BaseHTTPRequestHandler):
    server_version = "FinceptEasy/1.0"
    allowed_hosts: set[str] = set()

    def log_message(self, fmt, *args):
        if os.environ.get("EASY_VERBOSE"):
            super().log_message(fmt, *args)

    def _send(self, status, body: bytes, ctype: str):
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.end_headers()
        self.wfile.write(body)

    def _json(self, data, status=200):
        self._send(status, json.dumps(data, ensure_ascii=False, allow_nan=False).encode(), "application/json; charset=utf-8")

    def _guard(self) -> bool:
        if self.headers.get("Host", "") not in self.allowed_hosts:
            self._json({"error": "invalid host"}, 403)
            return False
        return True

    def _route(self, method: str):
        url = urlparse(self.path)
        q = {k: v[0] for k, v in parse_qs(url.query).items()}
        path = url.path
        if method == "GET":
            if path in ("/", "/index.html"):
                return self._send(200, (STATIC_DIR / "index.html").read_bytes(), "text/html; charset=utf-8")
            if path == "/api/features":
                return self._send(200, (EASY_DIR / "features.json").read_bytes(), "application/json; charset=utf-8")
            if path == "/api/search":
                term = q.get("q", "").strip()[:40]
                return self._json({"results": clean(search(term)) if term else []})
            if path == "/api/stock":
                period = q.get("period", "1y")
                if period not in PERIODS:
                    raise BadRequest("기간 값이 올바르지 않습니다.")
                return self._json(stock_analysis(check_symbol(q.get("symbol", "")), period, float(q.get("rf", 0.03))))
            if path == "/api/news":
                return self._json(clean(news(check_symbol(q.get("symbol", "")))))
            if path == "/api/dcf/prefill":
                return self._json(dcf_prefill(check_symbol(q.get("symbol", ""))))
            if path == "/api/macro":
                countries = [c.strip().upper() for c in q.get("countries", "KOR;USA").replace(",", ";").split(";") if c.strip()]
                if not countries or len(countries) > 8 or not all(COUNTRY_RE.match(c) for c in countries):
                    raise BadRequest("국가 코드는 KOR, USA 처럼 2~3글자로 최대 8개까지 입력하세요.")
                ind = q.get("indicator", "NY.GDP.MKTP.KD.ZG")
                if not INDICATOR_RE.match(ind):
                    raise BadRequest("지표 코드가 올바르지 않습니다.")
                years = min(max(int(q.get("years", 20)), 5), 60)
                return self._json(macro(";".join(countries), ind, years))
            return self._json({"error": "not found"}, 404)

        length = int(self.headers.get("Content-Length") or 0)
        if not self.headers.get("Content-Type", "").startswith("application/json") or length > 100_000:
            raise BadRequest("JSON 요청만 허용됩니다.")
        origin = self.headers.get("Origin")
        if origin and urlparse(origin).netloc not in self.allowed_hosts:
            return self._json({"error": "untrusted origin"}, 403)
        body = json.loads(self.rfile.read(length) or b"{}")
        if path == "/api/portfolio":
            symbols = [check_symbol(s) for s in body.get("symbols", [])]
            if len(set(symbols)) != len(symbols):
                raise BadRequest("같은 종목이 중복되었습니다.")
            period = body.get("period", "2y")
            if period not in PERIODS:
                raise BadRequest("기간 값이 올바르지 않습니다.")
            return self._json(portfolio_analysis(symbols, period, float(body.get("rf", 0.03)), body.get("weights")))
        if path == "/api/dcf":
            return self._json(dcf(body))
        if path == "/api/option":
            return self._json(option_calc(body))
        return self._json({"error": "not found"}, 404)

    def _handle(self, method):
        if not self._guard():
            return
        try:
            self._route(method)
        except BadRequest as e:
            self._json({"error": str(e)}, 400)
        except (ValueError, json.JSONDecodeError) as e:
            self._json({"error": f"입력값 오류: {e}"}, 400)
        except Exception as e:  # surfaced to the UI
            self._json({"error": f"{type(e).__name__}: {e}"}, 500)

    def do_GET(self):
        self._handle("GET")

    def do_POST(self):
        self._handle("POST")


def main():
    ap = argparse.ArgumentParser(description="Fincept Terminal Easy")
    ap.add_argument("--host", default=os.environ.get("EASY_HOST", "127.0.0.1"))
    ap.add_argument("--port", type=int, default=int(os.environ.get("EASY_PORT", "8770")))
    a = ap.parse_args()
    Handler.allowed_hosts = {f"{a.host}:{a.port}", f"localhost:{a.port}", f"127.0.0.1:{a.port}", f"[::1]:{a.port}"}
    Handler.allowed_hosts |= {h.strip() for h in os.environ.get("EASY_ALLOWED_HOSTS", "").split(",") if h.strip()}
    srv = ThreadingHTTPServer((a.host, a.port), Handler)
    print(f"Fincept Terminal Easy → http://127.0.0.1:{a.port}", flush=True)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()

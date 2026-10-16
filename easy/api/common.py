"""Shared helpers for every API module.

Each module in easy/api/ exposes a ``ROUTES`` dict mapping ``(METHOD, path)`` to a
handler ``fn(q: dict, body: dict) -> JSON-serialisable``. ``q`` holds query-string
values (first value only), ``body`` the parsed JSON body for POST requests.
Raise ``BadRequest("한국어 메시지")`` for user-facing input/data errors.
"""

from __future__ import annotations

import contextlib
import io
import math
import re
import sys
import threading
import time
from pathlib import Path

import numpy as np
import pandas as pd

EASY_DIR = Path(__file__).resolve().parent.parent
SCRIPTS_DIR = EASY_DIR.parent / "fincept-qt" / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import yfinance_data as yfd  # noqa: E402  (Fincept script)

TRADING_DAYS = 252
SYMBOL_RE = re.compile(r"^[A-Za-z0-9.\-^=]{1,20}$")
PERIODS = {"5d", "1mo", "3mo", "6mo", "ytd", "1y", "2y", "5y", "10y", "max"}
INTERVALS = {"1m", "5m", "15m", "30m", "60m", "1h", "1d", "1wk", "1mo"}


class BadRequest(Exception):
    """User-facing error (shown in the UI as-is)."""


# --------------------------------------------------------------------------- #
# Caching / output hygiene
# --------------------------------------------------------------------------- #
_cache: dict[tuple, tuple[float, object]] = {}
_cache_lock = threading.Lock()


def cached(ttl: float):
    """Memoise a function's result for ``ttl`` seconds (args must be hashable)."""

    def deco(fn):
        def wrapper(*args):
            key = (fn.__module__, fn.__name__, *args)
            now = time.time()
            with _cache_lock:
                hit = _cache.get(key)
                if hit and now - hit[0] < ttl:
                    return hit[1]
            value = fn(*args)
            with _cache_lock:
                _cache[key] = (now, value)
            return value

        wrapper.__name__ = fn.__name__
        return wrapper

    return deco


class _ThreadQuietStdout(io.TextIOBase):
    """sys.stdout proxy that drops writes only from threads inside quiet().

    contextlib.redirect_stdout swaps the process-wide sys.stdout, which races on a
    threaded server (overlapping requests can leave stdout pointing at a buffer).
    """

    def __init__(self, real):
        self._real = real
        self._local = threading.local()

    @property
    def muted(self) -> int:
        return getattr(self._local, "depth", 0)

    def mute(self, delta: int) -> None:
        self._local.depth = self.muted + delta

    def write(self, s):
        return len(s) if self.muted else self._real.write(s)

    def flush(self):
        if not self.muted:
            self._real.flush()

    def __getattr__(self, name):
        return getattr(self._real, name)


if not isinstance(sys.stdout, _ThreadQuietStdout):
    sys.stdout = _ThreadQuietStdout(sys.stdout)
_STDOUT: _ThreadQuietStdout = sys.stdout


@contextlib.contextmanager
def muted():
    _STDOUT.mute(1)
    try:
        yield
    finally:
        _STDOUT.mute(-1)


def quiet(fn, *args, **kwargs):
    """Call a Fincept script function while swallowing anything it prints (thread-safe)."""
    with muted():
        return fn(*args, **kwargs)


def clean(obj):
    """Make values JSON-safe: NaN/inf → None, numpy/pandas scalars → python."""
    if isinstance(obj, dict):
        return {str(k): clean(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [clean(v) for v in obj]
    if isinstance(obj, (np.floating, float)):
        f = float(obj)
        return None if math.isnan(f) or math.isinf(f) else f
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.bool_,)):
        return bool(obj)
    if isinstance(obj, (pd.Timestamp,)):
        return obj.isoformat()
    if obj is pd.NaT:
        return None
    return obj


# --------------------------------------------------------------------------- #
# Input validation
# --------------------------------------------------------------------------- #
def check_symbol(symbol) -> str:
    symbol = str(symbol or "").strip().upper()
    if not SYMBOL_RE.match(symbol):
        raise BadRequest("종목 코드 형식이 올바르지 않습니다. 예: AAPL, 005930.KS, BTC-USD")
    return symbol


def check_symbols(raw, lo: int = 1, hi: int = 30) -> list[str]:
    items = raw if isinstance(raw, list) else str(raw or "").replace(";", ",").split(",")
    out = []
    for s in items:
        s = str(s).strip()
        if s:
            s = check_symbol(s)
            if s not in out:
                out.append(s)
    if not lo <= len(out) <= hi:
        raise BadRequest(f"종목은 {lo}~{hi}개 입력하세요.")
    return out


def check_period(p, default: str = "1y") -> str:
    p = p or default
    if p not in PERIODS:
        raise BadRequest("기간 값이 올바르지 않습니다.")
    return p


def num(value, name: str, lo: float = -1e18, hi: float = 1e18, default=None) -> float:
    if value is None or value == "":
        if default is None:
            raise BadRequest(f"'{name}' 값이 필요합니다.")
        return float(default)
    try:
        v = float(value)
    except (TypeError, ValueError):
        raise BadRequest(f"'{name}' 값이 숫자가 아닙니다.")
    if math.isnan(v) or not lo <= v <= hi:
        raise BadRequest(f"'{name}' 값이 허용 범위({lo:g}~{hi:g})를 벗어났습니다.")
    return v


# --------------------------------------------------------------------------- #
# Market data (Fincept yfinance_data.py + yfinance)
# --------------------------------------------------------------------------- #
def yf_ticker(symbol: str):
    import yfinance as yf

    return yf.Ticker(symbol)


@cached(300)
def ohlcv(symbol: str, period: str = "1y", interval: str = "1d") -> pd.DataFrame:
    """OHLCV DataFrame (index: tz-naive Timestamp) via Fincept's get_historical_period."""
    rows = quiet(yfd.get_historical_period, symbol, period, interval)
    if isinstance(rows, dict) or not rows:
        msg = rows.get("error") if isinstance(rows, dict) else "데이터 없음"
        raise BadRequest(f"{symbol}: 가격 데이터를 가져오지 못했습니다 ({msg}).")
    df = pd.DataFrame(rows)
    df.index = pd.to_datetime(df.pop("timestamp"), unit="s")
    if interval in ("1d", "1wk", "1mo"):
        # Bars are stamped at exchange-local midnight; in UTC that is the previous day
        # for Asia (KST 00:00 = 15:00 UTC). +12h before normalising fixes every region.
        df.index = (df.index + pd.Timedelta(hours=12)).normalize()
    df = df[~df.index.duplicated(keep="last")].astype(float)
    return df.dropna(subset=["close"])


def history(symbol: str, period: str = "1y") -> pd.Series:
    """Daily close series."""
    s = ohlcv(symbol, period, "1d")["close"].copy()
    s.name = symbol
    return s


def closes(symbols: list[str], period: str = "1y") -> pd.DataFrame:
    """Aligned daily closes (inner join on dates)."""
    df = pd.concat([history(s, period) for s in symbols], axis=1, join="inner").dropna()
    if len(df) < 20:
        raise BadRequest("공통 거래일이 너무 적습니다. 기간을 늘리거나 종목을 바꿔 보세요.")
    return df


@cached(60)
def quote(symbol: str) -> dict:
    return quiet(yfd.get_quote, symbol)


@cached(60)
def batch_quotes(symbols: tuple[str, ...]) -> list[dict]:
    """Quotes for many symbols at once (Fincept get_batch_quotes)."""
    res = quiet(yfd.get_batch_quotes, list(symbols))
    if isinstance(res, dict):
        res = res.get("quotes") or res.get("data") or list(res.values())
    out = [r for r in (res or []) if isinstance(r, dict) and r.get("price") is not None]
    # Yahoo sometimes returns an all-NaN row for "today" and the Fincept batch call
    # then drops the symbol; rebuild those from the last two valid daily bars.
    have = {r.get("symbol") for r in out}
    for s in symbols:
        if s in have:
            continue
        try:
            df = ohlcv(s, "1mo", "1d").dropna(subset=["close"])
        except BadRequest:
            continue
        if df.empty:
            continue
        last, prev = df.iloc[-1], (df.iloc[-2] if len(df) > 1 else df.iloc[-1])
        chg = float(last["close"] - prev["close"])
        out.append({
            "symbol": s, "price": float(last["close"]), "change": chg,
            "change_percent": round(chg / prev["close"] * 100, 2) if prev["close"] else 0.0,
            "volume": int(last["volume"] or 0), "high": float(last["high"]), "low": float(last["low"]),
            "open": float(last["open"]), "previous_close": float(prev["close"]),
            "timestamp": int(df.index[-1].timestamp()), "exchange": "", "stale": True,
        })
    return out


@cached(3600)
def info(symbol: str) -> dict:
    with muted():
        return dict(yf_ticker(symbol).info or {})


@cached(3600)
def profile(symbol: str) -> dict:
    return quiet(yfd.get_company_profile, symbol)


@cached(3600)
def ratios(symbol: str) -> dict:
    res = quiet(yfd.get_financial_ratios, symbol)
    # The Fincept script fills missing values with 0; treat them as "no data".
    return {k: (None if v == 0 else v) for k, v in res.items()}


# --------------------------------------------------------------------------- #
# Analytics helpers
# --------------------------------------------------------------------------- #
def rsi(close: pd.Series, n: int = 14) -> pd.Series:
    delta = close.diff()
    gain = delta.clip(lower=0).ewm(alpha=1 / n, adjust=False).mean()
    loss = (-delta.clip(upper=0)).ewm(alpha=1 / n, adjust=False).mean()
    return 100 - 100 / (1 + gain / loss.replace(0, np.nan))


def series_stats(close: pd.Series, rf: float = 0.03) -> dict:
    """Return/risk summary of a price (or equity) series."""
    r = close.pct_change().dropna()
    years = max(len(r) / TRADING_DAYS, 1e-9)
    total = close.iloc[-1] / close.iloc[0] - 1
    cagr = (1 + total) ** (1 / years) - 1 if total > -1 else -1.0
    vol = r.std() * math.sqrt(TRADING_DAYS)
    downside = r[r < 0].std() * math.sqrt(TRADING_DAYS)
    dd = close / close.cummax() - 1
    mdd = dd.min()
    return {
        "total_return": total,
        "cagr": cagr,
        "volatility": vol,
        "sharpe": (r.mean() * TRADING_DAYS - rf) / vol if vol else None,
        "sortino": (r.mean() * TRADING_DAYS - rf) / downside if downside else None,
        "calmar": cagr / abs(mdd) if mdd else None,
        "max_drawdown": mdd,
        "best_day": r.max(),
        "worst_day": r.min(),
        "positive_days": float((r > 0).mean()),
        "var95": float(np.percentile(r, 5)) if len(r) else None,
    }


def dates(index) -> list[str]:
    return [d.strftime("%Y-%m-%d") for d in index]


def benchmark_for(symbol: str) -> str:
    if symbol.endswith((".KS", ".KQ")):
        return "^KS11"
    if symbol.endswith("-USD"):
        return "BTC-USD" if symbol != "BTC-USD" else "^GSPC"
    return "^GSPC"

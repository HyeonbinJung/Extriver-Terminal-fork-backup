"""크립토 — CoinGecko (Fincept coingecko.py) + alternative.me Fear & Greed (alternative_me_data.py).

CoinGecko's keyless tier is rate limited (~10-30 calls/min), so every call is cached and the
last good answer is kept as a stale fallback. When CoinGecko refuses (429) the coin table and
charts fall back to Yahoo Finance (BTC-USD …) via the shared helpers.
"""

from __future__ import annotations

import re
import threading
import time

from api.common import BadRequest, batch_quotes, cached, clean, ohlcv, quiet, quote

import alternative_me_data as alt  # Fincept script
import coingecko as cg  # Fincept script

_lock = threading.Lock()
_good: dict[tuple, tuple[float, object]] = {}


def _cg(key: tuple, ttl: float, fn, *args, **kw):
    """Cached CoinGecko call with stale fallback. Returns (data, stale_flag)."""
    now = time.time()
    with _lock:
        hit = _good.get(key)
    if hit and now - hit[0] < ttl:
        return hit[1], False
    res = quiet(fn, *args, **kw)
    if res is None or (isinstance(res, dict) and "error" in res and len(res) <= 2):
        if hit:
            return hit[1], True
        msg = str(res.get("error")) if isinstance(res, dict) else "응답 없음"
        msg = "무료 호출 한도 초과(429) — 1분쯤 뒤 자동 복구" if "429" in msg else msg[:120]
        raise BadRequest("CoinGecko 응답 실패: " + msg)
    with _lock:
        _good[key] = (now, res)
    return res, False


ID_RE = re.compile(r"^[a-z0-9\-]{1,80}$")
FNG_KO = {"Extreme Fear": "극단적 공포", "Fear": "공포", "Neutral": "중립", "Greed": "탐욕", "Extreme Greed": "극단적 탐욕"}
YF_FALLBACK = ["BTC", "ETH", "USDT", "XRP", "BNB", "SOL", "USDC", "DOGE", "TRX", "ADA", "LINK", "AVAX", "XLM", "SUI",
               "BCH", "HBAR", "LTC", "DOT", "SHIB", "TON", "UNI", "XMR", "PEPE", "AAVE", "NEAR", "ETC", "ICP"]
DAYS = {"1": "1", "7": "7", "30": "30", "90": "90", "365": "365"}


@cached(300)
def _krw_rate() -> float | None:
    try:
        q = quote("KRW=X")
        p = q.get("price") if isinstance(q, dict) else None
        return float(p) if p else None
    except Exception:
        return None


def _fng() -> dict | None:
    try:
        res, _ = _cg(("fng",), 600, alt.get_crypto_fear_greed, 30)
    except BadRequest:
        return None
    if not isinstance(res, dict) or "history" not in res:
        return None
    hist = []
    for it in res["history"]:
        try:
            v = int(it.get("value"))
            label = it.get("value_classification") or ""
            hist.append({"t": int(it.get("timestamp")), "v": v, "label": label, "ko": FNG_KO.get(label, label)})
        except (TypeError, ValueError):
            continue
    hist.sort(key=lambda x: x["t"])
    return {"now": hist[-1] if hist else None, "avg30": res.get("30_day_average"), "history": hist,
            "next_update": (res.get("current") or {}).get("time_until_update")}


def overview(q, body):
    """GET /api/crypto/overview — global stats, fear & greed (30d), trending, categories."""
    out: dict = {"errors": []}
    try:
        g, stale = _cg(("global",), 120, cg.get_global_data)
        d = g.get("data", {})
        out["global"] = {
            "mcap": d.get("total_market_cap", {}).get("usd"),
            # CoinGecko occasionally reports absurd global volume (1e21); hide it rather than mislead
            "volume": (lambda v: v if v and v < 5e12 else None)(d.get("total_volume", {}).get("usd")),
            "mcap_change_24h": d.get("market_cap_change_percentage_24h_usd"),
            "btc_dom": d.get("market_cap_percentage", {}).get("btc"), "eth_dom": d.get("market_cap_percentage", {}).get("eth"),
            "dominance": sorted(d.get("market_cap_percentage", {}).items(), key=lambda kv: -kv[1])[:8],
            "coins": d.get("active_cryptocurrencies"), "markets": d.get("markets"), "stale": stale,
        }
    except BadRequest as e:
        out["errors"].append(str(e))
    out["fng"] = _fng()
    try:
        t, _ = _cg(("trending",), 600, cg.get_trending_coins)
        out["trending"] = [{
            "id": c["item"].get("id"), "name": c["item"].get("name"), "symbol": (c["item"].get("symbol") or "").upper(),
            "rank": c["item"].get("market_cap_rank"), "thumb": c["item"].get("thumb"),
            "price": (c["item"].get("data") or {}).get("price"),
            "chg24": ((c["item"].get("data") or {}).get("price_change_percentage_24h") or {}).get("usd"),
        } for c in (t.get("coins") or [])[:15]]
    except (BadRequest, AttributeError, KeyError) as e:
        out["trending"] = []
        out["errors"].append(f"trending: {e}")
    try:
        cats, _ = _cg(("categories",), 900, cg.get_categories_with_market_data)
        cats = [c for c in cats if isinstance(c, dict) and (c.get("market_cap") or 0) > 1e9]
        cats.sort(key=lambda c: -(c.get("market_cap") or 0))
        out["categories"] = [{"id": c.get("id"), "name": c.get("name"), "mcap": c.get("market_cap"),
                              "chg24": c.get("market_cap_change_24h"), "volume": c.get("volume_24h"),
                              "top": c.get("top_3_coins") or []} for c in cats[:40]]
    except (BadRequest, TypeError) as e:
        out["categories"] = []
        out["errors"].append(f"categories: {e}")
    out["krw"] = _krw_rate()
    return clean(out)


def _yf_markets() -> list[dict]:
    syms = tuple(f"{s}-USD" for s in YF_FALLBACK)
    rows = []
    for i, r in enumerate(batch_quotes(syms)):
        if r.get("price") is None:
            continue
        sym = r["symbol"].replace("-USD", "")
        rows.append({"id": sym.lower(), "symbol": sym, "name": sym, "image": None, "rank": i + 1,
                     "price": r.get("price"), "chg1h": None, "chg24": r.get("change_percent"), "chg7d": None,
                     "mcap": None, "volume": r.get("volume"), "spark": [], "yf": r["symbol"]})
    return rows


def markets(q, body):
    """GET /api/crypto/markets — top 100 coins (USD) with 7d sparkline; falls back to Yahoo when rate limited."""
    src, stale = "coingecko", False
    try:
        res, stale = _cg(("markets",), 90, cg.get_coin_markets, "usd", order="market_cap_desc", per_page=100, page=1,
                         sparkline="true", price_change_percentage="1h,24h,7d")
        rows = []
        for c in res:
            sp = (c.get("sparkline_in_7d") or {}).get("price") or []
            step = max(1, len(sp) // 42)
            rows.append({
                "id": c.get("id"), "symbol": (c.get("symbol") or "").upper(), "name": c.get("name"), "image": c.get("image"),
                "rank": c.get("market_cap_rank"), "price": c.get("current_price"),
                "chg1h": c.get("price_change_percentage_1h_in_currency"),
                "chg24": c.get("price_change_percentage_24h_in_currency", c.get("price_change_percentage_24h")),
                "chg7d": c.get("price_change_percentage_7d_in_currency"),
                "mcap": c.get("market_cap"), "volume": c.get("total_volume"), "high24": c.get("high_24h"), "low24": c.get("low_24h"),
                "ath": c.get("ath"), "ath_chg": c.get("ath_change_percentage"), "supply": c.get("circulating_supply"),
                "spark": [round(x, 8) for x in sp[::step]],
            })
    except BadRequest:
        rows, src = _yf_markets(), "yahoo"
    return clean({"coins": rows, "source": src, "stale": stale, "krw": _krw_rate(), "ts": int(time.time())})


def _yf_chart(symbol: str, days: str) -> list[dict]:
    period, interval = {"1": ("5d", "30m"), "7": ("5d", "1h"), "30": ("1mo", "1d"), "90": ("3mo", "1d"), "365": ("1y", "1d")}[days]
    df = ohlcv(symbol, period, interval)
    if days == "1":
        df = df[df.index >= df.index[-1] - __import__("pandas").Timedelta(days=1)]
    return [{"t": int(ts.timestamp()), "p": float(c), "v": float(v)} for ts, c, v in zip(df.index, df["close"], df["volume"])]


def coin(q, body):
    """GET /api/crypto/coin?id=bitcoin&days=30[&symbol=BTC] — detail + price chart."""
    cid = (q.get("id") or "").strip().lower()
    if not ID_RE.match(cid):
        raise BadRequest("코인 ID 형식이 올바르지 않습니다. 예: bitcoin, ethereum")
    days = DAYS.get(str(q.get("days") or "30"))
    if not days:
        raise BadRequest("기간은 1, 7, 30, 90, 365일 중 하나입니다.")
    out: dict = {"id": cid, "days": int(days), "errors": []}
    sym = re.sub(r"[^A-Z0-9]", "", (q.get("symbol") or "").upper())[:10]
    try:
        d, _ = _cg(("coin", cid), 900, cg.get_coin_details, cid)
        md = d.get("market_data") or {}
        desc = (d.get("description") or {})
        out["info"] = {
            "name": d.get("name"), "symbol": (d.get("symbol") or "").upper(), "rank": d.get("market_cap_rank"),
            "image": (d.get("image") or {}).get("large"), "categories": (d.get("categories") or [])[:6],
            "genesis": d.get("genesis_date"), "hashing": d.get("hashing_algorithm"),
            "homepage": next((u for u in (d.get("links") or {}).get("homepage") or [] if u), None),
            "desc_ko": re.sub(r"<[^>]+>", "", desc.get("ko") or "")[:1500],
            "desc": re.sub(r"<[^>]+>", "", desc.get("en") or "")[:1500],
            "price": (md.get("current_price") or {}).get("usd"), "price_krw": (md.get("current_price") or {}).get("krw"),
            "mcap": (md.get("market_cap") or {}).get("usd"), "fdv": (md.get("fully_diluted_valuation") or {}).get("usd"),
            "volume": (md.get("total_volume") or {}).get("usd"),
            "high24": (md.get("high_24h") or {}).get("usd"), "low24": (md.get("low_24h") or {}).get("usd"),
            "ath": (md.get("ath") or {}).get("usd"), "ath_chg": (md.get("ath_change_percentage") or {}).get("usd"),
            "ath_date": (md.get("ath_date") or {}).get("usd"), "atl": (md.get("atl") or {}).get("usd"),
            "chg24": md.get("price_change_percentage_24h"), "chg7d": md.get("price_change_percentage_7d"),
            "chg30d": md.get("price_change_percentage_30d"), "chg1y": md.get("price_change_percentage_1y"),
            "supply": md.get("circulating_supply"), "total_supply": md.get("total_supply"), "max_supply": md.get("max_supply"),
            "sentiment_up": d.get("sentiment_votes_up_percentage"),
        }
        sym = sym or out["info"]["symbol"]
    except (BadRequest, AttributeError) as e:
        out["errors"].append(str(e))
    try:
        ch, stale = _cg(("chart", cid, days), 300 if days != "1" else 120, cg.get_market_chart, cid, "usd", days)
        prices, vols = ch.get("prices") or [], dict((int(t), v) for t, v in ch.get("total_volumes") or [])
        out["chart"] = [{"t": int(t / 1000), "p": p, "v": vols.get(int(t))} for t, p in prices]
        out["chart_src"] = "coingecko" + (" (지연)" if stale else "")
    except (BadRequest, AttributeError) as e:
        out["errors"].append(str(e))
        if sym:
            try:
                out["chart"] = _yf_chart(f"{sym}-USD", days)
                out["chart_src"] = "yahoo"
            except Exception as e2:  # noqa: BLE001
                out["errors"].append(f"yahoo: {e2}")
    if not out.get("info") and not out.get("chart"):
        raise BadRequest("코인 데이터를 가져오지 못했습니다. 잠시 후 다시 시도하세요 (CoinGecko 무료 한도).")
    out["krw"] = _krw_rate()
    return clean(out)


def search(q, body):
    """GET /api/crypto/search?q=pepe — CoinGecko search (coins only)."""
    term = (q.get("q") or "").strip()[:40]
    if len(term) < 2:
        raise BadRequest("검색어를 2글자 이상 입력하세요.")
    res, _ = _cg(("search", term.lower()), 3600, cg.get_search, term)
    return clean({"coins": [{"id": c.get("id"), "name": c.get("name"), "symbol": c.get("symbol"), "rank": c.get("market_cap_rank"),
                             "thumb": c.get("thumb")} for c in (res.get("coins") or [])[:15]]})


def fng(q, body):
    """GET /api/crypto/fng — fear & greed only."""
    f = _fng()
    if not f:
        raise BadRequest("공포·탐욕 지수를 가져오지 못했습니다.")
    return f


ROUTES = {
    ("GET", "/api/crypto/overview"): overview,
    ("GET", "/api/crypto/markets"): markets,
    ("GET", "/api/crypto/coin"): coin,
    ("GET", "/api/crypto/search"): search,
    ("GET", "/api/crypto/fng"): fng,
}

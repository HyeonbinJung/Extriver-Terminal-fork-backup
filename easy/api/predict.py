"""예측시장 — Polymarket (gamma / clob public API) + Kalshi public market data.

Endpoints mirror fincept-qt/src/services/polymarket/PolymarketService.cpp (gamma /events ordered by
volume, tag_id filter, /public-search, clob /prices-history) and the Kalshi REST client
(api.elections.kalshi.com /events with nested markets, series candlesticks). All keyless, read-only.
"""

from __future__ import annotations

import json
import re
import time

import requests

from api.common import BadRequest, cached, clean

GAMMA = "https://gamma-api.polymarket.com"
CLOB = "https://clob.polymarket.com"
KALSHI = "https://api.elections.kalshi.com/trade-api/v2"
UA = {"User-Agent": "Mozilla/5.0 (MaruTerminal)", "Accept": "application/json"}
TIMEOUT = (5, 15)

# Curated Polymarket tags (id → Korean label). Ids from gamma /events tags.
POLY_TAGS = [
    ("", "전체"), ("2", "정치"), ("144", "선거"), ("100265", "지정학"), ("21", "암호화폐"), ("120", "금융"),
    ("100328", "경제"), ("1401", "기술"), ("439", "AI"), ("126", "트럼프"), ("101970", "세계"), ("1", "스포츠"),
    ("596", "문화"), ("74", "과학"),
]
TAG_KO = {"Politics": "정치", "Elections": "선거", "Geopolitics": "지정학", "Crypto": "암호화폐", "Finance": "금융",
          "Economy": "경제", "Tech": "기술", "AI": "AI", "Trump": "트럼프", "World": "세계", "Sports": "스포츠",
          "Culture": "문화", "Science": "과학", "Business": "비즈니스", "Fed": "연준", "Bitcoin": "비트코인",
          "Ethereum": "이더리움", "Games": "게임", "Esports": "e스포츠", "Soccer": "축구", "Iran": "이란",
          "Israel": "이스라엘", "Ukraine": "우크라이나", "Russia": "러시아", "China": "중국", "United States": "미국",
          "Global Elections": "해외 선거", "US Election": "미국 선거", "Midterms": "중간선거", "Senate": "상원",
          "Crypto Prices": "코인 가격", "Big Tech": "빅테크", "Fed Rates": "연준 금리", "Economic Policy": "경제 정책",
          "Stocks": "주식", "Earnings": "실적", "Weather": "날씨", "Climate": "기후", "Recurring": "반복 이벤트",
          "Basketball": "농구", "NBA": "NBA", "NFL": "NFL", "Hockey": "하키", "Tennis": "테니스", "Movies": "영화",
          "Music": "음악", "Awards": "시상식", "Korea": "한국", "South Korea": "한국", "Japan": "일본"}
KALSHI_KO = {"Elections": "선거", "Politics": "정치", "Sports": "스포츠", "Economics": "경제", "Entertainment": "엔터테인먼트",
             "Companies": "기업", "Science and Technology": "과학·기술", "Financials": "금융", "Climate and Weather": "기후·날씨",
             "Health": "보건", "World": "세계", "Social": "사회", "AI": "AI", "Transportation": "교통", "Business": "비즈니스",
             "Crypto": "암호화폐", "Mentions": "언급"}
HIDE_TAGS = {"Hide From New", "Earn 3.25%", "Hit Price", "Weekly", "Main Election", "Recurring", "Daily", "Monthly"}

SPORTS = {"Sports", "Games", "Esports", "Soccer", "NFL", "NBA", "NHL", "Hockey", "Basketball", "Tennis", "MLB", "Baseball",
          "Football", "league of legends", "Dota 2", "CS2", "UFC", "Golf", "Cricket", "F1"}
TOKEN_RE =re.compile(r"^\d{10,90}$")
ID_RE = re.compile(r"^\d{1,12}$")
KT_RE = re.compile(r"^[A-Z0-9.\-_]{2,80}$")


def _get(url: str, params: dict | None = None):
    r = requests.get(url, params=params, headers=UA, timeout=TIMEOUT)
    if r.status_code == 429:
        raise BadRequest("요청이 너무 많습니다. 잠시 후 다시 시도하세요.")
    if r.status_code >= 400:
        raise BadRequest(f"외부 API 오류 (HTTP {r.status_code})")
    return r.json()


def _jl(v):
    if isinstance(v, list):
        return v
    try:
        x = json.loads(v or "[]")
        return x if isinstance(x, list) else []
    except (TypeError, ValueError):
        return []


def _f(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


# --------------------------------------------------------------------------- #
# Polymarket
# --------------------------------------------------------------------------- #
def _poly_market(m: dict) -> dict:
    names, prices, toks = _jl(m.get("outcomes")), _jl(m.get("outcomePrices")), _jl(m.get("clobTokenIds"))
    outs = [{"name": n, "p": _f(prices[i]) if i < len(prices) else None, "token": toks[i] if i < len(toks) else None}
            for i, n in enumerate(names)]
    return {"id": m.get("id"), "question": m.get("question"), "label": m.get("groupItemTitle") or "",
            "outcomes": outs, "volume": _f(m.get("volumeNum") or m.get("volume")), "volume24": _f(m.get("volume24hr")),
            "liquidity": _f(m.get("liquidityNum") or m.get("liquidity")), "change1d": _f(m.get("oneDayPriceChange")),
            "last": _f(m.get("lastTradePrice")), "bid": _f(m.get("bestBid")), "ask": _f(m.get("bestAsk")),
            "spread": _f(m.get("spread")), "end": m.get("endDate"), "closed": bool(m.get("closed")),
            "active": bool(m.get("active")), "slug": m.get("slug")}


def _poly_event(e: dict, full: bool = False) -> dict:
    mk = [_poly_market(m) for m in (e.get("markets") or []) if not m.get("closed")]
    # multi-outcome events: rank sub-markets by YES price
    mk.sort(key=lambda m: -((m["outcomes"][0]["p"] or 0) if m["outcomes"] else 0))
    tags = [t.get("label") for t in (e.get("tags") or []) if t.get("label") and t.get("label") not in HIDE_TAGS]
    desc = (e.get("description") or "").strip()
    return {
        "id": e.get("id"), "title": e.get("title"), "slug": e.get("slug"), "image": e.get("icon") or e.get("image"),
        "volume": _f(e.get("volume")), "volume24": _f(e.get("volume24hr")), "liquidity": _f(e.get("liquidity")),
        "oi": _f(e.get("openInterest")), "end": e.get("endDate"), "start": e.get("startDate"),
        "tags": tags[:6], "tags_ko": [TAG_KO.get(t, "") for t in tags[:6]],
        "comments": e.get("commentCount"), "neg_risk": bool(e.get("negRisk")),
        "desc": desc if full else desc[:280], "resolution": e.get("resolutionSource") or "",
        "markets": mk if full else mk[:6], "n_markets": len(mk),
        "url": f"https://polymarket.com/event/{e.get('slug')}" if e.get("slug") else None,
    }


@cached(120)
def _poly_events(tag: str, order: str) -> list:
    params = {"closed": "false", "active": "true", "archived": "false", "limit": 80, "order": order, "ascending": "false"}
    if tag:
        params["tag_id"] = tag
    return [_poly_event(e) for e in _get(GAMMA + "/events", params) if e.get("markets")]


@cached(300)
def _poly_search(term: str) -> list:
    res = _get(GAMMA + "/public-search", {"q": term, "limit_per_type": 30, "events_status": "active"})
    evs = res.get("events") or [] if isinstance(res, dict) else []
    return [_poly_event(e) for e in evs if not e.get("closed") and e.get("markets")]


def poly(q, body):
    """GET /api/predict/poly?tag=&order=volume24hr|volume|liquidity|endDate&q= — active events."""
    tag = (q.get("tag") or "").strip()
    if tag and not ID_RE.match(tag):
        raise BadRequest("태그 ID 형식이 올바르지 않습니다.")
    order = q.get("order") or "volume24hr"
    if order not in ("volume24hr", "volume", "liquidity", "endDate", "startDate"):
        raise BadRequest("정렬 기준이 올바르지 않습니다.")
    term = (q.get("q") or "").strip()[:60]
    events = _poly_search(term) if term else _poly_events(tag, order)
    if q.get("nosports") in ("1", "true") and tag != "1":
        events = [e for e in events if not SPORTS & set(e["tags"])]
    return clean({"events": events, "tags": POLY_TAGS, "ts": int(time.time())})


@cached(120)
def _poly_event_full(eid: str) -> dict:
    return _poly_event(_get(f"{GAMMA}/events/{eid}"), full=True)


def poly_event(q, body):
    """GET /api/predict/poly_event?id=… — one event with all sub-markets + full description."""
    eid = (q.get("id") or "").strip()
    if not ID_RE.match(eid):
        raise BadRequest("이벤트 ID 형식이 올바르지 않습니다.")
    return clean(_poly_event_full(eid))


@cached(300)
def _poly_hist(token: str, interval: str, fidelity: int) -> list:
    res = _get(CLOB + "/prices-history", {"market": token, "interval": interval, "fidelity": fidelity})
    return [{"t": int(h["t"]), "p": float(h["p"])} for h in (res.get("history") or []) if "t" in h and "p" in h]


def poly_history(q, body):
    """GET /api/predict/poly_history?token=…&interval=1d|1w|1m|max — YES-price history from the CLOB."""
    token = (q.get("token") or "").strip()
    if not TOKEN_RE.match(token):
        raise BadRequest("토큰 ID 형식이 올바르지 않습니다.")
    interval = q.get("interval") or "1m"
    fid = {"1d": 10, "1w": 60, "1m": 240, "max": 1440}.get(interval)
    if fid is None:
        raise BadRequest("기간은 1d, 1w, 1m, max 중 하나입니다.")
    return {"history": _poly_hist(token, interval, fid), "interval": interval}


# --------------------------------------------------------------------------- #
# Kalshi
# --------------------------------------------------------------------------- #
def _k_market(m: dict) -> dict:
    yes = _f(m.get("last_price_dollars")) or _f(m.get("yes_bid_dollars"))
    prev = _f(m.get("previous_price_dollars"))
    return {"ticker": m.get("ticker"), "title": m.get("title"), "label": m.get("yes_sub_title") or m.get("subtitle") or "",
            "yes": yes, "bid": _f(m.get("yes_bid_dollars")), "ask": _f(m.get("yes_ask_dollars")),
            "change1d": (yes - prev) if yes is not None and prev is not None else None,
            "volume": _f(m.get("volume_fp")), "volume24": _f(m.get("volume_24h_fp")), "oi": _f(m.get("open_interest_fp")),
            "close": m.get("close_time"), "rules": (m.get("rules_primary") or "")[:600]}


@cached(600)
def _kalshi_all() -> list:
    evs, cur = [], None
    for _ in range(4):
        params = {"status": "open", "limit": 200, "with_nested_markets": "true"}
        if cur:
            params["cursor"] = cur
        d = _get(KALSHI + "/events", params)
        evs += d.get("events") or []
        cur = d.get("cursor")
        if not cur:
            break
    out = []
    for e in evs:
        if str(e.get("event_ticker", "")).startswith("KXMVE"):  # multivariate sports parlays — noise
            continue
        mk = [_k_market(m) for m in (e.get("markets") or []) if m.get("status") in ("active", "open", None)]
        if not mk:
            continue
        mk.sort(key=lambda m: -(m["yes"] or 0))
        out.append({"ticker": e.get("event_ticker"), "series": e.get("series_ticker"), "title": e.get("title"),
                    "sub": e.get("sub_title") or "", "category": e.get("category") or "",
                    "category_ko": KALSHI_KO.get(e.get("category") or "", e.get("category") or ""),
                    "volume": sum(m["volume"] or 0 for m in mk), "volume24": sum(m["volume24"] or 0 for m in mk),
                    "oi": sum(m["oi"] or 0 for m in mk), "close": min((m["close"] for m in mk if m["close"]), default=None),
                    "n_markets": len(mk), "markets": mk[:40],
                    "url": f"https://kalshi.com/markets/{(e.get('series_ticker') or '').lower()}"})
    out.sort(key=lambda e: (-e["volume24"], -e["volume"]))
    return out


def kalshi(q, body):
    """GET /api/predict/kalshi?category=&q= — open Kalshi events (sorted by 24h volume)."""
    allv = _kalshi_all()
    cat, term = (q.get("category") or "").strip(), (q.get("q") or "").strip().lower()[:60]
    rows = [e for e in allv if (not cat or e["category"] == cat) and (not term or term in (e["title"] + " " + e["sub"] + " " + e["ticker"]).lower())]
    cats = {}
    for e in allv:
        cats[e["category"]] = cats.get(e["category"], 0) + 1
    return clean({"events": [{**e, "markets": e["markets"][:6]} for e in rows[:120]], "total": len(rows),
                  "categories": [[c, KALSHI_KO.get(c, c), n] for c, n in sorted(cats.items(), key=lambda kv: -kv[1])],
                  "ts": int(time.time())})


def kalshi_event(q, body):
    """GET /api/predict/kalshi_event?ticker=… — event with all markets (from cache)."""
    t = (q.get("ticker") or "").strip().upper()
    if not KT_RE.match(t):
        raise BadRequest("티커 형식이 올바르지 않습니다.")
    for e in _kalshi_all():
        if e["ticker"] == t:
            return clean(e)
    raise BadRequest("해당 Kalshi 이벤트를 찾을 수 없습니다.")


@cached(300)
def _k_candles(series: str, ticker: str, days: int) -> list:
    end = int(time.time())
    period = 60 if days <= 7 else 1440
    d = _get(f"{KALSHI}/series/{series}/markets/{ticker}/candlesticks",
             {"start_ts": end - days * 86400, "end_ts": end, "period_interval": period})
    out = []
    for c in d.get("candlesticks") or []:
        p = (c.get("price") or {}).get("close_dollars") or (c.get("yes_bid") or {}).get("close_dollars")
        if p is not None:
            out.append({"t": int(c["end_period_ts"]), "p": float(p), "v": _f(c.get("volume_fp"))})
    return out


def kalshi_history(q, body):
    """GET /api/predict/kalshi_history?series=…&ticker=…&days=30"""
    series, ticker = (q.get("series") or "").strip().upper(), (q.get("ticker") or "").strip().upper()
    if not KT_RE.match(series) or not KT_RE.match(ticker):
        raise BadRequest("시리즈/티커 형식이 올바르지 않습니다.")
    days = int(q.get("days") or 30)
    if days not in (1, 7, 30, 90, 365):
        raise BadRequest("기간은 1, 7, 30, 90, 365일 중 하나입니다.")
    return {"history": _k_candles(series, ticker, days)}


ROUTES = {
    ("GET", "/api/predict/poly"): poly,
    ("GET", "/api/predict/poly_event"): poly_event,
    ("GET", "/api/predict/poly_history"): poly_history,
    ("GET", "/api/predict/kalshi"): kalshi,
    ("GET", "/api/predict/kalshi_event"): kalshi_event,
    ("GET", "/api/predict/kalshi_history"): kalshi_history,
}

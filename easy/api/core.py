"""Shell-level endpoints used by every screen: batch quotes, sparklines, search, feature guide."""

from __future__ import annotations

import json

from api.common import EASY_DIR, BadRequest, batch_quotes, cached, check_symbols, clean, quiet, yfd


@cached(3600)
def _names(symbols: tuple[str, ...]) -> dict:
    res = quiet(yfd.get_quote_names, list(symbols))
    if isinstance(res, dict) and "error" not in res:
        return res.get("names", res) if isinstance(res.get("names", res), dict) else {}
    return {}


@cached(300)
def _sparks(symbols: tuple[str, ...], period: str, interval: str) -> dict:
    res = quiet(yfd.get_batch_sparklines, list(symbols), period, interval)
    return {} if not isinstance(res, dict) or "error" in res else res


def quotes(q, body):
    """GET /api/quotes?symbols=A,B&names=1&spark=1  → {"quotes": [...]} in request order."""
    syms = tuple(check_symbols(q.get("symbols"), 1, 60))
    got = {r["symbol"]: r for r in batch_quotes(syms)}
    names = _names(syms) if q.get("names") else {}
    sparks = _sparks(syms, q.get("spark_period", "5d"), q.get("spark_interval", "1h")) if q.get("spark") else {}
    out = []
    for s in syms:
        r = dict(got.get(s) or {"symbol": s, "price": None})
        if names:
            r["name"] = names.get(s) or ""
        if sparks:
            r["spark"] = sparks.get(s) or []
        out.append(r)
    return clean({"quotes": out})


@cached(3600)
def _search(term: str) -> list:
    res = quiet(yfd.search_symbols, term, 12)
    if isinstance(res, dict):
        res = res.get("results") or res.get("data") or []
    return res if isinstance(res, list) else []


def search(q, body):
    term = (q.get("q") or "").strip()[:40]
    return {"results": clean(_search(term)) if len(term) >= 1 else []}


def features(q, body):
    return json.loads((EASY_DIR / "features.json").read_text(encoding="utf-8"))


def ping(q, body):
    return {"ok": True}


def screens(q, body):
    """Screen scripts to load, in file-name order (glossary first so terms exist)."""
    files = sorted(p.name for p in (EASY_DIR / "static" / "js" / "screens").glob("*.js"))
    return {"files": sorted(files, key=lambda f: (f != "_glossary.js", f))}


ROUTES = {
    ("GET", "/api/quotes"): quotes,
    ("GET", "/api/search"): search,
    ("GET", "/api/features"): features,
    ("GET", "/api/ping"): ping,
    ("GET", "/api/screens"): screens,
}

__all__ = ["ROUTES", "BadRequest"]

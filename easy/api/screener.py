"""스크리너 API — Yahoo 사전 정의 스크린(yf.screen) + 사용자 조건(EquityQuery).

  GET  /api/screener/presets
  GET  /api/screener/run?preset=day_gainers&count=50
  POST /api/screener/custom   {region, sector, mcap_min, mcap_max, pe_min, pe_max, div_min, chg_min, chg_max,
                               roe_min, vol_min, sort, asc, count}
"""

from __future__ import annotations

import contextlib
import io
import math

from api.common import muted, BadRequest, cached, clean, num

PRESETS = [
    # (id, 한국어 이름, 설명, 종류)
    ("day_gainers", "오늘의 상승률 상위", "미국 시가총액 20억 달러 이상 종목 중 오늘 3% 넘게 오른 종목 (상승률 순).", "주식"),
    ("day_losers", "오늘의 하락률 상위", "미국 시가총액 20억 달러 이상 종목 중 오늘 2.5% 넘게 내린 종목 (하락률 순).", "주식"),
    ("most_actives", "거래량 상위", "미국 시가총액 20억 달러 이상 종목 중 오늘 거래가 가장 많은 종목.", "주식"),
    ("undervalued_growth_stocks", "저평가 성장주", "PER 0~20, PEG 1 미만, 이익 성장률 25% 이상인 종목.", "주식"),
    ("growth_technology_stocks", "성장 기술주", "매출·이익 성장률 25% 이상인 기술 섹터 종목.", "주식"),
    ("aggressive_small_caps", "공격적 소형주", "이익 성장률 25% 이상인 NYSE·나스닥 소형주.", "주식"),
    ("small_cap_gainers", "소형주 상승 상위", "시가총액 20억 달러 미만 종목 중 오늘 5% 이상 오른 종목.", "주식"),
    ("undervalued_large_caps", "저평가 대형주", "시가총액 100억~1000억 달러, PER 0~20, PEG 1 미만인 대형주.", "주식"),
    ("most_shorted_stocks", "공매도 비율 상위", "유통주식 대비 공매도 비율이 가장 높은 미국 종목.", "주식"),
    ("top_etfs_us", "미국 상위 ETF", "수익률·평가 기준 상위 미국 상장 ETF.", "ETF"),
    ("top_performing_etfs", "수익률 상위 ETF", "최근 성과가 가장 좋은 ETF.", "ETF"),
    ("technology_etfs", "기술 섹터 ETF", "기술 섹터에 투자하는 ETF.", "ETF"),
    ("bond_etfs", "채권 ETF", "채권에 투자하는 ETF.", "ETF"),
    ("top_mutual_funds", "상위 뮤추얼 펀드", "성과 기준 상위 뮤추얼 펀드.", "펀드"),
    ("solid_large_growth_funds", "대형 성장 펀드", "평가가 좋은 대형 성장주 펀드.", "펀드"),
    ("solid_midcap_growth_funds", "중형 성장 펀드", "평가가 좋은 중형 성장주 펀드.", "펀드"),
    ("conservative_foreign_funds", "보수적 해외 펀드", "변동성이 낮은 해외 주식 펀드.", "펀드"),
    ("high_yield_bond", "하이일드 채권 펀드", "수익률이 높은(신용도 낮은) 채권 펀드.", "펀드"),
    ("portfolio_anchors", "포트폴리오 핵심 펀드", "장기 보유의 중심이 될 만한 대형 블렌드 펀드.", "펀드"),
]
PRESET_IDS = {p[0] for p in PRESETS}

REGIONS = [("us", "미국"), ("kr", "한국"), ("jp", "일본"), ("cn", "중국"), ("hk", "홍콩"), ("tw", "대만"), ("in", "인도"),
           ("gb", "영국"), ("de", "독일"), ("fr", "프랑스"), ("ca", "캐나다"), ("au", "호주"), ("sg", "싱가포르")]
SECTORS = [("Technology", "기술"), ("Communication Services", "커뮤니케이션"), ("Consumer Cyclical", "경기소비재"),
           ("Consumer Defensive", "필수소비재"), ("Financial Services", "금융"), ("Healthcare", "헬스케어"),
           ("Industrials", "산업재"), ("Energy", "에너지"), ("Basic Materials", "소재"), ("Real Estate", "부동산"),
           ("Utilities", "유틸리티")]
MAJOR_EXCHANGES = {"us": ["NMS", "NYQ", "NGM", "NCM", "ASE"], "kr": ["KSC", "KOE"]}
SORTS = {"mcap": "intradaymarketcap", "chg": "percentchange", "volume": "dayvolume", "pe": "peratio.lasttwelvemonths",
         "div": "forward_dividend_yield", "price": "intradayprice"}


def _f(v):
    try:
        v = float(v)
    except (TypeError, ValueError):
        return None
    return None if math.isnan(v) or math.isinf(v) else v


def _row(x: dict) -> dict:
    dy = _f(x.get("dividendYield"))
    return {
        "symbol": x.get("symbol"), "name": x.get("longName") or x.get("shortName") or x.get("displayName") or "",
        "type": x.get("quoteType"), "exchange": x.get("fullExchangeName") or x.get("exchange"), "currency": x.get("currency"),
        "price": _f(x.get("regularMarketPrice")), "change": _f(x.get("regularMarketChange")),
        "change_pct": _f(x.get("regularMarketChangePercent")), "volume": _f(x.get("regularMarketVolume")) or None,
        "avg_volume": _f(x.get("averageDailyVolume3Month")), "mcap": _f(x.get("marketCap")) or _f(x.get("netAssets")),
        "pe": _f(x.get("trailingPE")), "fpe": _f(x.get("forwardPE")) or _f(x.get("priceEpsCurrentYear")), "pb": _f(x.get("priceToBook")),
        "div_yield": dy / 100 if dy is not None else _f(x.get("trailingAnnualDividendYield")),
        "w52_chg": (_f(x.get("fiftyTwoWeekChangePercent")) or 0) / 100 if x.get("fiftyTwoWeekChangePercent") is not None else None,
        "ytd": (_f(x.get("ytdReturn")) or 0) / 100 if x.get("ytdReturn") is not None else None,
        "expense": _f(x.get("netExpenseRatio")),
    }


def _screen(query, **kw) -> dict:
    import yfinance as yf

    try:
        with muted():
            return yf.screen(query, **kw) or {}
    except Exception as e:
        raise BadRequest(f"Yahoo 스크리너 요청 실패: {e}")


def presets(q, body):
    return {"presets": [{"id": i, "name": n, "desc": d, "kind": k} for i, n, d, k in PRESETS],
            "regions": [{"id": a, "name": b} for a, b in REGIONS],
            "sectors": [{"id": a, "name": b} for a, b in SECTORS],
            "sorts": list(SORTS)}


@cached(300)
def _run(preset: str, count: int) -> dict:
    res = _screen(preset, count=count)
    rows = [_row(x) for x in res.get("quotes", []) if x.get("symbol")]
    meta = next(p for p in PRESETS if p[0] == preset)
    return clean({"id": preset, "name": meta[1], "desc": meta[2], "kind": meta[3], "total": res.get("total"),
                  "title_en": res.get("title"), "rows": rows})


def run(q, body):
    preset = q.get("preset") or "day_gainers"
    if preset not in PRESET_IDS:
        raise BadRequest("알 수 없는 스크린입니다.")
    count = int(num(q.get("count"), "개수", 5, 250, 100))
    return _run(preset, count)


@cached(300)
def _custom(key: tuple) -> dict:
    from yfinance import EquityQuery as Q

    p = dict(key)
    conds = [Q("eq", ["region", p["region"]])]
    if p.get("sector"):
        conds.append(Q("eq", ["sector", p["sector"]]))
    if p.get("major") and p["region"] in MAJOR_EXCHANGES:  # 장외(OTC) 등 소규모 시장 제외
        conds.append(Q("is-in", ["exchange", *MAJOR_EXCHANGES[p["region"]]]))

    def rng(field, lo, hi):
        if lo is not None and hi is not None:
            conds.append(Q("btwn", [field, lo, hi]))
        elif lo is not None:
            conds.append(Q("gte", [field, lo]))
        elif hi is not None:
            conds.append(Q("lte", [field, hi]))

    rng("intradaymarketcap", p.get("mcap_min"), p.get("mcap_max"))
    rng("peratio.lasttwelvemonths", p.get("pe_min"), p.get("pe_max"))
    rng("percentchange", p.get("chg_min"), p.get("chg_max"))
    rng("pricebookratio.quarterly", p.get("pb_min"), p.get("pb_max"))
    if p.get("div_min") is not None:
        conds.append(Q("gte", ["forward_dividend_yield", p["div_min"]]))
    if p.get("roe_min") is not None:
        conds.append(Q("gte", ["returnonequity.lasttwelvemonths", p["roe_min"]]))
    if p.get("vol_min") is not None:
        conds.append(Q("gte", ["dayvolume", p["vol_min"]]))
    query = Q("and", conds) if len(conds) > 1 else conds[0]
    res = _screen(query, sortField=SORTS[p["sort"]], sortAsc=bool(p["asc"]), size=p["count"])
    rows = [_row(x) for x in res.get("quotes", []) if x.get("symbol")]
    return clean({"total": res.get("total"), "rows": rows, "conditions": len(conds)})


def custom(q, body):
    b = body or {}
    region = str(b.get("region") or "us").lower()
    if region not in {r[0] for r in REGIONS}:
        raise BadRequest("지원하지 않는 지역입니다.")
    sector = b.get("sector") or None
    if sector and sector not in {s[0] for s in SECTORS}:
        raise BadRequest("지원하지 않는 섹터입니다.")
    sort = b.get("sort") or "mcap"
    if sort not in SORTS:
        raise BadRequest("정렬 기준이 올바르지 않습니다.")

    def opt(k, name, lo=-1e18, hi=1e18):
        v = b.get(k)
        return None if v in (None, "") else num(v, name, lo, hi)

    key = {
        "region": region, "sector": sector, "major": bool(b.get("major", True)), "sort": sort, "asc": bool(b.get("asc")),
        "count": int(num(b.get("count"), "개수", 5, 250, 100)),
        "mcap_min": opt("mcap_min", "시가총액 최소", 0), "mcap_max": opt("mcap_max", "시가총액 최대", 0),
        "pe_min": opt("pe_min", "PER 최소", -1e4, 1e5), "pe_max": opt("pe_max", "PER 최대", -1e4, 1e5),
        "pb_min": opt("pb_min", "PBR 최소", 0, 1e4), "pb_max": opt("pb_max", "PBR 최대", 0, 1e4),
        "div_min": opt("div_min", "배당수익률 최소", 0, 100),
        "chg_min": opt("chg_min", "등락률 최소", -100, 1000), "chg_max": opt("chg_max", "등락률 최대", -100, 1000),
        "roe_min": opt("roe_min", "ROE 최소", -1000, 1000), "vol_min": opt("vol_min", "거래량 최소", 0),
    }
    return _custom(tuple(sorted(key.items(), key=lambda kv: kv[0])))


ROUTES = {
    ("GET", "/api/screener/presets"): presets,
    ("GET", "/api/screener/run"): run,
    ("POST", "/api/screener/custom"): custom,
}

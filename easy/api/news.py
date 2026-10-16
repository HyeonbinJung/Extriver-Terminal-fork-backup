"""뉴스 — RSS aggregation modelled on the Fincept desktop News screen.

Feed list follows fincept-qt/src/services/news/NewsService_Feeds.cpp (default feeds) plus
keyless Korean sources. Feeds are fetched in parallel, parsed with xml.etree (DOCTYPE/ENTITY
rejected, 3 MB cap), enriched with category / sentiment / impact / $TICKER tags (keyword
rules, cf. NewsService_Classification.cpp) and de-duplicated by title similarity.
"""

from __future__ import annotations

import hashlib
import html
import re
import threading
import time
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime

import requests

from api.common import BadRequest, clean

UA = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
    "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5",
}
MAX_BYTES = 3_000_000
TTL = 300
PER_FEED = 40
MAX_AGE = 7 * 86400
KST = timezone(timedelta(hours=9))

# (id, source label, url, base category, region, lang)
FEEDS = [
    ("cnbc-top", "CNBC", "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114", "MKT", "US", "en"),
    ("cnbc-world", "CNBC", "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100727362", "MKT", "GLOBAL", "en"),
    ("cnbc-tech", "CNBC", "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=19854910", "TECH", "US", "en"),
    ("marketwatch", "MARKETWATCH", "https://feeds.marketwatch.com/marketwatch/topstories/", "MKT", "US", "en"),
    ("wsj-markets", "WSJ", "https://feeds.a.dj.com/rss/RSSMarketsMain.xml", "MKT", "US", "en"),
    ("bloomberg-mkts", "BLOOMBERG", "https://feeds.bloomberg.com/markets/news.rss", "MKT", "GLOBAL", "en"),
    ("bbc-business", "BBC", "https://feeds.bbci.co.uk/news/business/rss.xml", "MKT", "GLOBAL", "en"),
    ("bbc-world", "BBC", "https://feeds.bbci.co.uk/news/world/rss.xml", "GEO", "GLOBAL", "en"),
    ("seekingalpha", "SEEKING ALPHA", "https://seekingalpha.com/market_currents.xml", "MKT", "US", "en"),
    ("investing", "INVESTING.COM", "https://www.investing.com/rss/news.rss", "MKT", "GLOBAL", "en"),
    ("fxstreet", "FXSTREET", "https://www.fxstreet.com/rss/news", "MKT", "GLOBAL", "en"),
    ("nikkei-asia", "NIKKEI ASIA", "https://asia.nikkei.com/rss/feed/nar", "MKT", "ASIA", "en"),
    ("economist", "ECONOMIST", "https://www.economist.com/finance-and-economics/rss.xml", "ECO", "GLOBAL", "en"),
    ("benzinga", "BENZINGA", "https://www.benzinga.com/feed", "MKT", "US", "en"),
    ("oilprice", "OILPRICE", "https://oilprice.com/rss/main", "NRG", "GLOBAL", "en"),
    ("mining", "MINING.COM", "https://www.mining.com/feed/", "NRG", "GLOBAL", "en"),
    ("coindesk", "COINDESK", "https://www.coindesk.com/arc/outboundfeeds/rss/", "CRPT", "GLOBAL", "en"),
    ("cointelegraph", "COINTELEGRAPH", "https://cointelegraph.com/rss", "CRPT", "GLOBAL", "en"),
    ("decrypt", "DECRYPT", "https://decrypt.co/feed", "CRPT", "GLOBAL", "en"),
    ("theblock", "THE BLOCK", "https://www.theblock.co/rss.xml", "CRPT", "GLOBAL", "en"),
    ("fed", "FED", "https://www.federalreserve.gov/feeds/press_all.xml", "ECO", "US", "en"),
    ("ecb", "ECB", "https://www.ecb.europa.eu/rss/press.html", "ECO", "EU", "en"),
    ("boe", "BOE", "https://www.bankofengland.co.uk/rss/news", "ECO", "UK", "en"),
    ("sec", "SEC", "https://www.sec.gov/news/pressreleases.rss", "ECO", "US", "en"),
    ("techcrunch", "TECHCRUNCH", "https://techcrunch.com/feed/", "TECH", "GLOBAL", "en"),
    ("aljazeera", "AL JAZEERA", "https://www.aljazeera.com/xml/rss/all.xml", "GEO", "GLOBAL", "en"),
    ("guardian-world", "GUARDIAN", "https://www.theguardian.com/world/rss", "GEO", "GLOBAL", "en"),
    ("france24", "FRANCE 24", "https://www.france24.com/en/rss", "GEO", "EU", "en"),
    ("scmp", "SCMP", "https://www.scmp.com/rss/91/feed", "GEO", "ASIA", "en"),
    ("cna", "CNA", "https://www.channelnewsasia.com/rssfeeds/8395986", "MKT", "ASIA", "en"),
    ("calculated-risk", "CALCULATED RISK", "https://feeds.feedburner.com/CalculatedRisk", "ECO", "US", "en"),
    # Korean (keyless)
    ("yna-economy", "연합뉴스", "https://www.yna.co.kr/rss/economy.xml", "KR", "KR", "ko"),
    ("yna-market", "연합뉴스", "https://www.yna.co.kr/rss/market.xml", "KR", "KR", "ko"),
    ("hankyung-economy", "한국경제", "https://www.hankyung.com/feed/economy", "KR", "KR", "ko"),
    ("hankyung-finance", "한국경제", "https://www.hankyung.com/feed/finance", "KR", "KR", "ko"),
    ("mk-economy", "매일경제", "https://www.mk.co.kr/rss/30100041/", "KR", "KR", "ko"),
    ("mk-stock", "매일경제", "https://www.mk.co.kr/rss/50200011/", "KR", "KR", "ko"),
    ("chosun-economy", "조선일보", "https://www.chosun.com/arc/outboundfeeds/rss/category/economy/?outputType=xml", "KR", "KR", "ko"),
    ("khan-economy", "경향신문", "https://www.khan.co.kr/rss/rssdata/economy_news.xml", "KR", "KR", "ko"),
    ("etnews", "전자신문", "https://rss.etnews.com/Section901.xml", "KR", "KR", "ko"),
]

# --------------------------------------------------------------------------- #
# Keyword rules
# --------------------------------------------------------------------------- #
BULL = ["surge", "soar", "rally", "rallies", "jump", "gain", "rise", "rises", "rising", "beat", "beats", "record high",
        "upgrade", "boost", "rebound", "bullish", "outperform", "climb", "tops", "strong", "optimis", "recover",
        "higher", "best day", "all-time high", "growth", "expands", "approval", "approves", "wins",
        "급등", "상승", "강세", "호조", "최고", "반등", "돌파", "흑자", "증가", "호실적", "상향", "신고가", "훈풍", "회복",
        "개선", "최대", "랠리", "순매수", "수혜", "기대감", "껑충", "날개"]
BEAR = ["plunge", "tumble", "fall", "falls", "drop", "slump", "crash", "sink", "loss", "miss", "downgrade", "fear",
        "recession", "warn", "bearish", "slide", "decline", "layoff", "bankrupt", "sell-off", "selloff", "weak",
        "concern", "worry", "worries", "lower", "cuts jobs", "probe", "lawsuit", "fraud", "hack", "war", "wars", "attack",
        "crisis", "default", "slows", "slowdown", "risk", "tariff", "sanction", "discourag", "disappoint", "stall",
        "struggl", "hurt", "pressure", "plummet", "rout", "crumble", "shatter", "slip", "dent", "fears", "killed", "dead",
        "급락", "하락", "약세", "부진", "우려", "적자", "감소", "폭락", "하향", "쇼크", "위기", "충격", "둔화", "경고",
        "손실", "순매도", "불안", "악재", "침체", "추락", "털썩", "공포", "리스크", "소송", "해킹"]
HIGH = ["breaking", "fomc", "rate hike", "rate cut", "interest rate", "rates", "federal reserve", "powell", "inflation",
        "cpi", "payrolls", "jobs report", "crash", "plunge", "war", "invasion", "missile", "sanction", "default",
        "recession", "emergency", "bank run", "circuit breaker", "trading halt", "tariff", "opec", "ecb", "bank of japan",
        "boj", "flash crash", "bankruptcy", "nuclear",
        "속보", "기준금리", "금리 인상", "금리 인하", "급락", "폭락", "급등", "연준", "한은", "전쟁", "관세", "서킷브레이커",
        "물가", "환율", "제재", "파산"]
MED = ["earnings", "revenue", "guidance", "gdp", "oil", "merger", "acquisition", "acquire", "ipo", "layoff",
       "downgrade", "upgrade", "profit", "outlook", "forecast", "unemployment", "treasury", "yield", "dollar",
       "bitcoin", "stocks", "s&p", "nasdaq", "dow", "regulat", "antitrust", "investigat",
       "실적", "영업이익", "매출", "인수", "합병", "상장", "코스피", "코스닥", "국채", "유가", "수출", "고용", "부동산"]
BREAKING = ["breaking", "속보", "[단독]", "live:", "live updates", "just in", "flash"]

CAT_KW = {
    "EARN": ["earnings", "quarterly", "revenue", "eps", "guidance", "profit", "q1 ", "q2 ", "q3 ", "q4 ", "results",
             "실적", "영업이익", "매출", "순이익", "분기"],
    "ECO": ["inflation", "gdp", "federal reserve", "fed ", "central bank", "unemployment", "cpi", "jobs report",
            "interest rate", "payrolls", "ecb", "treasury", "yield", "economy", "economic", "recession",
            "금리", "물가", "고용", "경기", "한은", "연준", "기재부", "경제성장", "환율", "국채"],
    "TECH": [" ai ", "a.i.", "artificial intelligence", "chip", "semiconductor", "software", "nvidia", "apple",
             "microsoft", "openai", "google", "cloud", "tech", "반도체", "인공지능", "ai ", "플랫폼", "빅테크"],
    "NRG": ["oil", "crude", "opec", "natural gas", "lng", "energy", "brent", "wti", "solar", "power grid", "uranium",
            "유가", "원유", "에너지", "가스", "전력", "정유"],
    "CRPT": ["bitcoin", "crypto", "ethereum", "blockchain", "stablecoin", "token", "solana", "xrp", "defi", "nft",
             "비트코인", "가상자산", "암호화폐", "코인", "이더리움", "스테이블코인"],
    "GEO": ["war", "sanction", "iran", "russia", "ukraine", "israel", "gaza", "taiwan", "election", "tariff",
            "president", "minister", "geopolit", "border", "summit", "trump", "xi jinping",
            "전쟁", "제재", "관세", "대선", "정상회담", "북한", "외교"],
    "DEF": ["defense", "defence", "military", "missile", "pentagon", "nato", "army", "navy", "drone", "weapon",
            "방산", "국방", "미사일", "군사", "무기"],
    "KR": ["korea", "kospi", "kosdaq", "seoul", "samsung", "hyundai", "won ", "코스피", "코스닥"],
}

# company / keyword → (symbol, display label)
TICKERS = {
    "apple": ("AAPL", "AAPL"), "microsoft": ("MSFT", "MSFT"), "nvidia": ("NVDA", "NVDA"), "tesla": ("TSLA", "TSLA"),
    "amazon": ("AMZN", "AMZN"), "alphabet": ("GOOGL", "GOOGL"), "google": ("GOOGL", "GOOGL"), "meta platforms": ("META", "META"),
    "facebook": ("META", "META"), "netflix": ("NFLX", "NFLX"), "intel": ("INTC", "INTC"), "amd": ("AMD", "AMD"),
    "broadcom": ("AVGO", "AVGO"), "oracle": ("ORCL", "ORCL"), "salesforce": ("CRM", "CRM"), "adobe": ("ADBE", "ADBE"),
    "qualcomm": ("QCOM", "QCOM"), "micron": ("MU", "MU"), "tsmc": ("TSM", "TSM"), "asml": ("ASML", "ASML"),
    "boeing": ("BA", "BA"), "jpmorgan": ("JPM", "JPM"), "goldman": ("GS", "GS"), "morgan stanley": ("MS", "MS"),
    "bank of america": ("BAC", "BAC"), "citigroup": ("C", "C"), "wells fargo": ("WFC", "WFC"), "blackrock": ("BLK", "BLK"),
    "berkshire": ("BRK-B", "BRK.B"), "walmart": ("WMT", "WMT"), "costco": ("COST", "COST"), "disney": ("DIS", "DIS"),
    "exxon": ("XOM", "XOM"), "chevron": ("CVX", "CVX"), "pfizer": ("PFE", "PFE"), "eli lilly": ("LLY", "LLY"),
    "novo nordisk": ("NVO", "NVO"), "uber": ("UBER", "UBER"), "palantir": ("PLTR", "PLTR"), "coinbase": ("COIN", "COIN"),
    "microstrategy": ("MSTR", "MSTR"), "alibaba": ("BABA", "BABA"), "byd": ("BYDDY", "BYD"), "nike": ("NKE", "NKE"),
    "starbucks": ("SBUX", "SBUX"), "mcdonald": ("MCD", "MCD"), "visa": ("V", "V"), "mastercard": ("MA", "MA"),
    "paypal": ("PYPL", "PYPL"), "ford": ("F", "F"), "general motors": ("GM", "GM"), "openai": ("MSFT", "MSFT"),
    "samsung": ("005930.KS", "삼성전자"), "hyundai": ("005380.KS", "현대차"), "sk hynix": ("000660.KS", "SK하이닉스"),
    "sony": ("SONY", "SONY"), "toyota": ("TM", "TM"),
    "bitcoin": ("BTC-USD", "BTC"), "ethereum": ("ETH-USD", "ETH"), "solana": ("SOL-USD", "SOL"), "xrp": ("XRP-USD", "XRP"),
    "dogecoin": ("DOGE-USD", "DOGE"), "gold": ("GC=F", "GOLD"), "crude": ("CL=F", "WTI"), "brent": ("BZ=F", "BRENT"),
    "s&p 500": ("^GSPC", "SPX"), "nasdaq": ("^IXIC", "NDX"),
    # Korean
    "삼성전자": ("005930.KS", "삼성전자"), "sk하이닉스": ("000660.KS", "SK하이닉스"), "하이닉스": ("000660.KS", "SK하이닉스"),
    "현대차": ("005380.KS", "현대차"), "두산에너빌리티": ("034020.KS", "두산에너빌리티"), "현대모비스": ("012330.KS", "현대모비스"),
    "삼성생명": ("032830.KS", "삼성생명"), "삼성전기": ("009150.KS", "삼성전기"), "삼성중공업": ("010140.KS", "삼성중공업"),
    "hd현대중공업": ("329180.KS", "HD현대중공업"), "한화오션": ("042660.KS", "한화오션"), "크래프톤": ("259960.KS", "크래프톤"),
    "lg전자": ("066570.KS", "LG전자"), "sk텔레콤": ("017670.KS", "SK텔레콤"), "kt&g": ("033780.KS", "KT&G"), "하나금융": ("086790.KS", "하나금융지주"),
    "우리금융": ("316140.KS", "우리금융지주"), "고려아연": ("010130.KS", "고려아연"), "한미반도체": ("042700.KS", "한미반도체"), "현대자동차": ("005380.KS", "현대차"), "기아": ("000270.KS", "기아"),
    "lg에너지솔루션": ("373220.KS", "LG에너지솔루션"), "lg엔솔": ("373220.KS", "LG에너지솔루션"),
    "삼성바이오": ("207940.KS", "삼성바이오로직스"), "셀트리온": ("068270.KS", "셀트리온"), "네이버": ("035420.KS", "NAVER"),
    "카카오": ("035720.KS", "카카오"), "포스코": ("005490.KS", "POSCO홀딩스"), "lg화학": ("051910.KS", "LG화학"),
    "삼성sdi": ("006400.KS", "삼성SDI"), "kb금융": ("105560.KS", "KB금융"), "신한지주": ("055550.KS", "신한지주"),
    "한화에어로": ("012450.KS", "한화에어로스페이스"), "hd현대": ("267250.KS", "HD현대"), "두산": ("000150.KS", "두산"),
    "한국전력": ("015760.KS", "한국전력"), "한전": ("015760.KS", "한국전력"), "삼성물산": ("028260.KS", "삼성물산"),
    "에코프로": ("086520.KQ", "에코프로"), "알테오젠": ("196170.KQ", "알테오젠"), "엔비디아": ("NVDA", "NVDA"),
    "테슬라": ("TSLA", "TSLA"), "애플": ("AAPL", "AAPL"), "마이크로소프트": ("MSFT", "MSFT"), "비트코인": ("BTC-USD", "BTC"),
    "이더리움": ("ETH-USD", "ETH"), "코스피": ("^KS11", "KOSPI"), "코스닥": ("^KQ11", "KOSDAQ"),
}
_TICKER_ITEMS = sorted(TICKERS.items(), key=lambda kv: -len(kv[0]))
_ASCII_WORD = re.compile(r"^[a-z0-9&. \-]+$")
_TICKER_RE = {k: re.compile(r"(?<![a-z0-9])" + re.escape(k) + r"(?![a-z0-9])") for k, _ in _TICKER_ITEMS if _ASCII_WORD.match(k)}
_CASHTAG = re.compile(r"\$([A-Z]{1,5})\b")
_EXCH_TAG = re.compile(r"\((?:NASDAQ|NYSE|NYSEARCA|AMEX|OTC|TSX|LSE)\s*:\s*([A-Z.]{1,6})\)")

STOP = set("""a an the and or of to in on for with at by from as is are was were be been it its this that these those
into over after before about than more most new says say said will would could can may might not no yes up down out
off amid how why what who when where which while week year years day today report reports news live update updates
his her their our your you we they he she them us vs per inc corp co ltd plc group company""".split())
_TOKEN = re.compile(r"[a-z0-9]+|[가-힣]{2,}")
_TAG = re.compile(r"<[^>]+>")
_WS = re.compile(r"\s+")


def _strip_html(s: str | None, limit: int = 500) -> str:
    if not s:
        return ""
    s = html.unescape(_TAG.sub(" ", html.unescape(s)))
    s = _WS.sub(" ", s).strip()
    return s[:limit] + ("…" if len(s) > limit else "")


def _tokens(title: str) -> list[str]:
    return [t for t in _TOKEN.findall(title.lower()) if t not in STOP and (len(t) > 2 or not t.isascii())]


_RX_CACHE: dict[int, re.Pattern] = {}


def _rx(words) -> re.Pattern:
    """One regex per word list; ASCII words must start on a word boundary ('war' ≠ 'Schwarzman')."""
    key = id(words)
    if key not in _RX_CACHE:
        parts = []
        for w in words:
            ws = w.strip()
            if ws.isascii() and ws[:1].isalnum():  # word start boundary; short words must match whole ('defi' ≠ 'defies')
                parts.append(r"(?<![a-z0-9])" + re.escape(ws) + (r"(?![a-z])" if len(ws) <= 4 else ""))
            else:
                parts.append(re.escape(w))
        _RX_CACHE[key] = re.compile("|".join(parts))
    return _RX_CACHE[key]


def _has(text: str, words) -> int:
    return len(set(_rx(words).findall(text)))


# --------------------------------------------------------------------------- #
# Fetch + parse
# --------------------------------------------------------------------------- #
def _download(url: str) -> bytes:
    with requests.get(url, headers=UA, timeout=(5, 9), stream=True) as r:
        r.raise_for_status()
        buf = bytearray()
        for chunk in r.iter_content(65536):
            buf += chunk
            if len(buf) > MAX_BYTES:
                raise ValueError("응답이 너무 큼 (>3MB)")
        return bytes(buf)


def _safe_xml(raw: bytes) -> ET.Element:
    head = raw.lstrip()[:200].lower()
    if head.startswith(b"<!doctype html") or head.startswith(b"<html"):
        raise ValueError("RSS가 아닌 HTML 응답")
    if b"<!DOCTYPE" in raw or b"<!ENTITY" in raw or b"<!doctype" in raw:
        raise ValueError("DOCTYPE/ENTITY 포함 XML 거부")
    try:
        return ET.fromstring(raw)
    except ET.ParseError:
        # Unknown declared encoding or stray bytes: decode loosely and retry.
        m = re.search(rb'encoding=["\']([A-Za-z0-9_\-]+)', raw[:200])
        enc = m.group(1).decode() if m else "utf-8"
        try:
            txt = raw.decode(enc, errors="replace")
        except LookupError:
            txt = raw.decode("utf-8", errors="replace")
        txt = re.sub(r"^\s*<\?xml[^>]*\?>", "", txt)
        txt = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", txt)
        return ET.fromstring(txt)


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1].lower() if isinstance(tag, str) else ""


def _parse_date(s: str | None) -> float | None:
    if not s:
        return None
    s = s.strip()
    if "," in s:  # RFC 822 with a "+09:00" style offset (매일경제) → "+0900"
        s = re.sub(r"([+-]\d\d):(\d\d)$", lambda m: m.group(1) + m.group(2), s)
    try:
        d = parsedate_to_datetime(s)
        if d.tzinfo is None:
            d = d.replace(tzinfo=timezone.utc)
        return d.timestamp()
    except (TypeError, ValueError, IndexError):
        pass
    try:
        d = datetime.fromisoformat(s.replace("Z", "+00:00"))
        if d.tzinfo is None:
            d = d.replace(tzinfo=timezone.utc)
        return d.timestamp()
    except ValueError:
        pass
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y.%m.%d %H:%M:%S", "%Y-%m-%d %H:%M"):
        try:  # Korean feeds without TZ → KST
            return datetime.strptime(s[:19], fmt).replace(tzinfo=KST).timestamp()
        except ValueError:
            continue
    return None


def _parse(root: ET.Element) -> list[dict]:
    out = []
    for el in root.iter():
        if _local(el.tag) not in ("item", "entry"):
            continue
        rec = {"title": "", "link": "", "desc": "", "date": None}
        for ch in el:
            n = _local(ch.tag)
            txt = (ch.text or "").strip()
            if n == "title":
                rec["title"] = txt
            elif n == "link":
                href = ch.attrib.get("href")
                if href and ch.attrib.get("rel", "alternate") == "alternate":
                    rec["link"] = href
                elif txt and not rec["link"]:
                    rec["link"] = txt
            elif n == "guid" and not rec["link"] and txt.startswith("http"):
                rec["link"] = txt
            elif n in ("description", "summary") and txt:
                rec["desc"] = txt
            elif n in ("encoded", "content") and txt and not rec["desc"]:
                rec["desc"] = txt
            elif n in ("pubdate", "published", "updated", "date", "issued") and not rec["date"]:
                rec["date"] = _parse_date(txt)
        if rec["title"] and rec["link"].startswith(("http://", "https://")):
            out.append(rec)
        if len(out) >= PER_FEED:
            break
    return out


def _enrich(rec: dict, feed: tuple, now: float) -> dict:
    fid, src, _url, base, region, lang = feed
    title = _strip_html(rec["title"], 300)
    summary = _strip_html(rec["desc"], 600)
    if summary.lower() == title.lower():
        summary = ""
    tl = " " + title.lower() + " "
    text = tl + " " + summary.lower() + " "

    # sentiment: title words count double
    score = 2 * (_has(tl, BULL) - _has(tl, BEAR)) + (_has(summary.lower(), BULL) - _has(summary.lower(), BEAR))
    sentiment = "bullish" if score >= 2 else "bearish" if score <= -2 else "neutral"

    # impact
    hi, md = _has(tl, HIGH), _has(text, MED) + _has(text, HIGH)
    impact = "HIGH" if hi else "MED" if md >= 1 or fid in ("fed", "ecb", "boe", "sec") else "LOW"
    breaking = any(w in tl for w in BREAKING)
    if breaking:
        impact = "HIGH"

    # categories
    cats = {base} if base != "KR" else {"KR"}
    for c, words in CAT_KW.items():
        if c != base and _has(text, words):
            cats.add(c)
    if lang == "ko":
        cats.add("KR")
    if base == "KR" and len(cats) == 1:
        cats.add("MKT")

    # tickers
    tags, seen = [], set()
    for m in _CASHTAG.findall(title) + _EXCH_TAG.findall(title + " " + summary):
        if m not in seen:
            seen.add(m)
            tags.append([m, m])
    low = title.lower()
    for k, (sym, label) in _TICKER_ITEMS:
        if sym in seen:
            continue
        hit = _TICKER_RE[k].search(low) if k in _TICKER_RE else (k in low)
        if hit:
            low = low.replace(k, " ")  # '두산에너빌리티' must not also tag '두산'
            seen.add(sym)
            tags.append([sym, label])
        if len(tags) >= 4:
            break

    ts = rec["date"] or now
    if ts > now + 600:  # clocks in the future → clamp
        ts = now
    link = rec["link"].strip()
    return {
        "id": hashlib.md5(link.encode()).hexdigest()[:12],
        "title": title, "link": link, "summary": summary,
        "source": src, "feed": fid, "region": region, "lang": lang,
        "cat": base, "cats": sorted(cats), "ts": int(ts), "dated": not rec.get("undated"),
        "sentiment": sentiment, "score": score, "impact": impact, "breaking": breaking,
        "tickers": tags, "kw": _tokens(title)[:12],
    }


def _fetch_feed(feed: tuple) -> tuple[dict, list[dict]]:
    t0 = time.time()
    try:
        try:
            recs = _parse(_safe_xml(_download(feed[2])))
        except (requests.RequestException, ET.ParseError):  # transient → one retry
            time.sleep(0.5)
            recs = _parse(_safe_xml(_download(feed[2])))
        if not recs:
            raise ValueError("기사 없음")
        now = time.time()
        for i, r in enumerate(recs):  # undated feeds (e.g. Nikkei RDF): keep feed order, place behind fresh news
            if not r["date"]:
                r["date"], r["undated"] = now - 3 * 3600 - i * 60, True
        arts = [_enrich(r, feed, now) for r in recs]
        return {"id": feed[0], "name": feed[1], "cat": feed[3], "lang": feed[5], "ok": True, "count": len(arts),
                "ms": int((time.time() - t0) * 1000)}, arts
    except Exception as e:  # one bad feed must never break the screen
        return {"id": feed[0], "name": feed[1], "cat": feed[3], "lang": feed[5], "ok": False, "count": 0,
                "error": f"{type(e).__name__}: {str(e)[:120]}", "ms": int((time.time() - t0) * 1000)}, []


def _dedupe(arts: list[dict]) -> list[dict]:
    """Drop near-duplicate headlines (Jaccard ≥ 0.75 on title tokens); keep the newest, count dupes."""
    arts.sort(key=lambda a: -a["ts"])
    kept, index = [], {}
    seen_links = set()
    for a in arts:
        if a["link"] in seen_links:
            continue
        toks = set(a["kw"]) or set(a["title"].lower().split())
        cands = set()
        for t in toks:
            cands.update(index.get(t, ()))
        dup = None
        for i in cands:
            other = kept[i]
            ot = other["_t"]
            j = len(toks & ot) / max(1, len(toks | ot))
            if j >= 0.75:
                dup = other
                break
        if dup is not None:
            dup["dups"] = dup.get("dups", 0) + 1
            if a["source"] not in dup["also"]:
                dup["also"].append(a["source"])
            continue
        a["_t"] = toks
        a["also"] = []
        seen_links.add(a["link"])
        for t in toks:
            index.setdefault(t, []).append(len(kept))
        kept.append(a)
    for a in kept:
        a.pop("_t", None)
    return kept


def _aggregate() -> dict:
    now = time.time()
    feeds, arts = [], []
    ex = ThreadPoolExecutor(max_workers=16)
    futs = {ex.submit(_fetch_feed, f): f for f in FEEDS}
    try:
        for fut in as_completed(futs, timeout=25):
            info, items = fut.result()
            feeds.append(info)
            arts.extend(items)
    except Exception:  # overall timeout — report the stragglers as failed
        done = {f["id"] for f in feeds}
        for f in FEEDS:
            if f[0] not in done:
                feeds.append({"id": f[0], "name": f[1], "cat": f[3], "lang": f[5], "ok": False, "count": 0,
                              "error": "시간 초과", "ms": 25000})
    finally:
        ex.shutdown(wait=False, cancel_futures=True)
    arts = [a for a in arts if now - a["ts"] <= MAX_AGE]
    arts = _dedupe(arts)[:1500]
    order = {f[0]: i for i, f in enumerate(FEEDS)}
    feeds.sort(key=lambda f: order.get(f["id"], 999))
    flash = next((a for a in arts if a["impact"] == "HIGH" and now - a["ts"] < 6 * 3600), None)
    return {"articles": arts, "feeds": feeds, "fetched_at": int(now), "flash": flash["id"] if flash else None}


_lock = threading.Lock()
_state: dict = {"t": 0.0, "data": None, "busy": False}


def _refresh() -> None:
    try:
        data = clean(_aggregate())
        with _lock:
            _state["data"], _state["t"], _state["busy"] = data, time.time(), False
    finally:
        _state["busy"] = False


def _refresh_bg() -> None:
    if not _state["busy"]:
        _state["busy"] = True
        def run():
            try:
                _refresh()
            except Exception:  # noqa: BLE001 — background warm-up must never crash the server
                pass
        threading.Thread(target=run, daemon=True, name="news-refresh").start()


def feed(q, body):
    """GET /api/news/feed[?refresh=1] — aggregated articles. Cached 5 min; when stale the old copy is
    served while a background refresh runs (refresh=1 forces a synchronous reload if older than 60 s)."""
    force = q.get("refresh") in ("1", "true")
    age = time.time() - _state["t"]
    if _state["data"] is None and _state["busy"]:  # warm-up already running → wait for it
        for _ in range(150):
            if _state["data"] is not None:
                break
            time.sleep(0.2)
    if _state["data"] is None or (force and age > 60 and not _state["busy"]):
        _state["busy"] = True
        _refresh()
    elif age > TTL:
        _refresh_bg()
    data = _state["data"]
    return {**data, "cache_age": int(time.time() - _state["t"]), "ttl": TTL, "refreshing": _state["busy"]}


def sources(q, body):
    """GET /api/news/sources — configured feed list."""
    return {"feeds": [{"id": f[0], "name": f[1], "url": f[2], "cat": f[3], "region": f[4], "lang": f[5]} for f in FEEDS]}


def article(q, body):
    """GET /api/news/article?id=… — one article from the current cache."""
    aid = (q.get("id") or "").strip()
    if not re.fullmatch(r"[0-9a-f]{12}", aid):
        raise BadRequest("기사 ID 형식이 올바르지 않습니다.")
    data = _state["data"] or feed({}, {})
    for a in data["articles"]:
        if a["id"] == aid:
            return a
    raise BadRequest("해당 기사를 찾을 수 없습니다 (캐시가 갱신되었을 수 있어요).")


ROUTES = {
    ("GET", "/api/news/feed"): feed,
    ("GET", "/api/news/sources"): sources,
    ("GET", "/api/news/article"): article,
}

# Warm the cache when the server starts so the first visit is instant.
_refresh_bg()

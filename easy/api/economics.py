"""Economics screen (경제): World Bank country comparison & snapshot, US Treasury yield
curve, IMF WEO forecasts, ECB rates, OECD composite leading indicators and DBnomics search.

Sources (all keyless):
  * World Bank      — Fincept ``worldbank_data.get_indicators``
  * US Treasury     — Fincept ``federal_reserve_data`` (Fed H.15 CSV, NY Fed EFFR) with
                      treasury.gov daily par-yield CSV and yfinance (^IRX ^FVX ^TNX ^TYX)
                      as fallbacks; Fincept ``treasury_data.get_debt_to_penny``
  * IMF DataMapper  — Fincept ``imf_datamapper_data``
  * ECB             — Fincept ``ecb_sdmx_data`` request/parse helpers (SDMX REST)
  * OECD            — SDMX REST CSV (DF_CLI composite leading indicators)
  * DBnomics        — api.db.nomics.world v22
"""

from __future__ import annotations

import csv
import io
import re
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta

import pandas as pd
import requests

from api.common import muted, BadRequest, cached, clean, num, quiet

import ecb_sdmx_data as ecb  # noqa: E402  (Fincept scripts)
import federal_reserve_data as fed  # noqa: E402
import imf_datamapper_data as imf  # noqa: E402
import treasury_data as tsy  # noqa: E402
import worldbank_data as wb  # noqa: E402

NET_TIMEOUT = 25
UA = {"User-Agent": "Mozilla/5.0 (FinceptTerminalEasy)"}

# ISO3, ISO2 (World Bank id), Korean name
COUNTRIES = [
    ("KOR", "KR", "한국"), ("USA", "US", "미국"), ("JPN", "JP", "일본"), ("CHN", "CN", "중국"), ("DEU", "DE", "독일"),
    ("GBR", "GB", "영국"), ("FRA", "FR", "프랑스"), ("ITA", "IT", "이탈리아"), ("CAN", "CA", "캐나다"), ("AUS", "AU", "호주"),
    ("IND", "IN", "인도"), ("BRA", "BR", "브라질"), ("RUS", "RU", "러시아"), ("MEX", "MX", "멕시코"), ("IDN", "ID", "인도네시아"),
    ("TUR", "TR", "튀르키예"), ("SAU", "SA", "사우디아라비아"), ("ARG", "AR", "아르헨티나"), ("ZAF", "ZA", "남아프리카공화국"),
    ("ESP", "ES", "스페인"), ("NLD", "NL", "네덜란드"), ("CHE", "CH", "스위스"), ("SWE", "SE", "스웨덴"), ("NOR", "NO", "노르웨이"),
    ("POL", "PL", "폴란드"), ("SGP", "SG", "싱가포르"), ("HKG", "HK", "홍콩"), ("TWN", "TW", "대만"), ("VNM", "VN", "베트남"),
    ("THA", "TH", "태국"), ("MYS", "MY", "말레이시아"), ("PHL", "PH", "필리핀"), ("ISR", "IL", "이스라엘"), ("ARE", "AE", "아랍에미리트"),
    ("NZL", "NZ", "뉴질랜드"), ("IRL", "IE", "아일랜드"), ("GRC", "GR", "그리스"), ("PRT", "PT", "포르투갈"), ("EGY", "EG", "이집트"),
    ("NGA", "NG", "나이지리아"), ("CHL", "CL", "칠레"), ("COL", "CO", "콜롬비아"), ("BEL", "BE", "벨기에"), ("AUT", "AT", "오스트리아"),
    ("DNK", "DK", "덴마크"), ("FIN", "FI", "핀란드"), ("CZE", "CZ", "체코"), ("HUN", "HU", "헝가리"), ("PAK", "PK", "파키스탄"),
    ("BGD", "BD", "방글라데시"), ("KAZ", "KZ", "카자흐스탄"), ("UKR", "UA", "우크라이나"), ("PER", "PE", "페루"),
]
WB_AGG = [("WLD", "1W", "전 세계"), ("EUU", "EU", "유럽연합"), ("OED", "OE", "OECD 회원국"), ("EAS", "Z4", "동아시아·태평양"),
          ("HIC", "XD", "고소득국"), ("LMY", "XO", "중·저소득국")]
IMF_AGG = [("WEOWORLD", "전 세계"), ("ADVEC", "선진국"), ("OEMDC", "신흥·개도국"), ("EURO", "유로존"), ("EU", "유럽연합"),
           ("DA", "아시아 신흥국")]
KO = {c[0]: c[2] for c in COUNTRIES} | {a[0]: a[2] for a in WB_AGG} | {a[0]: a[1] for a in IMF_AGG}
ISO2_TO_3 = {c[1]: c[0] for c in COUNTRIES} | {a[1]: a[0] for a in WB_AGG}
WB_CODES = {c[0] for c in COUNTRIES if c[0] != "TWN"} | {a[0] for a in WB_AGG}
IMF_CODES = {c[0] for c in COUNTRIES} | {a[0] for a in IMF_AGG}

# World Bank indicators: code -> (Korean label, unit, kind) ; kind: pct | usd | num
WB_IND = {
    "NY.GDP.MKTP.KD.ZG": ("GDP 성장률", "%", "pct"),
    "NY.GDP.PCAP.CD": ("1인당 GDP", "US$", "usd"),
    "NY.GDP.MKTP.CD": ("GDP (명목)", "US$", "usd"),
    "FP.CPI.TOTL.ZG": ("물가상승률 (CPI)", "%", "pct"),
    "SL.UEM.TOTL.ZS": ("실업률", "%", "pct"),
    "GC.DOD.TOTL.GD.ZS": ("중앙정부 부채", "% of GDP", "pct"),
    "BN.CAB.XOKA.GD.ZS": ("경상수지", "% of GDP", "pct"),
    "NE.EXP.GNFS.ZS": ("수출 비중", "% of GDP", "pct"),
    "NE.TRD.GNFS.ZS": ("무역 의존도", "% of GDP", "pct"),
    "BX.KLT.DINV.WD.GD.ZS": ("외국인직접투자 순유입", "% of GDP", "pct"),
    "NE.GDI.TOTL.ZS": ("총투자율", "% of GDP", "pct"),
    "NY.GNS.ICTR.ZS": ("총저축률", "% of GDP", "pct"),
    "NV.IND.MANF.ZS": ("제조업 비중", "% of GDP", "pct"),
    "GC.TAX.TOTL.GD.ZS": ("조세 수입", "% of GDP", "pct"),
    "GB.XPD.RSDV.GD.ZS": ("R&D 지출", "% of GDP", "pct"),
    "FR.INR.RINR": ("실질금리", "%", "pct"),
    "FR.INR.LEND": ("대출금리", "%", "pct"),
    "FM.LBL.BMNY.ZG": ("광의통화(M2) 증가율", "%", "pct"),
    "PA.NUS.FCRF": ("공식 환율", "현지통화/US$", "num"),
    "SP.POP.TOTL": ("인구", "명", "num"),
    "SP.POP.GROW": ("인구 증가율", "%", "pct"),
    "SP.POP.65UP.TO.ZS": ("65세 이상 인구 비율", "%", "pct"),
    "SP.DYN.TFRT.IN": ("합계출산율", "명/여성", "num"),
    "SP.DYN.LE00.IN": ("기대수명", "세", "num"),
    "SI.POV.GINI": ("지니계수", "0~100", "num"),
}
SNAPSHOT_IND = ["NY.GDP.MKTP.CD", "NY.GDP.MKTP.KD.ZG", "NY.GDP.PCAP.CD", "FP.CPI.TOTL.ZG", "SL.UEM.TOTL.ZS",
                "GC.DOD.TOTL.GD.ZS", "BN.CAB.XOKA.GD.ZS", "NE.EXP.GNFS.ZS", "FR.INR.RINR", "PA.NUS.FCRF",
                "SP.POP.TOTL", "SP.POP.65UP.TO.ZS", "SP.DYN.TFRT.IN", "SP.DYN.LE00.IN", "GB.XPD.RSDV.GD.ZS",
                "NE.GDI.TOTL.ZS"]

IMF_IND = {
    "NGDP_RPCH": ("실질 GDP 성장률", "%"),
    "PCPIPCH": ("물가상승률 (평균 CPI)", "%"),
    "LUR": ("실업률", "%"),
    "GGXWDG_NGDP": ("정부 총부채", "% of GDP"),
    "GGXCNL_NGDP": ("재정수지", "% of GDP"),
    "BCA_NGDPD": ("경상수지", "% of GDP"),
    "NGDPDPC": ("1인당 GDP", "US$"),
    "NGDPD": ("GDP (명목)", "십억 US$"),
    "PPPSH": ("세계 GDP 비중 (PPP)", "%"),
}


def _codes(raw, allowed: set, lo=1, hi=10) -> list[str]:
    items = [s.strip().upper() for s in re.split(r"[,;\s]+", str(raw or "")) if s.strip()]
    out = []
    for s in items:
        if s not in allowed:
            raise BadRequest(f"지원하지 않는 국가 코드입니다: {s[:12]}")
        if s not in out:
            out.append(s)
    if not lo <= len(out) <= hi:
        raise BadRequest(f"국가를 {lo}~{hi}개 선택하세요.")
    return out


# --------------------------------------------------------------------------- #
# World Bank
# --------------------------------------------------------------------------- #
@cached(6 * 3600)
def _wb(countries: str, indicator: str, years: int) -> dict:
    now = date.today().year
    # called directly, not via quiet(): this also runs in worker threads (redirect_stdout is
    # process-global) and get_indicators never prints
    res = wb.get_indicators(countries, indicator, f"{now - years}:{now}", 5000)
    if res.get("error"):
        raise BadRequest(f"세계은행 API 오류: {str(res['error'])[:160]}")
    series: dict[str, dict] = {}
    for row in res.get("data") or []:
        if row.get("value") is None:
            continue
        iso3 = ISO2_TO_3.get(row.get("country_id"), row.get("country_id"))
        s = series.setdefault(iso3, {"id": iso3, "name": KO.get(iso3, row.get("country_name")), "points": {}})
        s["points"][int(row["date"])] = float(row["value"])
    return {"series": series, "updated": (res.get("metadata") or {}).get("last_updated")}


def _wb_meta(code):
    if code not in WB_IND:
        raise BadRequest("지원하지 않는 세계은행 지표입니다.")
    label, unit, kind = WB_IND[code]
    return {"code": code, "label": label, "unit": unit, "kind": kind}


def wb_compare(q: dict, body: dict) -> dict:
    ind = q.get("indicator") or "NY.GDP.MKTP.KD.ZG"
    meta = _wb_meta(ind)
    ctry = _codes(q.get("countries") or "KOR,USA,JPN,CHN,DEU", WB_CODES, 1, 10)
    years = int(num(q.get("years"), "기간", 5, 60, default=20))
    data = _wb(";".join(ctry), ind, years)
    out, table = [], []
    for c in ctry:
        s = data["series"].get(c)
        if not s or not s["points"]:
            table.append({"id": c, "name": KO.get(c, c), "latest": None})
            continue
        pts = sorted(s["points"].items())
        ys, vs = [p[0] for p in pts], [p[1] for p in pts]
        out.append({"id": c, "name": s["name"], "years": ys, "values": vs})
        last5 = [v for y, v in pts if y > ys[-1] - 5]
        prev = pts[-2][1] if len(pts) > 1 else None
        table.append({"id": c, "name": s["name"], "latest": vs[-1], "year": ys[-1], "prev": prev,
                      "chg": vs[-1] - prev if prev is not None else None,
                      "avg5": sum(last5) / len(last5), "min": min(vs), "max": max(vs),
                      "min_year": ys[vs.index(min(vs))], "max_year": ys[vs.index(max(vs))], "spark": vs[-15:]})
    if not out:
        raise BadRequest("선택한 국가에 대한 데이터가 없습니다. 다른 지표나 국가를 선택하세요.")
    ranked = sorted([t for t in table if t.get("latest") is not None], key=lambda t: -t["latest"])
    for i, t in enumerate(ranked, 1):
        t["rank"] = i
    return clean({"indicator": meta, "series": out, "table": table, "updated": data["updated"],
                  "source": "World Bank WDI (worldbank_data.py)"})


def _imf_country(code: str, ind: str) -> dict:
    try:
        return _imf_all(ind).get(code, {})
    except Exception:
        return {}


def wb_snapshot(q: dict, body: dict) -> dict:
    c = _codes(q.get("country") or "KOR", WB_CODES | {"TWN"}, 1, 1)[0]
    cards = []
    if c in WB_CODES:
        def one(ind):
            try:
                return ind, _wb(c, ind, 30)["series"].get(c)
            except BadRequest:
                return ind, None

        with ThreadPoolExecutor(len(SNAPSHOT_IND)) as ex:
            res = dict(ex.map(one, SNAPSHOT_IND))
        for ind in SNAPSHOT_IND:
            m = _wb_meta(ind)
            s = res.get(ind)
            pts = sorted(s["points"].items()) if s else []
            cards.append({**m, "years": [p[0] for p in pts], "values": [p[1] for p in pts],
                          "latest": pts[-1][1] if pts else None, "year": pts[-1][0] if pts else None,
                          "prev": pts[-2][1] if len(pts) > 1 else None})
    # IMF WEO outlook for the same country
    now = date.today().year
    outlook = []
    for ind in ("NGDP_RPCH", "PCPIPCH", "LUR", "GGXWDG_NGDP", "BCA_NGDPD", "GGXCNL_NGDP"):
        vals = _imf_country(c, ind)
        if vals:
            outlook.append({"code": ind, "label": IMF_IND[ind][0], "unit": IMF_IND[ind][1],
                            "years": list(range(now - 4, now + 3)),
                            "values": [vals.get(str(y)) for y in range(now - 4, now + 3)]})
    if not cards and not outlook:
        raise BadRequest("이 국가의 데이터를 가져오지 못했습니다.")
    return clean({"country": c, "name": KO.get(c, c), "cards": cards, "outlook": outlook, "this_year": now,
                  "note": "대만은 세계은행 회원국이 아니어서 IMF 전망만 표시합니다." if c == "TWN" else None})


# --------------------------------------------------------------------------- #
# IMF DataMapper (WEO)
# --------------------------------------------------------------------------- #
@cached(12 * 3600)
def _imf_all(ind: str) -> dict:
    res = quiet(imf.get_indicator_data, ind)
    if not isinstance(res, dict) or res.get("error"):
        raise BadRequest(f"IMF DataMapper 오류: {str((res or {}).get('error'))[:160]}")
    return (res.get("values") or {}).get(ind) or {}


@cached(24 * 3600)
def _imf_meta() -> dict:
    res = quiet(imf.get_indicators)
    return (res or {}).get("indicators") or {} if isinstance(res, dict) else {}


def imf_outlook(q: dict, body: dict) -> dict:
    ind = q.get("indicator") or "NGDP_RPCH"
    if ind not in IMF_IND:
        raise BadRequest("지원하지 않는 IMF 지표입니다.")
    ctry = _codes(q.get("countries") or "KOR,USA,JPN,CHN,DEU,WEOWORLD", IMF_CODES, 1, 10)
    start = int(num(q.get("start"), "시작 연도", 1980, 2030, default=2010))
    allv = _imf_all(ind)
    now = date.today().year
    meta = _imf_meta().get(ind, {})
    series = []
    for c in ctry:
        vals = allv.get(c) or {}
        ys = sorted(int(y) for y in vals if int(y) >= start)
        if not ys:
            continue
        series.append({"id": c, "name": KO.get(c, c), "years": ys, "values": [vals[str(y)] for y in ys]})
    if not series:
        raise BadRequest("선택한 국가에 대한 IMF 데이터가 없습니다.")
    cols = list(range(now - 3, now + 4))
    table = [{"id": s["id"], "name": s["name"], **{str(y): (allv.get(s["id"]) or {}).get(str(y)) for y in cols}} for s in series]
    return clean({"indicator": {"code": ind, "label": IMF_IND[ind][0], "unit": IMF_IND[ind][1],
                                "en": meta.get("label"), "desc": meta.get("description")},
                  "source": meta.get("source") or "IMF World Economic Outlook", "updated": meta.get("last-modified"),
                  "series": series, "table": table, "cols": cols, "forecast_from": now})


# --------------------------------------------------------------------------- #
# US Treasury yields
# --------------------------------------------------------------------------- #
MATS = ["month_1", "month_3", "month_6", "year_1", "year_2", "year_3", "year_5", "year_7", "year_10", "year_20", "year_30"]
MAT_LABELS = ["1M", "3M", "6M", "1Y", "2Y", "3Y", "5Y", "7Y", "10Y", "20Y", "30Y"]
MAT_YEARS = [1 / 12, 0.25, 0.5, 1, 2, 3, 5, 7, 10, 20, 30]


def _treasury_gov() -> pd.DataFrame:
    """Fallback: treasury.gov daily par yield curve CSV (this + last year), in percent."""
    frames = []
    cols = {"1 Mo": "month_1", "3 Mo": "month_3", "6 Mo": "month_6", "1 Yr": "year_1", "2 Yr": "year_2", "3 Yr": "year_3",
            "5 Yr": "year_5", "7 Yr": "year_7", "10 Yr": "year_10", "20 Yr": "year_20", "30 Yr": "year_30"}
    y = date.today().year
    for yr in (y - 1, y):
        url = ("https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/"
               f"{yr}/all?type=daily_treasury_yield_curve&field_tdr_date_value={yr}&page&_format=csv")
        r = requests.get(url, timeout=NET_TIMEOUT, headers=UA)
        r.raise_for_status()
        df = pd.read_csv(io.StringIO(r.text))
        df["date"] = pd.to_datetime(df["Date"], format="%m/%d/%Y")
        frames.append(df.rename(columns=cols)[["date"] + [c for c in cols.values() if c in df.rename(columns=cols)]])
    df = pd.concat(frames).set_index("date").sort_index()
    return df.apply(pd.to_numeric, errors="coerce")


def _yahoo_yields() -> pd.DataFrame:
    import contextlib

    import yfinance as yf

    m = {"^IRX": "month_3", "^FVX": "year_5", "^TNX": "year_10", "^TYX": "year_30"}
    with muted():
        d = yf.download(list(m), period="2y", progress=False, timeout=15)["Close"]
    d.index = pd.to_datetime(d.index).tz_localize(None) if getattr(d.index, "tz", None) else pd.to_datetime(d.index)
    d = d.rename(columns=m)
    for c in MATS:
        if c not in d:
            d[c] = float("nan")
    return d[MATS]


@cached(6 * 3600)
def _yields() -> tuple:
    """(DataFrame in percent indexed by date, source label)."""
    try:
        res = quiet(fed.FederalReserveWrapper().get_treasury_rates, "1990-01-01")
        if res.get("data"):
            df = pd.DataFrame(res["data"])
            df["date"] = pd.to_datetime(df["date"])
            df = df.set_index("date").sort_index()[MATS].apply(pd.to_numeric, errors="coerce") * 100
            return df.dropna(how="all"), "Federal Reserve H.15 (federal_reserve_data.py)"
    except Exception:
        pass
    try:
        return _treasury_gov().dropna(how="all"), "U.S. Treasury 일일 국채 수익률 곡선 (treasury.gov)"
    except Exception:
        pass
    return _yahoo_yields().dropna(how="all"), "Yahoo Finance (^IRX ^FVX ^TNX ^TYX — 4개 만기만)"


@cached(6 * 3600)
def _effr(start: str) -> list:
    try:
        res = quiet(fed.FederalReserveWrapper().get_federal_funds_rate, start)
        return [(r["date"], r["rate"] * 100 if r.get("rate") is not None else None,
                 r["target_range_lower"] * 100 if r.get("target_range_lower") is not None else None,
                 r["target_range_upper"] * 100 if r.get("target_range_upper") is not None else None)
                for r in sorted(res.get("data") or [], key=lambda x: x["date"])]
    except Exception:
        return []


@cached(6 * 3600)
def _debt() -> list:
    start = (date.today() - timedelta(days=365 * 3)).isoformat()
    res = quiet(tsy.get_debt_to_penny, start_date=start)
    rows = res.get("data") if isinstance(res, dict) else None
    out = []
    for r in rows or []:
        try:
            out.append((r["record_date"], float(r["tot_pub_debt_out_amt"]), float(r["debt_held_public_amt"])))
        except (KeyError, TypeError, ValueError):
            continue
    return sorted(out)


def yields(q: dict, body: dict) -> dict:
    years = int(num(q.get("years"), "기간", 1, 36, default=5))
    df, source = _yields()
    if df.empty:
        raise BadRequest("미국 국채 금리를 가져오지 못했습니다.")
    last_d = df.index[-1]

    def asof(days):
        sub = df[df.index <= last_d - pd.Timedelta(days=days)]
        if sub.empty:
            return None
        row = sub.iloc[-1]
        return {"date": sub.index[-1].strftime("%Y-%m-%d"), "values": [None if pd.isna(row[m]) else float(row[m]) for m in MATS]}

    curves = {k: asof(d) for k, d in (("now", 0), ("w1", 7), ("m1", 30), ("m6", 182), ("y1", 365), ("y2", 730))}
    win = df[df.index >= last_d - pd.Timedelta(days=int(365.25 * years))]
    h = pd.DataFrame({"y2": win["year_2"], "y10": win["year_10"], "m3": win["month_3"], "y30": win["year_30"]}).dropna(subset=["y10"])
    h["s10_2"] = h["y10"] - h["y2"]
    h["s10_3m"] = h["y10"] - h["m3"]
    step = max(1, len(h) // 1500)
    hs = h.iloc[::step]
    s = h["s10_2"].dropna()
    inv = s < 0
    # most recent inversion episode
    last_inv_end = None
    if inv.any():
        idx = inv[inv].index[-1]
        last_inv_end = idx.strftime("%Y-%m-%d")
    run = 0
    for v in reversed(inv.tolist()):
        if v == inv.iloc[-1]:
            run += 1
        else:
            break
    effr = _effr(max(win.index[0].strftime("%Y-%m-%d"), "2016-03-01"))
    try:
        debt = _debt()
    except Exception:
        debt = []
    return clean({
        "source": source, "asof": last_d.strftime("%Y-%m-%d"), "labels": MAT_LABELS, "mat_years": MAT_YEARS, "curves": curves,
        "history": {"dates": [d.strftime("%Y-%m-%d") for d in hs.index], "y2": hs["y2"].tolist(), "y10": hs["y10"].tolist(),
                    "m3": hs["m3"].tolist(), "y30": hs["y30"].tolist(), "s10_2": hs["s10_2"].tolist(), "s10_3m": hs["s10_3m"].tolist()},
        "spread_now": float(s.iloc[-1]) if len(s) else None,
        "spread3m_now": float(h["s10_3m"].dropna().iloc[-1]) if h["s10_3m"].notna().any() else None,
        "inverted_now": bool(inv.iloc[-1]) if len(inv) else None, "run_days": run,
        "inverted_share": float(inv.mean()) if len(inv) else None, "last_inversion": last_inv_end,
        "effr": {"dates": [e[0] for e in effr], "rate": [e[1] for e in effr], "lo": [e[2] for e in effr], "hi": [e[3] for e in effr]},
        "debt": {"dates": [d[0] for d in debt], "total": [d[1] for d in debt], "public": [d[2] for d in debt]},
    })


# --------------------------------------------------------------------------- #
# ECB (Fincept ecb_sdmx_data helpers with corrected series keys)
# --------------------------------------------------------------------------- #
def _ecb(key: str, **params) -> list:
    data = ecb._make_request(key, params={"format": "jsondata", "detail": "dataonly", **params})
    if isinstance(data, dict) and data.get("error"):
        raise BadRequest(f"ECB API 오류: {str(data['error'])[:140]}")
    parsed = ecb._parse_sdmx_json(data)
    if parsed.get("error"):
        raise BadRequest(f"ECB 데이터 해석 오류: {parsed['error'][:140]}")
    out = []
    for s in parsed.get("series", []):
        obs = sorted((o["period"], o["value"]) for o in s["observations"] if o["value"] is not None)
        out.append({"dims": s["dimensions"], "dates": [o[0] for o in obs], "values": [o[1] for o in obs]})
    return out


ECB_MATS = ["3M", "6M", "1Y", "2Y", "3Y", "5Y", "7Y", "10Y", "15Y", "20Y", "30Y"]


@cached(6 * 3600)
def _ecb_all() -> dict:
    jobs = {
        "rates": lambda: _ecb("FM/B.U2.EUR.4F.KR.DFR+MRR_FR+MLFR.LEV", startPeriod="2008-01-01"),
        "yc": lambda: _ecb("YC/B.U2.EUR.4F.G_N_A.SV_C_YM." + "+".join("SR_" + m for m in ECB_MATS), lastNObservations=270),
        "hicp": lambda: _ecb("ICP/M.U2+DE+FR+IT+ES.N.000000.4.ANR", startPeriod="2015-01"),
        "fx": lambda: _ecb("EXR/D.USD+KRW+JPY+GBP+CNY.EUR.SP00.A", lastNObservations=260),
    }
    out = {}
    with ThreadPoolExecutor(4) as ex:
        futs = {k: ex.submit(f) for k, f in jobs.items()}
        for k, f in futs.items():
            try:
                out[k] = f.result()
            except Exception as e:
                out[k] = {"error": str(e)[:200]}
    return out


def ecb_view(q: dict, body: dict) -> dict:
    d = _ecb_all()
    res = {"source": "ECB Data Portal SDMX (ecb_sdmx_data.py)"}
    names = {"DFR": "예금금리 (DFR)", "MRR_FR": "기준금리 (MRO)", "MLFR": "한계대출금리 (MLF)"}
    if isinstance(d.get("rates"), list):
        res["rates"] = [{"id": s["dims"].get("PROVIDER_FM_ID"), "name": names.get(s["dims"].get("PROVIDER_FM_ID"), ""),
                         "dates": s["dates"], "values": s["values"]} for s in d["rates"]]
    if isinstance(d.get("yc"), list) and d["yc"]:
        by = {s["dims"].get("DATA_TYPE_FM", "").replace("SR_", ""): s for s in d["yc"]}
        any_s = next(iter(by.values()))
        last = any_s["dates"][-1]
        target = (datetime.strptime(last, "%Y-%m-%d") - timedelta(days=365)).strftime("%Y-%m-%d")

        def at(s, dt):
            vals = [(dd, v) for dd, v in zip(s["dates"], s["values"]) if dd <= dt]
            return vals[-1] if vals else (None, None)

        res["yc"] = {"labels": ECB_MATS, "now": [at(by[m], last)[1] if m in by else None for m in ECB_MATS],
                     "ago": [at(by[m], target)[1] if m in by else None for m in ECB_MATS],
                     "date": last, "ago_date": at(any_s, target)[0]}
    hn = {"U2": "유로존", "DE": "독일", "FR": "프랑스", "IT": "이탈리아", "ES": "스페인"}
    if isinstance(d.get("hicp"), list):
        res["hicp"] = [{"id": s["dims"].get("REF_AREA"), "name": hn.get(s["dims"].get("REF_AREA"), ""), "dates": s["dates"], "values": s["values"]}
                       for s in d["hicp"]]
    if isinstance(d.get("fx"), list):
        res["fx"] = [{"id": s["dims"].get("CURRENCY"), "dates": s["dates"], "values": s["values"]} for s in d["fx"]]
    res["errors"] = {k: v["error"] for k, v in d.items() if isinstance(v, dict) and v.get("error")}
    if not any(k in res for k in ("rates", "yc", "hicp", "fx")):
        raise BadRequest("ECB 데이터를 가져오지 못했습니다.")
    return clean(res)


# --------------------------------------------------------------------------- #
# OECD composite leading indicators
# --------------------------------------------------------------------------- #
OECD_CLI = {c: KO[c] for c in ("KOR", "USA", "JPN", "CHN", "DEU", "GBR", "FRA", "ITA", "CAN", "AUS", "IND", "BRA",
                               "MEX", "IDN", "TUR", "ESP", "ZAF")} | {"G20": "G20", "G7": "G7"}


@cached(12 * 3600)
def _cli(codes: str, start: str) -> dict:
    url = ("https://sdmx.oecd.org/public/rest/data/OECD.SDD.STES,DSD_STES@DF_CLI,4.1/"
           f"{codes}.M.LI...AA...H?startPeriod={start}&dimensionAtObservation=AllDimensions&format=csvfile")
    r = requests.get(url, timeout=NET_TIMEOUT, headers=UA)
    if r.status_code == 404:
        raise BadRequest("OECD 경기선행지수 데이터가 없습니다.")
    r.raise_for_status()
    out: dict[str, dict] = {}
    for row in csv.DictReader(io.StringIO(r.text)):
        try:
            out.setdefault(row["REF_AREA"], {})[row["TIME_PERIOD"]] = float(row["OBS_VALUE"])
        except (KeyError, ValueError):
            continue
    return out


def oecd_cli(q: dict, body: dict) -> dict:
    ctry = _codes(q.get("countries") or "KOR,USA,CHN,DEU,JPN", set(OECD_CLI), 1, 8)
    years = int(num(q.get("years"), "기간", 2, 30, default=10))
    start = f"{date.today().year - years}-01"
    try:
        data = _cli("+".join(sorted(ctry)), start)
    except requests.RequestException as e:
        raise BadRequest(f"OECD API 연결 실패: {str(e)[:120]}")
    series, table = [], []
    for c in ctry:
        pts = sorted((data.get(c) or {}).items())
        if not pts:
            continue
        ds, vs = [p[0] for p in pts], [p[1] for p in pts]
        series.append({"id": c, "name": OECD_CLI[c], "dates": ds, "values": vs})
        m1 = vs[-1] - vs[-2] if len(vs) > 1 else None
        phase = None
        if m1 is not None:
            phase = ("확장" if m1 > 0 else "둔화") if vs[-1] >= 100 else ("회복" if m1 > 0 else "수축")
        table.append({"id": c, "name": OECD_CLI[c], "date": ds[-1], "value": vs[-1], "m1": m1,
                      "m6": vs[-1] - vs[-7] if len(vs) > 6 else None, "phase": phase, "spark": vs[-24:]})
    if not series:
        raise BadRequest("선택한 국가의 OECD 경기선행지수가 없습니다.")
    return clean({"series": series, "table": table, "source": "OECD Composite Leading Indicators (SDMX DF_CLI, 진폭 조정)"})


# --------------------------------------------------------------------------- #
# DBnomics
# --------------------------------------------------------------------------- #
DBN = "https://api.db.nomics.world/v22"
DBN_ID = re.compile(r"^[A-Za-z0-9_.@:\-+~ ]{1,160}$")


def _dbn_get(path: str, params: dict) -> dict:
    try:
        r = requests.get(f"{DBN}/{path}", params=params, timeout=NET_TIMEOUT, headers=UA)
    except requests.RequestException as e:
        raise BadRequest(f"DBnomics 연결 실패: {str(e)[:120]}")
    if r.status_code == 404:
        raise BadRequest("DBnomics에서 해당 항목을 찾지 못했습니다.")
    if r.status_code >= 400:
        raise BadRequest(f"DBnomics 오류 (HTTP {r.status_code})")
    return r.json()


def _q(q):
    s = str(q.get("q") or "").strip()
    if len(s) > 80:
        raise BadRequest("검색어는 80자 이하로 입력하세요.")
    return s


@cached(3600)
def _dbn_search(s: str) -> list:
    d = _dbn_get("search", {"q": s, "limit": 20})
    return [{"provider": x.get("provider_code"), "dataset": x.get("code"), "name": x.get("name"),
             "matching": x.get("nb_matching_series"), "total": x.get("nb_series")}
            for x in ((d.get("results") or {}).get("docs") or [])]


def dbn_search(q: dict, body: dict) -> dict:
    s = _q(q)
    if len(s) < 2:
        raise BadRequest("검색어를 2자 이상 입력하세요 (영문 권장: korea gdp, japan cpi …).")
    return clean({"q": s, "datasets": _dbn_search(s)})


@cached(3600)
def _dbn_series_list(prov: str, ds: str, s: str) -> dict:
    params = {"limit": 50, "observations": 0}
    if s:
        params["q"] = s
    d = _dbn_get(f"series/{prov}/{ds}", params)
    sr = d.get("series") or {}
    return {"dataset": (d.get("dataset") or {}).get("name"), "found": sr.get("num_found"),
            "series": [{"code": x.get("series_code"), "name": x.get("series_name")} for x in sr.get("docs") or []]}


def dbn_series(q: dict, body: dict) -> dict:
    prov, ds = str(q.get("provider") or ""), str(q.get("dataset") or "")
    if not DBN_ID.match(prov) or not DBN_ID.match(ds):
        raise BadRequest("제공기관/데이터셋 코드가 올바르지 않습니다.")
    return clean({"provider": prov, "dataset": ds, **_dbn_series_list(prov, ds, _q(q))})


@cached(3600)
def _dbn_data(prov: str, ds: str, code: str) -> dict:
    d = _dbn_get(f"series/{prov}/{ds}/{code}", {"observations": 1})
    docs = (d.get("series") or {}).get("docs") or []
    if not docs:
        raise BadRequest("시계열을 찾지 못했습니다.")
    x = docs[0]
    pts = [(p, v) for p, v in zip(x.get("period") or [], x.get("value") or []) if isinstance(v, (int, float))]
    return {"name": x.get("series_name"), "dataset_name": x.get("dataset_name"), "freq": x.get("@frequency"),
            "dates": [p[0] for p in pts], "values": [p[1] for p in pts], "indexed_at": x.get("indexed_at")}


def dbn_data(q: dict, body: dict) -> dict:
    prov, ds, code = (str(q.get(k) or "") for k in ("provider", "dataset", "series"))
    if not all(DBN_ID.match(v) for v in (prov, ds, code)):
        raise BadRequest("시계열 코드가 올바르지 않습니다.")
    d = _dbn_data(prov, ds, code)
    if not d["values"]:
        raise BadRequest("이 시계열에는 숫자 관측치가 없습니다.")
    return clean({"provider": prov, "dataset": ds, "series": code, **d,
                  "url": f"https://db.nomics.world/{prov}/{ds}/{code}"})


# --------------------------------------------------------------------------- #
def meta(q: dict, body: dict) -> dict:
    return {
        "countries": [{"id": c[0], "name": c[2], "wb": c[0] in WB_CODES} for c in COUNTRIES],
        "wb_aggregates": [{"id": a[0], "name": a[2]} for a in WB_AGG],
        "imf_aggregates": [{"id": a[0], "name": a[1]} for a in IMF_AGG],
        "wb_indicators": [{"code": k, "label": v[0], "unit": v[1]} for k, v in WB_IND.items()],
        "imf_indicators": [{"code": k, "label": v[0], "unit": v[1]} for k, v in IMF_IND.items()],
        "oecd_cli": [{"id": k, "name": v} for k, v in OECD_CLI.items()],
    }


ROUTES = {
    ("GET", "/api/economics/meta"): meta,
    ("GET", "/api/economics/compare"): wb_compare,
    ("GET", "/api/economics/snapshot"): wb_snapshot,
    ("GET", "/api/economics/imf"): imf_outlook,
    ("GET", "/api/economics/yields"): yields,
    ("GET", "/api/economics/ecb"): ecb_view,
    ("GET", "/api/economics/cli"): oecd_cli,
    ("GET", "/api/economics/dbnomics/search"): dbn_search,
    ("GET", "/api/economics/dbnomics/series"): dbn_series,
    ("GET", "/api/economics/dbnomics/data"): dbn_data,
}

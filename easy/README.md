# 🖥️ Extriver Terminal — 한국어 웹 터미널

Extriver Terminal의 웹 버전입니다. [Fincept Terminal](https://github.com/Fincept-Corporation/FinceptTerminal) 데스크톱 앱(C++ / Qt6)의 **디자인(Obsidian 테마)과 화면 구성을 그대로** 브라우저로 옮긴 한국어 웹 터미널입니다.
앱에 들어 있는 Python 데이터 스크립트(`fincept-qt/scripts`)를 그대로 불러와 **API 키·로그인·빌드 없이** 씁니다.
점선 밑줄이 있는 금융 용어에 마우스를 올리면 쉬운 설명이 나옵니다.

## 실행

| 운영체제 | 방법 |
| --- | --- |
| Windows | `easy\run.bat` 더블클릭 |
| macOS / Linux | `sh easy/run.sh` |
| 직접 실행 | `pip install -r easy/requirements.txt` 후 `python easy/server.py --port 8770` |

→ http://127.0.0.1:8770 (Python 3.10 이상)

## 사용법

- 상단 탭 또는 **F1~F10** 단축키로 화면 이동, **Ctrl+K** 로 명령줄
- 명령줄에 종목 코드(`AAPL`, `005930.KS`)나 회사 이름을 치면 종목 리서치가 열립니다
- 명령어: `/fx 100 USD KRW`, `/opt SPY`, `/eco KOR`, `/yc`, `/bond`, `/screen`, `/wl`, `/news`, `/coin`, `/calc`, `/note` …
- 관심종목·포트폴리오·노트·위젯 설정은 이 브라우저에 저장됩니다

## 화면 (16개)

| 탭 | 주요 기능 | 데이터 |
| --- | --- | --- |
| **대시보드** F1 | 글로벌 지수·환율·원자재·채권 금리·크립토, 시세 위젯, 시장 심리(공포·탐욕, VIX, 상승/하락 종목 수), 상승·하락 상위, 섹터 히트맵, 뉴스, 거래소 개장 시간 | yfinance, alternative.me |
| **마켓** F2 | 편집 가능한 시세 패널 9개, 글로벌 히트맵, 섹터 로테이션(1D~1Y 수익률) | yfinance |
| **뉴스** F3 | RSS 40개(국내 9개 포함) 실시간 집계, 카테고리·감성·영향도 분류, $TICKER 태그, 속보 배너, 기사 상세·관련 기사, 북마크 | Fincept 뉴스 화면 피드 목록 |
| **포트폴리오** F4 | 매수·매도·배당 거래 기록, 보유현황·손익(원화/달러 환산), 성과 vs 벤치마크, VaR·CVaR·스트레스 테스트, 최적화(최대 샤프·최소 변동성·위험 균형)와 리밸런싱, 상관관계 | yfinance |
| **백테스트** F5 | 8가지 전략, 매수/매도 표시 차트, 자산곡선·낙폭, 월별 수익, 전략 비교, 파라미터 최적화 히트맵 | yfinance |
| **관심종목** F6 | 여러 목록, 실시간 시세·스파크라인, CSV 가져오기/내보내기 | yfinance |
| **종목 리서치** F7 | 개요(캔들 차트·밸류에이션·애널리스트 목표가), 재무제표, 기술적 분석 13종 + 신호 요약, DCF·상대가치, 동종업체 비교, 애널리스트, 주주, 배당, 뉴스 | yfinance (Fincept `yfinance_data.py`) |
| **크립토** F8 | 시가총액 상위 100, 도미넌스, 공포·탐욕 지수, 트렌딩, 섹터, 코인 상세, 원화 환산 | Fincept `coingecko.py`, `alternative_me_data.py` |
| **파생상품** F9 | 실제 옵션 체인(풋/콜 비율, 맥스 페인, IV 스마일), 옵션 계산기(BSM·이항모형·IV 역산), 전략 빌더 11종, 채권 계산기, VIX 기간구조·선물 곡선 | yfinance, CBOE |
| **경제** F10 | 세계은행 국가 비교·스냅샷, 미국 수익률 곡선·장단기 금리차, IMF 전망, ECB, OECD 경기선행지수, DBnomics 검색 | Fincept `worldbank_data.py`, `imf_datamapper_data.py`, `federal_reserve_data.py` 등 |
| **스크리너** | Yahoo 기본 스크린 19개, 조건 검색(한국 시장 포함) | yfinance |
| **환율** | 환율 계산기(27개 통화), 원화 기준 환율표, 교차 환율 행렬, 차트 | yfinance |
| **퀀트 랩** | 몬테카를로, 수익률 분포, 계절성, CAPM 회귀, 롤링 지표, 페어 분석(공적분), 팩터 노출 | yfinance |
| **예측시장** | Polymarket·Kalshi 이벤트 확률, 가격 추이, 판정 기준 | 공개 API |
| **도구** | 복리·대출·은퇴·CAGR·평단가·세후 수익 계산기, 노트 | 브라우저 |
| **기능 안내** | 데스크톱 앱 화면 51개 한국어 설명 | 소스 코드 분석 |

## 구조

```
easy/
  server.py            HTTP 서버 · 정적 파일 · api/ 모듈 자동 등록
  api/common.py        공용 유틸 (캐시, 입력 검증, 시세, 지표)
  api/<화면>.py        화면별 API (ROUTES)
  static/              index.html · css/fincept.css · js/core.js · js/screens/*.js · vendor/
  DEV_GUIDE.md         화면 추가 규칙
```

## 참고

- 데이터는 Yahoo Finance·CoinGecko·세계은행·IMF 등 공개 소스에서 가져오며 지연되거나 빠질 수 있습니다. 모든 수치는 학습·참고용이며 투자 권유가 아닙니다.
- 서버는 기본적으로 `127.0.0.1`에서만 열립니다. Host 헤더 검사, 다른 출처 POST 차단, iframe 삽입 차단을 합니다. 인증 기능이 없으므로 외부에 공개하지 마세요.
- 가격 색은 원본 앱과 같이 **상승 초록 / 하락 빨강**입니다.
- Fincept Terminal을 베이스로 만든 비공식 프로젝트이며 Fincept Corporation과 관계가 없습니다. 원본의 AGPL-3.0 라이선스를 따릅니다.

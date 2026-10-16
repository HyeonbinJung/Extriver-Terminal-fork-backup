"""
마루 터미널 (MARU Terminal) — 한국어 웹 터미널.

Fincept Terminal 데스크톱 앱(Obsidian 테마)의 화면 구성을 브라우저로 옮기고,
앱에 들어 있는 Python 데이터 스크립트(fincept-qt/scripts)를 그대로 불러와
API 키·로그인 없이 쓸 수 있는 기능을 제공합니다.

구조
  server.py           HTTP 서버 · 정적 파일 · 라우팅
  api/common.py       공용 유틸리티 (캐시, 입력 검증, 시세 데이터, 지표)
  api/<module>.py     화면별 API. 각 모듈은 ROUTES = {("GET", "/api/..."): handler}
  static/             index.html · css/ · js/core.js · js/screens/*.js · vendor/

실행:  python easy/server.py --port 8770
"""

from __future__ import annotations

import argparse
import importlib
import json
import mimetypes
import os
import sys
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

EASY_DIR = Path(__file__).resolve().parent
STATIC_DIR = EASY_DIR / "static"
sys.path.insert(0, str(EASY_DIR))

from api.common import BadRequest  # noqa: E402

ROUTES: dict[tuple[str, str], callable] = {}
MODULES: dict[str, str] = {}  # module name -> "ok" | error message


def load_modules() -> None:
    for path in sorted((EASY_DIR / "api").glob("*.py")):
        name = path.stem
        if name.startswith("_") or name == "common":
            continue
        try:
            mod = importlib.import_module(f"api.{name}")
            routes = getattr(mod, "ROUTES", {})
            for key, fn in routes.items():
                if key in ROUTES:
                    raise RuntimeError(f"duplicate route {key}")
                ROUTES[key] = fn
            MODULES[name] = "ok"
        except Exception as e:  # keep the rest of the terminal alive
            MODULES[name] = f"{type(e).__name__}: {e}"
            print(f"[warn] api.{name} failed to load: {e}", file=sys.stderr)


mimetypes.add_type("text/javascript", ".js")
mimetypes.add_type("text/css", ".css")
mimetypes.add_type("application/json", ".json")


class Handler(BaseHTTPRequestHandler):
    server_version = "MaruTerminal/2.0"
    allowed_hosts: set[str] = set()

    def log_message(self, fmt, *args):
        if os.environ.get("EASY_VERBOSE"):
            super().log_message(fmt, *args)

    def _send(self, status: int, body: bytes, ctype: str, cache: bool = False) -> None:
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "max-age=3600" if cache else "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "no-referrer")
        self.end_headers()
        self.wfile.write(body)

    def _json(self, data, status: int = 200) -> None:
        body = json.dumps(data, ensure_ascii=False, allow_nan=False, default=str).encode("utf-8")
        self._send(status, body, "application/json; charset=utf-8")

    def _static(self, rel: str) -> None:
        target = (STATIC_DIR / rel).resolve()
        if STATIC_DIR not in target.parents or not target.is_file():
            return self._json({"error": "not found"}, 404)
        ctype = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
        if ctype.startswith("text/") or ctype.endswith(("javascript", "json")):
            ctype += "; charset=utf-8"
        self._send(200, target.read_bytes(), ctype, cache="vendor" in target.parts)

    def _handle(self, method: str) -> None:
        if self.headers.get("Host", "") not in self.allowed_hosts:
            return self._json({"error": "invalid host"}, 403)
        url = urlparse(self.path)
        path = url.path
        try:
            if method == "GET" and not path.startswith("/api/"):
                return self._static("index.html" if path in ("/", "/index.html") else path.lstrip("/"))
            if path == "/api/meta":
                return self._json({"modules": MODULES, "routes": sorted(f"{m} {p}" for m, p in ROUTES)})
            fn = ROUTES.get((method, path))
            if fn is None:
                return self._json({"error": "not found"}, 404)
            q = {k: v[0] for k, v in parse_qs(url.query).items()}
            body = {}
            if method == "POST":
                origin = self.headers.get("Origin")
                if origin and urlparse(origin).netloc not in self.allowed_hosts:
                    return self._json({"error": "untrusted origin"}, 403)
                length = int(self.headers.get("Content-Length") or 0)
                if not self.headers.get("Content-Type", "").startswith("application/json") or length > 2_000_000:
                    raise BadRequest("JSON 요청만 허용됩니다.")
                body = json.loads(self.rfile.read(length) or b"{}")
                if not isinstance(body, dict):
                    raise BadRequest("JSON 객체가 필요합니다.")
            return self._json(fn(q, body))
        except BadRequest as e:
            return self._json({"error": str(e)}, 400)
        except (ValueError, KeyError, TypeError) as e:
            return self._json({"error": f"입력값 오류: {e}"}, 400)
        except Exception as e:
            if os.environ.get("EASY_VERBOSE"):
                traceback.print_exc()
            return self._json({"error": f"{type(e).__name__}: {e}"}, 500)

    def do_GET(self):
        self._handle("GET")

    def do_POST(self):
        self._handle("POST")


def main() -> None:
    ap = argparse.ArgumentParser(description="MARU Terminal (마루 터미널)")
    ap.add_argument("--host", default=os.environ.get("EASY_HOST", "127.0.0.1"))
    ap.add_argument("--port", type=int, default=int(os.environ.get("EASY_PORT", "8770")))
    a = ap.parse_args()
    Handler.allowed_hosts = {f"{a.host}:{a.port}", f"localhost:{a.port}", f"127.0.0.1:{a.port}", f"[::1]:{a.port}"}
    Handler.allowed_hosts |= {h.strip() for h in os.environ.get("EASY_ALLOWED_HOSTS", "").split(",") if h.strip()}
    load_modules()
    bad = {k: v for k, v in MODULES.items() if v != "ok"}
    print(f"MARU Terminal → http://127.0.0.1:{a.port}  ({len(ROUTES)} routes, {len(MODULES) - len(bad)}/{len(MODULES)} modules)", flush=True)
    srv = ThreadingHTTPServer((a.host, a.port), Handler)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()

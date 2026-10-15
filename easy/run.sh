#!/usr/bin/env sh
# Fincept Terminal Easy - macOS / Linux launcher
cd "$(dirname "$0")"
if [ ! -x .venv/bin/python ]; then
  echo "[1/2] Creating virtual environment..."
  python3 -m venv .venv && .venv/bin/python -m pip install -q -r requirements.txt
fi
echo "[2/2] Starting server: http://127.0.0.1:8770"
exec .venv/bin/python server.py --port 8770

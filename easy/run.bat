@echo off
rem MARU Terminal - Windows launcher
cd /d "%~dp0"
if not exist .venv\Scripts\python.exe (
  echo [1/2] Creating virtual environment...
  py -3 -m venv .venv || python -m venv .venv
  .venv\Scripts\python -m pip install -q -r requirements.txt
)
echo [2/2] Starting server: http://127.0.0.1:8770
start "" http://127.0.0.1:8770
.venv\Scripts\python server.py --port 8770

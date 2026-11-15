@echo off
setlocal
cd /d "%~dp0"
title AgriVerse - Local Farm Planning App
echo.
echo ===============================================
echo  AGRIVERSE - LOCAL WEBSITE + PYTHON BACKEND
echo ===============================================
echo.
python -c "import sys; sys.exit(sys.version_info < (3, 10))" >nul 2>&1
if not errorlevel 1 goto run_python
py -3 -c "import sys; sys.exit(sys.version_info < (3, 10))" >nul 2>&1
if not errorlevel 1 goto run_py
if exist "%LocalAppData%\Python\bin\python.exe" goto run_manager
echo Python was not found. Download it from:
echo https://www.python.org/downloads/windows/
echo Close and reopen this window after installation.
pause
exit /b 1
:run_python
echo Open the address shown by AgriVerse below.
echo Keep this window open; Ctrl+C stops AgriVerse.
python server.py --port 8959
goto finish
:run_py
echo Open the address shown by AgriVerse below.
echo Keep this window open; Ctrl+C stops AgriVerse.
py -3 server.py --port 8959
goto finish
:run_manager
echo Open the address shown by AgriVerse below.
"%LocalAppData%\Python\bin\python.exe" server.py --port 8959
:finish
if errorlevel 1 (
 echo.
 echo AgriVerse stopped with an error. Copy the message above for support.
 pause
)

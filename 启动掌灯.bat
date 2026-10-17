@echo off
chcp 936 >nul
setlocal enabledelayedexpansion
cd /d "%~dp0"
title 掌灯 · 手势皮影戏
set "PORT=8124"
set "PY="

echo.
echo   ============================================
echo      掌灯 · 手势皮影戏      本地启动
echo   ============================================
echo.

rem ---------- 0) 包里自带运行时（解压即能跑，不要求这台电脑装过 Python）----------
if exist "%~dp0runtime\py\python.exe" (
  "%~dp0runtime\py\python.exe" -c "import http.server" >nul 2>nul
  if not errorlevel 1 set "PY=%~dp0runtime\py\python.exe"
)
if defined PY goto :gotpy

rem ---------- 1) 找一个真的能跑的 Python（WindowsApps 那个假 python 会被筛掉）----------
for /d %%d in ("%LOCALAPPDATA%\hermes\tools\python-*") do (
  if exist "%%~fd\python.exe" (
    "%%~fd\python.exe" -c "import http.server" >nul 2>nul
    if not errorlevel 1 set "PY=%%~fd\python.exe" & goto :gotpy
  )
)
:gotpy
if not defined PY (
  where python >nul 2>nul
  if not errorlevel 1 (
    python -c "import http.server" >nul 2>nul
    if not errorlevel 1 set "PY=python"
  )
)
if not defined PY (
  where py >nul 2>nul
  if not errorlevel 1 (
    py -3 -c "import http.server" >nul 2>nul
    if not errorlevel 1 set "PY=py -3"
  )
)
if not defined PY (
  echo   [X] 这台电脑上没有找到可用的 Python 3。
  echo       到 python.org 装一个，第一步务必勾选 "Add Python to PATH"，装完重新双击本文件。
  echo.
  pause
  exit /b 1
)

rem ---------- 2) 端口被旧服务占着就先请走（旧服务发缓存头，会让你一直看到旧版）----------
set "OLD="
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":8124" ^| findstr "LISTENING"') do set "OLD=%%p"
if defined OLD (
  echo   检测到旧版服务在运行，正在切换为新版启动器...
  taskkill /f /pid %OLD% >nul 2>nul
  timeout /t 1 >nul
)

echo   使用 Python：%PY%
echo   浏览器将自动打开 http://127.0.0.1:%PORT%/
echo.
echo   进入后：先点「戏折子」选一出（刀会 / 拾镯 / 磨刀 / 自由演），
echo   再点「启灯 · 开始」并允许摄像头 —— 把手伸向光，影人自己会走。
echo   没有摄像头就点「无摄像头 · 看演示」，或用「键盘 · 鼠标操作」自己演一段。
echo.
echo   注意：如果你之前开过这个页面，请关掉旧标签页再进（旧页面被浏览器缓存过）。
echo   关闭本窗口即停止服务。
echo.
start "" "http://127.0.0.1:%PORT%/"
%PY% _serve.py %PORT%
pause

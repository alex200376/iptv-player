@echo off
chcp 65001 >nul
title IPTV Player

cd /d "%~dp0"

if not exist "node_modules" (
    echo [IPTV] 正在安装依赖...
    call npm install
)

echo [IPTV] 正在启动...
npm run dev
pause

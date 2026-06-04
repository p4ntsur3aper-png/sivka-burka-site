@echo off
setlocal
cd /d "%~dp0"

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-local.ps1"

echo.
echo If Backend and Frontend windows opened, keep them open while using the app.
pause

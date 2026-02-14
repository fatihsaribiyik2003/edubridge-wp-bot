@echo off
echo Eski surecleri temizliyor...
taskkill /F /IM node.exe >nul 2>&1
taskkill /F /IM chrome.exe >nul 2>&1
if exist ".wwebjs_auth/session" (
    del /f /s /q .wwebjs_auth\session\Lockfile >nul 2>&1
)
echo Bot baslatiliyor...
node index.js
pause

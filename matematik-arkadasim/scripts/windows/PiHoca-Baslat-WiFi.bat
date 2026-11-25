@echo off
REM Pi Hoca sunucusunu yalnizca ev Wi-Fi icin baslatir (http; mikrofon kisitli).
cd /d "%~dp0..\.."
call npm run evde-baslat -- --wifi
pause

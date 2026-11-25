@echo off
REM Pi Hoca sunucusunu baslatir (Tailscale ile, onerilen). Bu dosyayi "matematik-arkadasim" klasorunun icinden calistirin.
cd /d "%~dp0..\.."
call npm run evde-baslat
pause

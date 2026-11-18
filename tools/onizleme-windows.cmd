@echo off
rem IrriGrow yerel onizleme (kabul testi). Node.js gerekir: https://nodejs.org
cd /d "%~dp0.."
where node >nul 2>nul || (echo Node.js bulunamadi. https://nodejs.org adresinden LTS surumunu kurun. & pause & exit /b 1)
start "" /b cmd /c "timeout /t 2 /nobreak >nul & start "" http://127.0.0.1:8090/"
node tools\onizleme.js 8090
pause

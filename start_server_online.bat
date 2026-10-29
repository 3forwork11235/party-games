@echo off
chcp 65001 >nul
cd /d "%~dp0"
setlocal
:: Usage: start_server_online.bat [subdomain]   (default: TUNA_SUBDOMAIN or quick-owl-8041)
set "SUB=%~1"
if "%SUB%"=="" set "SUB=%TUNA_SUBDOMAIN%"
if "%SUB%"=="" set "SUB=quick-owl-8041"
title Party games server - %SUB%
cls
echo ==========================================
echo    PARTY GAMES SERVER - %SUB%
echo ==========================================
echo.

where pnpm >nul 2>&1 || (echo [!] pnpm not found. Install it: npm i -g pnpm@10& goto :FAIL)
where tuna >nul 2>&1 || (echo [!] tuna not found. Install Tuna and log in first.& goto :FAIL)
if not exist "node_modules" (
    echo [+] Installing dependencies...
    call pnpm install || goto :FAIL
)

echo [+] Checking game server on port 2567...
powershell -NoProfile -Command "if (Get-NetTCPConnection -State Listen -LocalPort 2567 -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }" >nul 2>&1
if errorlevel 1 (
    echo [+] Building server...
    call pnpm --filter @party/server build || goto :FAIL
    echo [+] Starting server :2567...
    start "Party server" /MIN cmd /k node server\dist\index.js
) else (
    echo [+] Already running.
)
powershell -NoProfile -Command "$d=(Get-Date).AddSeconds(60); do { try { $h=Invoke-RestMethod -Uri 'http://127.0.0.1:2567/health' -TimeoutSec 2; if ($h.ok) { exit 0 } } catch {}; Start-Sleep -Milliseconds 700 } while ((Get-Date) -lt $d); exit 1" >nul 2>&1
if errorlevel 1 (
    echo [!] Server did not respond at http://127.0.0.1:2567/health
    echo [!] Look at the "Party server" window for the error.
    goto :FAIL
)

echo [+] Checking Tuna tunnel...
call :READ_TUNA
if "%TUNA_URL%"=="NONE" (
    echo [+] Starting Tuna: tuna http 2567 --subdomain=%SUB%
    start "Tuna server" tuna http 2567 --subdomain=%SUB%
    powershell -NoProfile -Command "$d=(Get-Date).AddSeconds(30); do { try { $s=Invoke-RestMethod -Uri 'http://127.0.0.1:4040/v1/status' -TimeoutSec 2; if ($s.connected -and $s.address) { exit 0 } } catch {}; Start-Sleep -Milliseconds 700 } while ((Get-Date) -lt $d); exit 1" >nul 2>&1
    call :READ_TUNA
)
if "%TUNA_URL%"=="NONE" (
    echo [!] Could not read an active tunnel from http://127.0.0.1:4040/v1/status
    echo [!] Check the "Tuna server" window: you may need to log in to Tuna first.
    goto :FAIL
)
echo %TUNA_URL%| findstr /i /c:"%SUB%" >nul
if errorlevel 1 (
    echo [!] Another Tuna tunnel is active: %TUNA_URL%
    echo [!] Close it and run this script again.
    goto :FAIL
)

cls
echo ==========================================
echo    PARTY GAMES SERVER - Ready!
echo ==========================================
echo.
echo  Server address:
echo      wss://%SUB%.a.tuna.free
echo.
echo  Site:
echo      https://3forwork11235.github.io/party-games/
echo.
echo  Keep the "Party server" and "Tuna server" windows open while playing.
echo  When this laptop is off, the site opens but the games cannot be played.
echo.
pause
exit /b 0

:READ_TUNA
set "TUNA_URL=NONE"
for /f "tokens=*" %%a in ('powershell -NoProfile -Command "try { $s = Invoke-RestMethod -Uri 'http://127.0.0.1:4040/v1/status' -TimeoutSec 3; if ($s.connected -and $s.address) { $s.address } else { 'NONE' } } catch { 'NONE' }"') do set "TUNA_URL=%%a"
exit /b 0

:FAIL
echo.
pause
exit /b 1

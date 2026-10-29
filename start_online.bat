@echo off
chcp 65001 >nul
cd /d "%~dp0"
setlocal
:: Usage: start_online.bat [slug]   (default: demo-clicker)
set "SLUG=%~1"
if "%SLUG%"=="" set "SLUG=demo-clicker"
title Party games online - %SLUG%
cls
echo ==========================================
echo    PARTY GAMES ONLINE - %SLUG%
echo ==========================================
echo.

if not exist "games\%SLUG%\package.json" (
    echo [!] Game "games\%SLUG%" not found.
    goto :FAIL
)
where pnpm >nul 2>&1 || (echo [!] pnpm not found. Install it: npm i -g pnpm@10& goto :FAIL)
where tuna >nul 2>&1 || (echo [!] tuna not found. Install Tuna and log in first.& goto :FAIL)
if not exist "node_modules" (
    echo [+] Installing dependencies...
    call pnpm install || goto :FAIL
)

echo [+] Checking game server and client on port 5173...
powershell -NoProfile -Command "if (Get-NetTCPConnection -State Listen -LocalPort 5173 -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }" >nul 2>&1
if errorlevel 1 (
    echo [+] Starting server :2567 and client :5173...
    start "Party server - %SLUG%" /MIN cmd /k "pnpm dev %SLUG%"
) else (
    echo [+] Already running.
)
powershell -NoProfile -Command "$d=(Get-Date).AddSeconds(60); do { try { $h=Invoke-RestMethod -Uri 'http://127.0.0.1:5173/colyseus/health' -TimeoutSec 2; if ($h.ok) { exit 0 } } catch {}; Start-Sleep -Milliseconds 700 } while ((Get-Date) -lt $d); exit 1" >nul 2>&1
if errorlevel 1 (
    echo [!] Server did not respond at http://127.0.0.1:5173/colyseus/health
    echo [!] Look at the "Party server" window for the error.
    goto :FAIL
)

echo [+] Checking Tuna tunnel...
call :READ_TUNA
if "%TUNA_URL%"=="ERROR" (
    echo [+] Starting Tuna: tuna http 5173
    start "Tuna - %SLUG%" tuna http 5173
    powershell -NoProfile -Command "$d=(Get-Date).AddSeconds(30); do { try { $s=Invoke-RestMethod -Uri 'http://127.0.0.1:4040/v1/status' -TimeoutSec 2; if ($s.connected -and $s.address) { exit 0 } } catch {}; Start-Sleep -Milliseconds 700 } while ((Get-Date) -lt $d); exit 1" >nul 2>&1
    call :READ_TUNA
)
if "%TUNA_URL%"=="ERROR" (
    echo [!] Could not read an active tunnel from http://127.0.0.1:4040/v1/status
    echo [!] Check the "Tuna" window: you may need to log in to Tuna first.
    goto :FAIL
)
echo %TUNA_URL%| clip

cls
echo ==========================================
echo    %SLUG% ONLINE - Ready!
echo ==========================================
echo.
echo  Both players open this address (PC, Android, iPhone, any network):
echo.
echo      %TUNA_URL%
echo.
echo  (already copied to clipboard)
echo.
echo  If Tuna shows a warning page, press "Visit".
echo  Player 1: nickname - "Create room" - "Invite" and send the link.
echo  Player 2: open the invite link, or enter the 5-letter code - "Join".
echo  Host presses "Start".
echo.
echo  Keep the "Party server" and "Tuna" windows open while playing.
echo  Anyone with the link can open the game while the tunnel is up -
echo  close the Tuna window when you are done.
echo.
pause >nul
exit /b 0

:READ_TUNA
set "TUNA_URL=ERROR"
for /f "tokens=*" %%a in ('powershell -NoProfile -Command "try { $s = Invoke-RestMethod -Uri 'http://127.0.0.1:4040/v1/status' -TimeoutSec 3; if ($s.connected -and $s.address) { $s.address -replace '^http://','https://' } else { 'ERROR' } } catch { 'ERROR' }"') do set "TUNA_URL=%%a"
exit /b 0

:FAIL
echo.
pause
exit /b 1

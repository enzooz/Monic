@echo off
setlocal
title Monic Indumentaria - Internet

cd /d "%~dp0"

echo.
echo ================================================
echo   MONIC INDUMENTARIA - MODO INTERNET
echo ================================================
echo.

echo [1/4] Verificando Python...
where python >nul 2>nul
if errorlevel 1 (
    echo [ERROR] No se encontro Python. Instalalo desde https://www.python.org
    echo.
    pause
    exit /b 1
)

echo [2/4] Verificando Flask...
python -c "import flask" >nul 2>nul
if errorlevel 1 (
    echo Instalando Flask...
    python -m pip install Flask
)

echo [3/4] Iniciando servidor local...
if not defined MONIC_SECRET_KEY set MONIC_SECRET_KEY=monic-clave-estable-para-sesiones
start "Monic Servidor" /min cmd /c "set MONIC_DEBUG=0 && python app.py"
timeout /t 3 >nul

echo [4/4] Verificando Cloudflare Tunnel...
where cloudflared >nul 2>nul
if not errorlevel 1 (
    set CLOUDFLARED=cloudflared
) else (
    if not exist "cloudflared.exe" (
        echo Descargando cloudflared.exe...
        powershell -Command "Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile 'cloudflared.exe'"
        if not exist "cloudflared.exe" (
            echo [ERROR] No se pudo descargar cloudflared. Revisa la conexion o instalalo manualmente.
            echo.
            pause
            exit /b 1
        )
    )
    set CLOUDFLARED=cloudflared.exe
)

echo.
echo ================================================
echo   INICIANDO TUNEL PUBLICO...
echo   Cuando aparezca una URL tipo
echo   https://xxxxx.trycloudflare.com
echo   COPIALA y compartila con cualquiera.
echo   (Cambia cada vez que ejecutes este archivo)
echo ================================================
echo.

%CLOUDFLARED% tunnel --url http://127.0.0.1:5000

echo.
echo El servicio se detuvo.
pause
@echo off
setlocal
title Monic Indumentaria

cd /d "%~dp0"

echo.
echo ==============================
echo   MONIC INDUMENTARIA
echo ==============================
echo.

echo [1/3] Verificando Python...
where python >nul 2>nul
if errorlevel 1 (
    echo [ERROR] No se encontro Python. Instalalo desde https://www.python.org
    echo.
    pause
    exit /b 1
)

echo [2/3] Verificando Flask...
python -c "import flask" >nul 2>nul
if errorlevel 1 (
    echo Instalando Flask...
    python -m pip install Flask
)

echo [3/3] Iniciando servidor en http://localhost:5000 ...
echo.
start "" http://localhost:5000

python app.py

echo.
echo El servidor se detuvo.
pause

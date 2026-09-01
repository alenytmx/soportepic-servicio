@echo off
title Soportepic Servicio
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js no esta instalado. Instala Node.js 20 o superior.
  pause
  exit /b 1
)

if not exist "apps\api\.env" (
  copy "apps\api\.env.example" "apps\api\.env" >nul
  echo Se creo apps\api\.env. Revisa solamente MONGODB_URI; el sistema generara JWT_SECRET de forma segura.
)

if not exist "node_modules" (
  echo Instalando dependencias por primera vez...
  call npm install
  if errorlevel 1 (
    echo No fue posible instalar las dependencias.
    pause
    exit /b 1
  )
)

echo Abriendo Soportepic Servicio...
echo.
echo IMPORTANTE: Si usas MongoDB local, verifica que el servicio MongoDB este iniciado.
echo Si usas MongoDB Atlas, revisa MONGODB_URI en apps\api\.env.
echo JWT_SECRET se valida y corrige automaticamente antes de iniciar.
echo La primera cuenta se crea desde la pantalla Configuracion inicial; no hay credenciales predeterminadas.
echo.
start "Soportepic Servicio - Servidor" cmd /k "npm run dev"
node scripts\wait-for-url.mjs http://127.0.0.1:5173 Aplicacion 120000
if errorlevel 1 (
  echo No fue posible abrir la aplicacion. Revisa la ventana del servidor.
  pause
  exit /b 1
)
start "" http://localhost:5173

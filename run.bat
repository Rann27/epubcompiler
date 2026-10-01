@echo off
setlocal
cd /d "%~dp0"
title EPUB Compiler (dev)

where pnpm >nul 2>nul
if errorlevel 1 (
  echo pnpm tidak ditemukan. Pasang dulu dengan: npm i -g pnpm
  pause
  exit /b 1
)

if not exist node_modules (
  echo Dependensi belum terpasang, menjalankan pnpm install...
  call pnpm install
  if errorlevel 1 (
    echo pnpm install gagal.
    pause
    exit /b 1
  )
)

echo Menjalankan EPUB Compiler... Tutup jendela aplikasi untuk berhenti.
call pnpm dev

rem Menutup jendela aplikasi memang berakhir dengan exit code 1 dari concurrently; tidak perlu pause.
endlocal

@echo off
title Rabisco Survivors CO-OP
start "Rabisco Survivors Server" cmd /k "cd /d %~dp0 && node server.js"
timeout /t 2 /nobreak >nul
start "" http://localhost:3000

@echo off
title Darlon Dutra - Missao Foz
start "Missao Foz Server" cmd /k "cd /d %~dp0 && node server.js"
timeout /t 2 /nobreak >nul
start "" http://localhost:3000

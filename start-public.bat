@echo off
title Nova Chatbot - Public URL
echo Starting server...
start /min cmd /c "node server.js"
timeout /t 3 /nobreak >nul
echo Creating public URL (this may take a moment)...
node tunnel.js
echo.
echo URL saved to public-url.txt - open it to see the link.
pause
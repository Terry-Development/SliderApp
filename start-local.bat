@echo off
set "NODE_PATH=C:\Program Files\nodejs"
set "PATH=%NODE_PATH%;%PATH%"

echo Starting Backend...
start "Backend Server" cmd /k "set PATH=%NODE_PATH%;%PATH% && cd backend && npm start"

echo Starting Frontend...
start "Frontend App" cmd /k "set PATH=%NODE_PATH%;%PATH% && cd frontend && npm run dev"

echo.
echo Both servers are starting...
echo Backend: http://localhost:3001
echo Frontend: http://localhost:3000
echo.
echo If the windows close immediately, there is an error.
echo IMPORTANT: Make sure you have updated backend/.env with your Cloudinary keys!
pause

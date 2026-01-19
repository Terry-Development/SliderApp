@echo off
set "NODE_PATH=C:\Program Files\nodejs"
set "PATH=%NODE_PATH%;%PATH%"

echo Installing Backend Dependencies...
cd backend
call npm install
cd ..

echo Installing Frontend Dependencies...
cd frontend
call npm install
cd ..

echo Done! You can now run start-local.bat
pause

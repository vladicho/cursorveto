@echo off
setlocal
cd /d "%~dp0"

set "NODE_EXE="

where node >nul 2>nul
if %errorlevel%==0 (
  for /f "delims=" %%N in ('where node') do (
    if not defined NODE_EXE set "NODE_EXE=%%N"
  )
)

if not defined NODE_EXE (
  if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" (
    set "NODE_EXE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
  )
)

if not defined NODE_EXE (
  echo Nao encontrei o Node.js neste Windows.
  echo Instale Node.js ou abra este projeto pelo Codex para usar o runtime embutido.
  pause
  exit /b 1
)

set "MOLDELAB_OPEN_BROWSER=1"
"%NODE_EXE%" scanner-server.js
pause

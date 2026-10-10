@echo off
setlocal
set "SCRIPT_DIR=%~dp0"
set "HRNX_EXE=%SCRIPT_DIR%hrnx-core\.venv\Scripts\hrnx.exe"

if not exist "%HRNX_EXE%" (
    echo Error: Cannot locate hrnx.exe at "%HRNX_EXE%". Please check hrnx-core\.venv. 1>&2
    exit /b 1
)

"%HRNX_EXE%" %*

@echo off
set OUTPUT=semua_kodingan_nexusgraph.txt
set OUTPATH=%~dp0%OUTPUT%

if exist "%OUTPATH%" del "%OUTPATH%"

:: Ambil file konfigurasi penting di root
for %%f in (package.json next.config.ts) do (
    if exist "%~dp0%%f" (
        echo ============================== >> "%OUTPATH%"
        echo FILE: %%f >> "%OUTPATH%"
        echo ============================== >> "%OUTPATH%"
        type "%~dp0%%f" >> "%OUTPATH%"
        echo. >> "%OUTPATH%"
        echo. >> "%OUTPATH%"
    )
)

:: Scan hanya folder inti (skip node_modules, .next, pdfs, public)
for %%d in (app components lib scripts supabase types) do (
    if exist "%~dp0%%d" (
        pushd "%~dp0%%d"
        for /r %%i in (*.ts *.tsx *.js *.css *.sql) do (
            echo ============================== >> "%OUTPATH%"
            echo FILE: %%i >> "%OUTPATH%"
            echo ============================== >> "%OUTPATH%"
            type "%%i" >> "%OUTPATH%"
            echo. >> "%OUTPATH%"
            echo. >> "%OUTPATH%"
        )
        popd
    )
)

type "%OUTPATH%" | clip
echo Selesai! Semua code digabung ke %OUTPUT% dan disalin ke clipboard.
pause
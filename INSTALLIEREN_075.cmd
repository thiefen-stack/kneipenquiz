@echo off
chcp 65001 > nul
echo Kneipenquiz 0.7.5: Zahlenpruefung und Beschleunigung
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Update_Kneipenquiz_075.ps1"
if errorlevel 1 (
 echo.
 echo FEHLER: Keine Aenderung vorgenommen. Bitte Fehlermeldung pruefen.
 pause
 exit /b 1
)
echo.
echo Du kannst jetzt den Commit und Push in GitHub Desktop ausfuehren.
pause

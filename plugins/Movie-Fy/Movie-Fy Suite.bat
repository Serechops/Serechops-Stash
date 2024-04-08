@echo off
:menu
cls
echo =========================
echo      MOVIE-FY SUITE
echo =========================
echo 1. Movie-Fy Create Movie Studio
echo 2. Movie-Fy Check and Update Scene Titles
echo 3. Movie-Fy!
echo 4. Movie-Fy Bulk Movie URL Scrape
echo 5. Movie-Fy Scene Studio Bulk Update
echo 6. Movie-Fy Update Movie Scene Covers
echo 7. Movie-Fy Scene Index Updater
echo 0. Exit
echo =========================
set /p choice=Enter the number of the script you want to run (0 to exit): 

if "%choice%"=="1" (
    python "Movie-Fy Create Movie Studio.py"
) else if "%choice%"=="2" (
    python "Movie-Fy Check and Update Scene Titles.py"
) else if "%choice%"=="3" (
    python "Movie-Fy.py"
) else if "%choice%"=="4" (
    python "Movie-Fy Bulk Movie URL Scrape.py"
) else if "%choice%"=="5" (
    python "Movie-Fy Scene Studio Bulk Update.py"
) else if "%choice%"=="6" (
    python "Movie-Fy Update Movie Scene Covers.py"
) else if "%choice%"=="7" (
    python "Movie-Fy Scene Index Updater.py"
) else if "%choice%"=="0" (
    exit
) else (
    echo Invalid choice. Please enter a number from the menu.
    pause
)
goto menu

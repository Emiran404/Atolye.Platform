@echo off
setlocal enabledelayedexpansion

echo ======================================================
echo   PolyOS Sinav Platformu - Kurulum ve Hazirlik
echo ======================================================

:: Git Kontrolü
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [UYARI] Git sisteminizde kurulu degil!
    echo Guncellemeleri panel üzerinden yapabilmek icin Git gereklidir.
    echo Lütfen https://git-scm.com/ adresinden Git'i kurun.
    echo.
) else (
    echo [+] Git algilandi.
)

echo.
echo [1/4] Proje Klasoru ve Git Kontrolü...
if not exist ".git" (
    echo [!] Bu klasor bir Git deposu degil. 
    set /p clone_choice="GitHub'dan en güncel kodlari cekmek ister misiniz? (E/H): "
    if /i "!clone_choice!"=="E" (
        echo Repo klonlaniyor...
        git init
        git remote add origin https://github.com/Emiran404/Atoyle.Platfrom.git
        git fetch
        git checkout -t origin/main -f
    )
) else (
    set /p pull_choice="GitHub'dan guncelleme yapayim mi? (E/H): "
    if /i "!pull_choice!"=="E" (
        echo Kodlar guncelleniyor...
        git pull origin main --autostash
    )
)

echo.
echo ------------------------------------------------------
echo Lutfen kurulum turunu secin:
echo 1) Cevrimici (Online) - Internet baglantisi gerekir (npm install ^& build)
echo 2) Cevrimdishi (Offline) - MEB engeli / Internetsiz laboratuvarlar icin (*.zip kullanir)
echo ------------------------------------------------------
set /p install_mode="Seciminiz (1 veya 2): "

if "!install_mode!"=="2" (
    echo.
    echo [Cevrimdishi Kurulum Secildi]
    
    set "ZIP_FILE="
    for %%f in (*offline*.zip) do set "ZIP_FILE=%%f"
    
    if not defined ZIP_FILE (
        for %%f in (*.zip) do set "ZIP_FILE=%%f"
    )
    
    if not defined ZIP_FILE (
        echo [!] Cevrimdishi paket yerelde bulunamadi.
        echo GithHub Releases uzerinden otomatik indiriliyor (v4.0.0)...
        
        set "VERSION=4.0.0"
        set "DOWNLOAD_URL=https://github.com/PolyOS-Team/Atolye.Platform/releases/download/v!VERSION!/atolye-platform-offline_v!VERSION!.zip"
        set "ZIP_FILE=atolye-platform-offline_v!VERSION!.zip"
        
        :: curl ile indirmeyi dene
        curl -L -o "!ZIP_FILE!" "!DOWNLOAD_URL!"
        
        :: Eğer curl başarısız olursa veya yoksa PowerShell ile dene
        if not exist "!ZIP_FILE!" (
            powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object System.Net.WebClient).DownloadFile('!DOWNLOAD_URL!', '!ZIP_FILE!')"
        )
        
        if not exist "!ZIP_FILE!" (
            echo Hata: Otomatik indirme basarisiz oldu ^(Internet baglantisi yok veya MEB engeli^).
            echo Lutfen paketi tarayicinizdan manuel olarak indirip bu klasore atin:
            echo Link: !DOWNLOAD_URL!
            pause
            exit /b 1
        )
        echo [OK] Indirme tamamlandi!
    )
    
    echo [+] Cevrimdishi paket bulundu: !ZIP_FILE!
    echo Paket icerigi aciliyor...
    
    :: PowerShell ile zip dosyasını çıkar
    powershell -Command "Expand-Archive -Path '!ZIP_FILE!' -DestinationPath '.' -Force"
    
    if %errorlevel% neq 0 (
        echo Hata: Paket acilamadi! PowerShell surumunuzu kontrol edin veya manuel cikartin.
        pause
        exit /b 1
    )
    
    :: .env ayarı
    if not exist ".env" (
        if exist ".env.example" (
            copy .env.example .env >nul
            echo [+] .env.example dosyasi .env olarak kopyalandi.
        )
    )
    
    echo.
    echo ======================================================
    echo   CEVRIMDISHI KURULUM TAMAMLANDI!
    echo ======================================================
    echo.
    echo Uygulamayi baslatmak icin 'baslat-offline.bat' veya 'baslat.bat' dosyasini kullanin.
    echo.
    pause
    exit /b 0
)

echo.
echo [2/4] Frontend bagimliliklari yukleniyor...
call npm install

echo.
echo [3/4] Backend bagimliliklari yukleniyor...
cd server
call npm install
cd ..

echo.
echo [4/4] Proje derleniyor (Build) ve Sifreleniyor...
call npm run build

echo.
echo ======================================================
echo   KURULUM TAMAMLANDI!
echo ======================================================
echo.
echo Uygulamayi baslatmak icin 'baslat.bat' dosyasini kullanin.
echo.
pause

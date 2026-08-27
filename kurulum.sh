#!/bin/bash

echo "======================================================"
echo "  PolyOS Sinav Platformu - Kurulum (Linux/Pardus)"
echo "======================================================"

# Git Kontrolü
if ! command -v git &> /dev/null; then
    echo "[UYARI] Git sisteminizde kurulu degil!"
    echo "Pardus/Linux icin: sudo apt install git"
    echo ""
else
    echo "[+] Git algilandi."
fi

# Node.js kontrolü
if ! command -v node &> /dev/null; then
    echo "Hata: Node.js kurulu degil. Lutfen yukleyip tekrar deneyin."
    exit 1
fi

echo ""
echo "[1/4] Proje Klasoru ve Git Kontrolu..."
if [ ! -d ".git" ]; then
    echo "[!] Bu klasor bir Git deposu degil."
    read -p "GitHub'dan en guncel kodlari cekmek ister misiniz? (e/h): " CLONE_CHOICE
    if [[ $CLONE_CHOICE =~ ^[Ee]$ ]]; then
        echo "Repo klonlaniyor..."
        git init
        git remote add origin https://github.com/Emiran404/Atoyle.Platfrom.git
        git fetch
        git checkout -t origin/main -f
    fi
else
    read -p "GitHub'dan guncelleme yapayim mi? (e/h): " PULL_CHOICE
    if [[ $PULL_CHOICE =~ ^[Ee]$ ]]; then
        echo "Kodlar guncelleniyor..."
        git pull origin main --autostash
    fi
fi

echo ""
echo "------------------------------------------------------"
echo "Lütfen kurulum türünü seçin:"
echo "1) Çevrimiçi (Online) - İnternet bağlantısı gerekir (npm install & build)"
echo "2) Çevrimdışı (Offline) - MEB engeli / İnternetsiz laboratuvarlar için (*.zip kullanır)"
echo "------------------------------------------------------"
read -p "Seçiminiz (1 veya 2): " INSTALL_MODE

if [ "$INSTALL_MODE" = "2" ]; then
    echo ""
    echo "[Çevrimdışı Kurulum Seçildi]"
    
    # Çevrimdışı paketi ara
    ZIP_FILE=$(ls *offline*.zip 2>/dev/null | head -n 1)
    
    if [ -z "$ZIP_FILE" ]; then
        # Klasördeki herhangi bir zip dosyasını dene
        ZIP_FILE=$(ls *.zip 2>/dev/null | head -n 1)
    fi
    
    if [ -z "$ZIP_FILE" ]; then
        echo "[!] Çevrimdışı paket yerelde bulunamadı."
        echo "🌐 GitHub Releases üzerinden otomatik indiriliyor (v4.0.0)..."
        
        VERSION="4.0.0"
        DOWNLOAD_URL="https://github.com/PolyOS-Team/Atolye.Platform/releases/download/v$VERSION/atolye-platform-offline_v$VERSION.zip"
        ZIP_FILE="atolye-platform-offline_v$VERSION.zip"
        
        if command -v curl &> /dev/null; then
            curl -L -o "$ZIP_FILE" "$DOWNLOAD_URL"
        elif command -v wget &> /dev/null; then
            wget -O "$ZIP_FILE" "$DOWNLOAD_URL"
        else
            echo "Hata: Sisteminizde 'curl' veya 'wget' bulunamadı!"
            echo "Lütfen paketi manuel olarak indirin: $DOWNLOAD_URL"
            exit 1
        fi
        
        # Dosyanın inip inmediğini ve boş olup olmadığını kontrol et
        if [ ! -f "$ZIP_FILE" ] || [ ! -s "$ZIP_FILE" ]; then
            rm -f "$ZIP_FILE" 2>/dev/null
            echo "❌ Hata: Otomatik indirme başarısız oldu (İnternet bağlantısı yok veya MEB engeli)."
            echo "Lütfen paketi tarayıcınızdan manuel olarak indirip bu klasöre atın:"
            echo "🔗 Link: $DOWNLOAD_URL"
            exit 1
        fi
        echo "✅ İndirme tamamlandı!"
    fi
    
    echo "[+] Çevrimdışı paket bulundu: $ZIP_FILE"
    echo "Paket içeriği açılıyor..."
    
    if command -v unzip &> /dev/null; then
        # Sadece dist ve server/node_modules klasörlerini çıkart (üzerine yazarak)
        unzip -o "$ZIP_FILE" "dist/*" "server/node_modules/*" "baslat.sh" "baslat.bat" -d ./
    else
        echo "Hata: 'unzip' komutu bulunamadı! Lütfen unzip kurun (sudo apt install unzip) veya paketi manuel çıkartın."
        exit 1
    fi
    
    # .env ayarı
    if [ ! -f ".env" ]; then
        if [ -f ".env.example" ]; then
            cp .env.example .env
            echo "[+] .env.example dosyası .env olarak kopyalandı."
        fi
    fi
    
    echo ""
    echo "======================================================"
    echo "  ÇEVRİMDışı KURULUM TAMAMLANDI!"
    echo "======================================================"
    echo ""
    echo "Uygulamayı başlatmak için './baslat-offline.sh' veya './baslat.sh' komutunu kullanın."
    echo ""
    chmod +x baslat-offline.sh baslat.sh 2>/dev/null || :
    exit 0
fi

echo ""
echo "[2/4] Frontend bagimliliklari yukleniyor..."
npm install

echo ""
echo "[3/4] Backend bagimliliklari yukleniyor..."
cd server && npm install
cd ..

echo ""
echo "[4/4] Proje derleniyor (Build) ve Sifreleniyor..."
npm run build

echo ""
echo "======================================================"
echo "  KURULUM TAMAMLANDI!"
echo "======================================================"
echo ""
echo "Uygulamayi baslatmak icin './baslat.sh' komutunu kullanin."
echo ""
chmod +x baslat.sh

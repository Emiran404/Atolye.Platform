<div align="center">

<!-- HEADER BANNER -->
![Atolye.Platform Banner](https://banner-api-and-website-production-6dcd.up.railway.app/banner?header=%21%5Bnodedotjs%5D+At%C3%B6lye.Platform&subheader=%21%5Bvite%5DA%C3%A7%C4%B1k+kaynakl%C4%B1+bir+s%C4%B1nav+g%C3%B6nderme+ve+e%C4%9Fitim+y%C3%B6netim+platformu&bg=00000000&color=FFFFFF&subheadercolor=FFFFFF&headerfont=Roboto&subheaderfont=Open+Sans&support=false)
# 🎓 Atölye.Platform

### Eğitim kurumları için modern, güvenli ve dinamik sınav yönetim ekosistemi.

<br/>

<!-- CORE BADGES -->
[![Version](https://img.shields.io/badge/Versiyon-4.0.1-6366f1?style=for-the-badge)](https://github.com/Emiran404/Atolye.Platform/releases)
[![License](https://img.shields.io/badge/Lisans-MIT-10b981?style=for-the-badge)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Pardus_%7C_Windows-ef4444?style=for-the-badge)](https://github.com/Emiran404/Atolye.Platform)

<!-- TECH STACK BADGES -->
[![React](https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite_5-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![Electron](https://img.shields.io/badge/Electron-47848F?style=for-the-badge&logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Socket.io](https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socketdotio&logoColor=white)](https://socket.io/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Zustand](https://img.shields.io/badge/Zustand-443E38?style=for-the-badge&logo=react&logoColor=white)](https://zustand-demo.pmnd.rs/)

<!-- FEATURE BADGES -->
[![WebAuthn](https://img.shields.io/badge/🔐_Passkey-WebAuthn-yellow?style=for-the-badge)](https://webauthn.io/)
[![LDAP](https://img.shields.io/badge/📂_LDAP-LiderAhenk-blue?style=for-the-badge)](https://liderahenk.org/)
[![I18n](https://img.shields.io/badge/🌍_Dil-TR_|_EN_|_DE_|_RU-red?style=for-the-badge)](src/utils/i18n.js)
[![mDNS](https://img.shields.io/badge/📡_mDNS-Auto_Discovery-purple?style=for-the-badge)](https://www.npmjs.com/package/bonjour-service)

<br/>

<!-- REPO STATS -->
![Stars](https://img.shields.io/github/stars/Emiran404/Atolye.Platform?style=flat-square&color=ffd700) ![Forks](https://img.shields.io/github/forks/Emiran404/Atolye.Platform?style=flat-square&color=60a5fa) ![Issues](https://img.shields.io/github/issues/Emiran404/Atolye.Platform?style=flat-square&color=f87171) ![Pull Requests](https://img.shields.io/github/issues-pr/Emiran404/Atolye.Platform?style=flat-square&color=34d399) ![Repo Size](https://img.shields.io/github/repo-size/Emiran404/Atolye.Platform?style=flat-square&color=818cf8) ![Last Commit](https://img.shields.io/github/last-commit/Emiran404/Atolye.Platform?style=flat-square&color=a78bfa)

<br/>

[Özellikler](#-temel-özellikler) • [Ekran Görüntüleri](#-ekran-görüntüleri) • [Kurulum](#-kurulum) • [Mimari](#-sistem-mimarisi) • [Yol Haritası](#-yol-haritası)

---

</div>

## 🌟 Nedir?

**Atölye.Platform**, Alanya Mesleki ve Teknik Anadolu Lisesi için geliştirilen, **Pardus** ve **Debian** tabanlı sistemlerde yerel ağ üzerinden çalışan açık kaynaklı bir sınav ve ödev yönetim ekosistemidir. Öğretmenlere uçtan uca sınav oluşturma, dağıtma, toplama ve değerlendirme; öğrencilere ise şık ve odaklanmış bir portal sunar.

> [!NOTE]
> **Atölye.Platform** bir [PolyOS](https://github.com/Emiran404) ürünüdür — *Pardus Okul Laboratuvar Yönetim ve Ödev Sistemi.*

> [!IMPORTANT]
> **Atölye.Platform**, Alanya Mesleki ve Teknik Anadolu Lisesi (Alanya MTAL) Bilişim Teknolojileri alanındaki bilgisayar laboratuvarlarında aktif olarak 26-27+ Eğitim Yılında **Beta aşamasında test edilmektedir** ve gerçek sınav/ödev süreçlerinde başarıyla kullanılmaktadır.

---

## ❓ Neden Atölye.Platform?

Mevcut bulut tabanlı alternatifler (Google Classroom, Moodle vb.), Milli Eğitim Bakanlığı (MEB) Fatih internet ağındaki erişim kısıtlamaları (kısıtlı portlar, engellenen domainler) ve Pardus laboratuvar ortamlarında doğrudan yerel ağ üzerinden hızlı dosya transferi gereksinimi sebebiyle yetersiz kalmaktadır. 

**Atölye.Platform** bu ihtiyaçları yerel ağ mimarisiyle çözer:
* 📡 **İnternet Bağımsızlığı**: Sunucu ve istemciler tamamen intranet (yerel ağ) üzerinde haberleşir, dış dünyaya ihtiyaç duymaz.
* ⚡ **Sıfır Konfigürasyon**: mDNS (Bonjour) protokolü sayesinde IP adresi veya DNS ayarı gerektirmeksizin cihazlar birbirini otomatik bulur.
* 🐧 **Pardus Uyumluluğu**: Yerli işletim sistemimiz Pardus ve LiderAhenk merkezi yönetim sistemi ile doğal olarak entegre çalışır.
* 📈 **Maksimum Hız**: Gigabit yerel ağ hızında, yüzlerce öğrenciye ait dosyalar saniyeler içinde toplanır ve dağıtılır.

---

## 📥 Hazır Paketler

Derleme yapmadan, aşağıdaki hazır paketlerle saniyeler içinde kurulum yapın:

<div align="center">

| | Paket | İşletim Sistemi | İndir |
| :---: | :--- | :--- | :---: |
| 🖥️ | **Öğretmen Sunucusu** | Pardus / Debian | [📥 `.deb` Sunucu](https://github.com/Emiran404/Atolye.Platform/releases/latest) |
| 🪟 | **Masaüstü İstemci** | Windows 10/11 | [📥 `.exe` Kurulum](https://github.com/Emiran404/Atolye.Platform/releases/latest) |
| 🐧 | **Masaüstü İstemci** | Linux / Pardus | [📥 `.deb` İstemci](https://github.com/Emiran404/Atolye.Platform/releases/latest) |

</div>

> [!TIP]
> **Pardus kullanıcıları:** `.deb` paketlerini çift tıklayarak veya `sudo dpkg -i paket.deb` komutuyla yükleyebilirsiniz.

---

## ✨ Temel Özellikler

> [!IMPORTANT]
> **🎉 v4.2.0 İle Gelen Dev Yenilikler**
> - 📱 **PWA (Progressive Web App) Desteği**: Platform artık telefon, tablet ve masaüstüne yerel uygulama gibi çevrimdışı önbellekleme desteği ile yüklenebilir.
> - 💎 **TypeScript Mimarisi**: Güvenilirlik ve performans için tüm altyapı JavaScript'ten TypeScript'e geçirildi.
> - 🕒 **İşlem Geçmişi (Operation History)**: Platform üzerindeki kritik işlemler geriye dönük izlenebilir.
> - 🛡️ **Anti-Cheat & Kiosk Modu**: Öğrenci sınav sırasında odak kaybettiğinde, başka bir pencereye geçtiğinde otomatik olarak güvenliği devreye alır.
> - 👨‍🏫 **Bağımsız Öğretmen Değerlendirme Sistemi**: Her öğretmen, aynı sınavdaki değerlendirmelerini kendi arayüzünde tamamen izole yönetebilir.
> - ⚙️ **GitHub Actions Sürekli Entegrasyon (CI/CD)**: Tüm projenin derlenmesi otomatikleştirilmiştir.

<table>
<tr>
<td width="50%">

### 👨‍🏫 Öğretmen Paneli
- 📊 **Canlı Dashboard** — İstatistik kartları ve anlık aktivite akışı
- 📝 **Sınav Oluşturma** — Esnek süre, sınıf hedefleme ve çoklu format desteği
- 🔍 **Akıllı Değerlendirme** — Split-view dosya inceleme ve anlık notlandırma
- 📈 **İstatistik & Raporlama** — Sınıf bazlı başarı analizi ve PDF rapor
- 🗂️ **Dinamik Arşiv** — Geçmiş sınavları filtreleme ve toplu dışa aktarma
- 📅 **Sınav Takvimi** — Haftalık/aylık planlama görünümü
- 🏫 **Sınıf Yönetimi** — Dinamik sınıf ekleme/silme (API-driven)
- 👥 **Öğrenci Listesi** — Kayıt durumu takibi ve toplu yönetim

</td>
<td width="50%">

### 👨‍🎓 Öğrenci Paneli
- 🎯 **Odaklanmış Arayüz** — Sadece aktif sınavlara odaklanan sade tasarım
- 📤 **Sürükle-Bırak Yükleme** — Gelişmiş dosya yükleme ile hızlı teslim
- 📋 **Sınav Geçmişi** — Geçmiş notlar ve geri bildirimleri görüntüleme
- 🔔 **Anlık Bildirimler** — Socket.io ile gerçek zamanlı uyarılar
- 🔐 **Passkey Girişi** — Şifresiz, biyometrik kimlik doğrulama
- 🌍 **4 Dil Desteği** — Türkçe, İngilizce, Almanca ve Rusça

</td>
</tr>
</table>

### 🛡️ Güvenlik & Entegrasyon

| Özellik | Açıklama |
| :--- | :--- |
| **🔐 WebAuthn / Passkey** | Windows Hello ve Pardus biyometrik sistemleriyle şifresiz giriş |
| **📂 LiderAhenk / LDAP** | Kurumsal kullanıcı dizinleriyle otomatik senkronizasyon *(Beta)* |
| **📡 mDNS Auto-Discovery** | İstemciler sunucuyu ağda otomatik keşfeder — IP girmeye gerek yok |
| **🛡️ Kod Karıştırma** | Production build'de JavaScript Obfuscation ile kaynak kodu koruması |
| **🔒 JWT Authentication** | Her API çağrısında token bazlı yetkilendirme |
| **⏱️ Rate Limiting** | Brute-force ve DDoS koruması |
| **📑 Güvenli PDF/Resim** | Kimlik doğrulamalı ve korumalı dosya izleyici (v4.0.1) |
| **💾 SQLite Veritabanı** | Yerleşik `node:sqlite` veritabanı (SQLite native modülü yoksa otomatik JSON fallback desteği) |
| **🚫 Anti-Cheat / Kiosk** | Electron istemcisi üzerinde çalışan Alt+Tab tespiti, Developer Tools engellemesi, odak kaybı izleme ve sadece istemci üzerinden sınava giriş izni (v4.0.1) |

### 🚫 Kiosk & Anti-Cheat Modu (Öğrenci İstemcisi)

Sınav güvenliğini en üst düzeye çıkarmak için **Electron İstemcisi** özel bir kiosk ve koruma moduyla çalışır:
* **Klavye / Kısayol Engeli**: `Alt+Tab`, `Ctrl+Alt+Del` (Windows için) veya Pardus/Linux masaüstü geçiş kısayolları izlenir ve engellenir.
* **Ekran ve Odak Takibi**: Öğrenci sınav ekranı dışına tıkladığında veya odağı kaybettiğinde sisteme otomatik uyarı düşer.
* **Developer Tools Koruması**: Tarayıcı konsolunun açılması engellenir, kaynak koduna erişim kapatılır.
* **Zorunlu İstemci**: Sınav oluşturulurken "Sadece İstemci (Kiosk) İzni" seçilerek öğrencilerin tarayıcıdan girmesi tamamen engellenebilir.

---

## 📸 Ekran Görüntüleri

<div align="center">

### Öğretmen Paneli

| Dashboard | Sınav Oluşturma |
| :---: | :---: |
| ![Dashboard](screenshots/Teacher/Dashboard.png) | ![CreateExam](screenshots/Teacher/CreateExam.png) |
| *Canlı istatistikler ve sistem takibi* | *Esnek sınav hazırlama ekranı* |

| Değerlendirme | Kullanıcı Yönetimi |
| :---: | :---: |
| ![Evaluation](screenshots/Teacher/Evaluation.png) | ![UserManagement](screenshots/Teacher/UserManagement.png) |
| *Split-view notlandırma ve geri bildirim* | *Öğrenci ve öğretmen hesap yönetimi* |

| Güvenlik Ayarları | |
| :---: | :---: |
| ![Settings](screenshots/Teacher/Settings.png) | |
| *Passkey, güvenlik ve platform ayarları* | |

| Öğrenci Dashboard | Sınav Ekranı | Soru Görüntüleyici |
| :---: | :---: | :---: |
| ![StudentDashboard](screenshots/Student/Dashboard.png) | ![StudentExam](screenshots/Student/Exam.png) | ![FileViewer](screenshots/Global/FileViewerModal.png) |
| *Sade ve odaklanmış öğrenci portalı* | *Dosya yükleme ve sınav teslim arayüzü* | *Güvenli ve şık dosya izleme modalı* |

### Ana Sayfa

![LandingPage](screenshots/Atolye.Platform-Anasayfa.png)
*Cinematic tasarımlı ana sayfa*

</div>

---

## 🚀 Kurulum

### Sistem Gereksinimleri

| Gereksinim | Minimum |
| :--- | :--- |
| **Node.js** | v18.0.0+ |
| **npm** | v9.0.0+ |
| **İşletim Sistemi** | Pardus 21+ / Debian 11+ / Windows 10+ |
| **RAM** | 2 GB (Sunucu) |
| **Disk** | 500 MB boş alan |

### Hızlı Başlangıç (Linux / Pardus)

```bash
# 1. Projeyi klonlayın
git clone https://github.com/Emiran404/Atolye.Platform.git
cd Atolye.Platform

# 2. Otomatik kurulum sihirbazını çalıştırın
chmod +x kurulum.sh
./kurulum.sh

# 3. Platformu başlatın
chmod +x baslat.sh
./baslat.sh
```

### 🌐 Çevrimdışı (Offline) Kurulum (MEB İnternet Kısıtlaması)

Fatih Projesi internet ağındaki port kısıtlamaları veya tamamen interneti bulunmayan bilgisayar laboratuvarları için projenin **Çevrimdışı (Offline) Paket** desteği mevcuttur:

1. GitHub Releases sayfasından güncel çevrimdışı paketi (`atolye-platform-offline_v4.0.1.zip` veya ilgili sürüm) indirin ve sunucu bilgisayarına taşıyın.
2. Arşivi proje klasörü içerisine kopyalayın (açmanıza gerek yoktur).
3. Kurulum sihirbazını çalıştırın:
   ```bash
   chmod +x kurulum.sh
   ./kurulum.sh
   ```
4. Ekrana gelen seçeneklerden **"2) Çevrimdışı (Offline)"** modunu seçin.
5. Sihirbaz yereldeki zip dosyasını tespit edip, dış ağ bağımlılıklarına ihtiyaç duymadan `node_modules` ve `dist` klasörlerini otomatik açarak sistemi tamamen hazır hale getirecektir.

### Manuel Kurulum

```bash
# 1. Projeyi klonlayın
git clone https://github.com/Emiran404/Atolye.Platform.git
cd Atolye.Platform

# 2. Bağımlılıkları yükleyin (frontend + backend)
npm run install:all

# 3. .env dosyasını yapılandırın
cp .env.example .env

# 4. Geliştirme modunda başlatın
npm run dev

# 5. Production build
npm run build
```

> **Windows kullanıcıları:** `kurulum.sh` yerine doğrudan `npm run install:all` ve `npm run dev` komutlarını kullanın.

### 🐳 Docker ile Kurulum (Önerilen Production Kurulumu)

Uygulamayı bir sunucuda 7/24 kesintisiz (production) çalıştırmak için en kolay yöntem Docker kullanmaktır.

```bash
# 1. Projenin ana (Source Code) kaynak kodlarını indirin veya klonlayın
git clone https://github.com/Emiran404/Atolye.Platform.git
cd Atolye.Platform

# 2. Docker kullanarak sistemi izole ortamda ayağa kaldırın
docker-compose up -d --build
```
> [!NOTE]
> Bu komut, gerekli `Dockerfile` yönergelerini takip ederek frontend ve backend'i derler, ve varsayılan olarak **80** ile **3001** portlarından yayına alır. Sistemin tamamen başlaması derleme sürecine bağlı olarak birkaç dakika sürebilir.

---

## 🌐 PolyOS Ekosistemi

Atölye.Platform, okul laboratuvarlarını uçtan uca dijitalleştirmeyi amaçlayan **PolyOS** şemsiye projesinin bir parçasıdır ve aşağıdaki entegre bileşenlerle tam uyumlu bir ekosistem sunar:

1. **PolyOS Labs**: Bilgisayar laboratuvarındaki istemci makinelerin açılış, kapanış, masaüstü yönetimi ve genel durum izlemesini sağlayan yönetim katmanı.
2. **OGA (Öğrenci Gönderme Aracısı)**: Öğretmen bilgisayarından öğrenci bilgisayarlarına hızlı dosya aktarımı, komut çalıştırma ve ekran izleme sağlayan hafif veri köprüsü.
3. **LiderAhenk SSO**: Pardus ekosisteminin merkezi yönetim sistemi olan LiderAhenk LDAP dizini ile entegre çalışarak okul personelinin ve öğrencilerin mevcut kurumsal şifreleriyle tek tıkla sisteme dahil olmasını (Single Sign-On) sağlar.

---

## 🏗️ Sistem Mimarisi

```
Atölye.Platform/
├── 📂 src/                    # React Frontend (Vite)
│   ├── components/            # Yeniden kullanılabilir UI bileşenleri
│   ├── pages/
│   │   ├── teacher/           # 20+ öğretmen modülü
│   │   ├── student/           # Öğrenci portalı
│   │   └── auth/              # Kimlik doğrulama sayfaları
│   ├── store/                 # Zustand state yönetimi
│   ├── services/              # API istemci katmanı
│   └── utils/                 # i18n, tarih ve yardımcı fonksiyonlar
├── 📂 server/                 # Node.js / Express Backend
│   ├── routes/                # REST API endpoint'leri
│   ├── middleware/             # Auth, rate-limit, CORS
│   ├── data/                  # SQLite Veritabanı ve JSON dosyaları
│   └── utils/                 # LDAP, dosya işlemleri
├── 📂 client-electron/        # Electron masaüstü istemcisi
├── 📂 scripts/                # .deb paketleme scriptleri
├── 📂 deploy/                 # Systemd servis yapılandırmaları
└── 📂 screenshots/            # Ekran görüntüleri
```

### Teknoloji Yığını

<div align="center">

| Katman | Teknoloji | Versiyon |
| :--- | :--- | :--- |
| **Frontend** | React + Vite + Zustand | 19.x / 5.x / 5.x |
| **Arayüz** | Tailwind CSS + Vanilla CSS | 4.x |
| **İkonlar** | Lucide React | 0.5x |
| **Backend** | Node.js + Express.js | 18+ / 4.x |
| **Gerçek Zamanlı** | Socket.io | 4.x |
| **Masaüstü** | Electron + Electron-Builder | 30.x |
| **Güncelleme** | Electron Updater + GitHub Actions | 6.x |
| **Keşif** | Bonjour (mDNS) | 1.x |
| **Auth** | JSON Web Token + WebAuthn | — |
| **Veri** | Yerleşik SQLite (`node:sqlite`) / JSON Fallback | — |
| **Grafikler** | Recharts | 3.x |

</div>

### 🔄 Akıllı Güncelleme Mimarisi (2-Tier Auto Update)

Okul laboratuvarlarında kısıtlı internet bant genişliğini korumak için tasarlanmış yerel ağ öncelikli otomatik güncelleme sistemi:

1. **Öğretmen Sunucusu (Ana Makine):** GitHub Actions üzerinden yeni bir sürüm yayınlandığında bunu otomatik tespit eder. Kurulum dosyalarını (.exe ve .deb) dış internetten **sadece 1 kez** indirerek yerel ağa sunar.
2. **Öğrenci Cihazları (İstemciler):** İnternete çıkmak yerine doğrudan öğretmen sunucusu ile iletişime geçer. Yeni sürümü tespit ettiği an **Gigabit LAN hızında (saniyede 100+ MB)** kurulum dosyasını çeker, arka planda kendini günceller ve yeniden başlatır. Böylece 40 bilgisayarlı bir laboratuvarın interneti çökertmesi tamamen engellenir.

---

## 🗺️ Yol Haritası

- [x] ~~Dinamik sınıf yönetimi (API-driven)~~
- [x] ~~Passkey / WebAuthn desteği~~
- [x] ~~4 dilli arayüz (TR/EN/DE/RU)~~
- [x] ~~mDNS otomatik sunucu keşfi~~
- [x] ~~Windows (.exe) ve Linux (.deb) paketleri~~
- [x] ~~Akıllı 2-Aşamalı Otomatik Güncelleme Sistemi (Electron Updater)~~
- [x] ~~Cinematic UI ve Glassmorphism tasarım~~
- [x] ~~Çoklu öğretmen desteği ve rol yönetimi~~
- [x] ~~Otomatik sınav değerlendirme (OGA modülü)~~
- [x] ~~Docker konteyner desteği~~
- [x] ~~LiderAhenk tam entegrasyon (LDAP kullanıcı senkronizasyonu)~~
- [ ] Progressive Web App (PWA) desteği

---

## 🧪 Testler (Testing)

Platform kod kalitesini artırmak için Vitest ve Playwright ile kapsamlı testlere sahiptir:

```bash
# Tüm birim testlerini (Unit Tests) çalıştır
npm run test:unit

# Sunucu (API) testlerini çalıştır
npm run test:api

# Uçtan uca (E2E) tarayıcı testlerini çalıştır
npm run test:e2e
```

---


## 🧹 Bakım

Sistem sıfırlama gerektiğinde:

| Platform | Komut |
| :--- | :--- |
| **Linux / Pardus** | `./cleanup_linux.sh` |
| **Windows** | `cleanup_windows.bat` |

> Bu araçlar kilitli süreçleri otomatik sonlandırır ve sistemi fabrika ayarlarına döndürür.

---

## 🤝 Katkıda Bulunma

Katkılarınızı bekliyoruz! Detaylı bilgi için [CONTRIBUTING.md](CONTRIBUTING.md) dosyasına göz atın.

1. 🍴 Projeyi **Fork** edin
2. 🌿 Feature branch oluşturun (`git checkout -b feature/yeni-ozellik`)
3. 💾 Commit yapın (`git commit -m "feat: yeni özellik eklendi"`)
4. 🚀 Push edin (`git push origin feature/yeni-ozellik`)
5. 📬 **Pull Request** açın

---

## 📄 Lisans

Bu proje [MIT](LICENSE) lisansı altında lisanslanmıştır. Eğitim amaçlı özgürce kullanılabilir.

---

<div align="center">

### 💙 Atölye.Platform

**Alanya Mesleki ve Teknik Anadolu Lisesi**

Geliştiren: [Emirhan Gök](https://github.com/Emiran404) • PolyOS Ekosistemi

<br/>

*Coded with ❤️ for the future of education.*

<br/>

[⭐ Bu projeyi beğendiyseniz yıldız vermeyi unutmayın!](https://github.com/Emiran404/Atolye.Platform)

</div>

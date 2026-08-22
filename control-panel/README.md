# Atolye Platform Control Panel

Öğretmen bilgisayarında Atolye Platform sunucusunu izlemek ve yönetmek için
hazırlanan Linux masaüstü uygulamasıdır.

## Geliştirme

```bash
npm install
npm start
```

macOS veya sunucu servisi bulunmayan geliştirme ortamlarında arayüz açılır;
servis durumu `unknown` olarak görünebilir. Gerçek servis kontrolleri Debian/
Ubuntu üzerinde yapılır.

## `.deb` paketi oluşturma

Proje kökünden:

```bash
npm run package:control-panel
```

Paket `control-panel/dist/` altında `amd64` mimarisi için oluşturulur. Kurulum:

```bash
sudo apt install ./control-panel/dist/atolye-platform-control-panel_4.4.2_amd64.deb
```

Servis başlatma, durdurma ve yeniden başlatma işlemleri Linux yönetici onayı
ister. Panel yalnızca `atolye-server.service` servisini yönetebilir.

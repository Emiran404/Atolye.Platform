import path from 'path';
import fs from 'fs-extra';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import archiver from '../server/node_modules/archiver/index.js'; // server modüllerini kullanıyoruz

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.join(__dirname, '..');

const VERSION = fs.readJsonSync(path.join(root, 'package.json')).version;
const PKG_NAME = "atolye-platform-offline";
const STAGE_DIR = path.join(root, 'build_offline_stage');
const OUTPUT_ZIP = path.join(root, `${PKG_NAME}_v${VERSION}.zip`);

async function build() {
  console.log(`📦 ${PKG_NAME} v${VERSION} Çevrimdışı Paketi Hazırlanıyor...`);

  try {
    // 1. Frontend build alalım
    console.log("⚙️  Frontend derleniyor (npm run build)...");
    execSync('npm run build', { cwd: root, stdio: 'inherit' });

    // 2. Sahneyi temizle
    if (await fs.pathExists(STAGE_DIR)) {
      await fs.emptyDir(STAGE_DIR);
    } else {
      await fs.ensureDir(STAGE_DIR);
    }

    // 3. Dosyaları kopyala
    console.log("📂 Gerekli dosyalar kopyalanıyor...");

    // Frontend dist klasörü
    await fs.copy(path.join(root, 'dist'), path.join(STAGE_DIR, 'dist'));

    // Backend server klasörü (node_modules ile birlikte)
    await fs.copy(path.join(root, 'server'), path.join(STAGE_DIR, 'server'), {
      filter: (src) => {
        // temp, backups vb. geçici verileri kopyalama
        const relative = path.relative(path.join(root, 'server'), src);
        return !relative.startsWith('temp') && 
               !relative.startsWith('backups') && 
               !relative.startsWith('data/'); // varsayılan boş veri dosyaları initializeDataFiles ile zaten oluşacak
      }
    });

    // Başlatıcı scriptler
    await fs.copy(path.join(root, 'baslat-offline.sh'), path.join(STAGE_DIR, 'baslat.sh'));
    await fs.copy(path.join(root, 'baslat-offline.bat'), path.join(STAGE_DIR, 'baslat.bat'));

    // Kök dizindeki gerekli dosyalar
    await fs.copy(path.join(root, 'package.json'), path.join(STAGE_DIR, 'package.json'));
    if (await fs.pathExists(path.join(root, '.env'))) {
      await fs.copy(path.join(root, '.env'), path.join(STAGE_DIR, '.env'));
    } else if (await fs.pathExists(path.join(root, '.env.example'))) {
      await fs.copy(path.join(root, '.env.example'), path.join(STAGE_DIR, '.env'));
    }

    // İzinleri ayarla (Linux için)
    await fs.chmod(path.join(STAGE_DIR, 'baslat.sh'), 0o755);

    // 4. Zip Arşivi oluştur
    console.log("🤐 Zip arşivi sıkıştırılıyor...");
    if (await fs.pathExists(OUTPUT_ZIP)) {
      await fs.remove(OUTPUT_ZIP);
    }

    const output = fs.createWriteStream(OUTPUT_ZIP);
    const archive = archiver('zip', {
      zlib: { level: 9 } // En yüksek sıkıştırma oranı
    });

    output.on('close', async () => {
      const sizeMB = (archive.pointer() / 1024 / 1024).toFixed(2);
      console.log(`\n✅ Başarılı! Çevrimdışı paket hazır.`);
      console.log(`📍 Konum: ${OUTPUT_ZIP}`);
      console.log(`📊 Boyut: ${sizeMB} MB`);
      
      // Temizlik
      await fs.remove(STAGE_DIR);
    });

    archive.on('warning', (err) => {
      if (err.code === 'ENOENT') {
        console.warn('⚠️ Uyarı:', err);
      } else {
        throw err;
      }
    });

    archive.on('error', (err) => {
      throw err;
    });

    archive.pipe(output);

    // Tüm sahne dizinini zip köküne ekle
    archive.directory(STAGE_DIR, false);

    await archive.finalize();

  } catch (err) {
    console.error("❌ Paketleme başarısız:", err);
    // Temizlik
    if (await fs.pathExists(STAGE_DIR)) {
      await fs.remove(STAGE_DIR);
    }
    process.exit(1);
  }
}

build();

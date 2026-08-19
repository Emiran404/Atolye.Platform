const $ = (id) => document.getElementById(id);
let busy = false;
let liveLogStarted = false;

function duration(seconds) {
  const value = Math.max(0, Number(seconds) || 0);
  const days = Math.floor(value / 86400);
  const hours = Math.floor((value % 86400) / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  return [days ? `${days} gün` : '', hours ? `${hours} sa` : '', `${minutes} dk`].filter(Boolean).join(' ');
}

function bytes(value) {
  return `${(value / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function serviceDuration(startedAt) {
  const date = new Date(startedAt);
  if (!startedAt || Number.isNaN(date.getTime())) return 'Başlangıç zamanı bilinmiyor';
  return `${duration((Date.now() - date.getTime()) / 1000)} çalışıyor`;
}

async function refresh() {
  if (busy) return;
  try {
    const data = await window.controlPanel.getStatus();
    const ready = data.service.active && data.health.ok;
    document.body.dataset.status = ready ? 'online' : 'offline';
    $('statusLabel').textContent = ready ? 'SİSTEM HAZIR' : 'İLGİ GEREKİYOR';
    $('statusTitle').textContent = ready ? 'Atolye Platform çalışıyor' : 'Atolye Platform çalışmıyor';
    $('statusDetail').textContent = ready ? `Sunucu ${data.health.latency} ms içinde yanıt verdi.` : 'Servisi başlatın veya günlüklerdeki hatayı inceleyin.';
    $('serviceState').textContent = data.service.active ? 'Çalışıyor' : 'Durdu';
    $('serviceMeta').textContent = data.service.active ? serviceDuration(data.service.startedAt) : `${data.service.state} / ${data.service.subState}`;
    $('databaseState').textContent = data.database.ok ? 'Bağlı' : 'Kontrol edilemiyor';
    $('databaseMeta').textContent = data.database.label;
    $('uptime').textContent = duration(data.serverUptime);
    $('hostname').textContent = `${data.system.hostname} • Sistem ${duration(data.system.uptime)}`;
    $('memory').textContent = `${bytes(data.system.memoryUsed)} / ${bytes(data.system.memoryTotal)}`;
    $('load').textContent = `Sistem yükü: ${data.system.load.toFixed(2)}`;
    $('activeStudents').textContent = data.activeStudents === null ? '—' : String(data.activeStudents);
    $('studentMeta').textContent = data.activeStudents === null ? 'Sunucu güncellemesi gerekiyor' : 'Aktif portal oturumları';
    $('disk').textContent = data.disk.total ? `%${data.disk.percent}` : '—';
    $('diskMeta').textContent = data.disk.total ? `${bytes(data.disk.available)} boş alan` : 'Disk bilgisi alınamadı';
    $('internet').textContent = data.internet ? 'Bağlı' : 'Çevrimdışı';
    $('readiness').textContent = data.readiness.ready ? 'Hazır' : 'Kontrol gerekli';
    const failedChecks = Object.entries(data.readiness.checks).filter(([, ok]) => !ok).map(([name]) => ({ service: 'servis', api: 'API', network: 'ağ', database: 'veritabanı', disk: 'disk', internet: 'internet' }[name]));
    $('readinessMeta').textContent = failedChecks.length ? `Kontrol: ${failedChecks.join(', ')}` : 'Tüm temel kontroller başarılı';
    $('platformInfo').textContent = `${data.system.platform} • PID ${data.service.pid || '—'} • Yeniden başlama ${data.service.restarts}`;
    $('addresses').replaceChildren();
    if (data.urls.length) {
      for (const url of data.urls) {
        const address = document.createElement('code');
        address.textContent = url;
        $('addresses').appendChild(address);
      }
    } else {
      const message = document.createElement('p');
      message.textContent = 'Etkin bir yerel ağ adresi bulunamadı.';
      $('addresses').appendChild(message);
    }
    if (!liveLogStarted) $('logs').textContent = data.logs;
    $('lastUpdate').textContent = `Son kontrol ${new Date(data.collectedAt).toLocaleTimeString('tr-TR')}`;
    $('openButton').disabled = !data.health.ok;
  } catch (error) {
    $('statusTitle').textContent = 'Durum bilgisi alınamadı';
    $('statusDetail').textContent = error.message;
  }
}

async function act(action) {
  if (busy) return;
  busy = true;
  $('actionMessage').textContent = `${action === 'start' ? 'Başlatılıyor' : action === 'stop' ? 'Durduruluyor' : 'Yeniden başlatılıyor'}… Yönetici onayı gerekebilir.`;
  try {
    await window.controlPanel.serviceAction(action);
    $('actionMessage').textContent = 'İşlem tamamlandı.';
    setTimeout(refresh, 1200);
  } catch (error) {
    $('actionMessage').textContent = error.message;
  } finally {
    busy = false;
  }
}

$('refreshButton').addEventListener('click', refresh);
$('openButton').addEventListener('click', () => window.controlPanel.openPlatform());
$('startButton').addEventListener('click', () => act('start'));
$('stopButton').addEventListener('click', () => act('stop'));
$('restartButton').addEventListener('click', () => act('restart'));
$('restartButtonSecondary').addEventListener('click', () => act('restart'));

async function toolAction(message, operation) {
  if (busy) return;
  busy = true;
  $('toolMessage').textContent = message;
  try {
    const result = await operation();
    if (result?.message) $('toolMessage').textContent = result.message;
    else if (result?.canceled) $('toolMessage').textContent = 'İşlem iptal edildi.';
    else if (result?.path) $('toolMessage').textContent = `Tamamlandı: ${result.path}`;
    else $('toolMessage').textContent = 'İşlem tamamlandı.';
  } catch (error) {
    $('toolMessage').textContent = error.message;
  } finally {
    busy = false;
  }
}

$('backupButton').addEventListener('click', () => toolAction('Yedek hazırlanıyor…', () => window.controlPanel.createBackup()));
$('restoreButton').addEventListener('click', () => toolAction('Yedek doğrulanıyor ve geri yükleniyor…', () => window.controlPanel.restoreBackup()));
$('diagnosticsButton').addEventListener('click', () => toolAction('Tanılama raporu hazırlanıyor…', () => window.controlPanel.exportDiagnostics()));
$('updateButton').addEventListener('click', () => toolAction('Güncellemeler kontrol ediliyor…', async () => {
  const update = await window.controlPanel.checkUpdate();
  if (update.available) await window.controlPanel.openUpdatePage();
  return { message: update.available ? `Yeni sürüm mevcut: ${update.latest} (kurulu: ${update.current})` : `Güncel sürüm kullanılıyor: ${update.current}` };
}));
$('autostartToggle').addEventListener('change', async (event) => {
  try {
    const enabled = await window.controlPanel.setAutostart(event.target.checked);
    event.target.checked = enabled;
    $('toolMessage').textContent = enabled ? 'Otomatik başlatma açıldı.' : 'Otomatik başlatma kapatıldı.';
  } catch (error) {
    event.target.checked = !event.target.checked;
    $('toolMessage').textContent = error.message;
  }
});

refresh();
window.controlPanel.getAutostart().then((enabled) => { $('autostartToggle').checked = enabled; });
setInterval(refresh, 5000);

window.controlPanel.onLiveLog((entry) => {
  const output = $('logs');
  if (!liveLogStarted) {
    output.textContent = '';
    liveLogStarted = true;
  }
  output.textContent += entry.text;
  const lines = output.textContent.split('\n');
  if (lines.length > 500) output.textContent = lines.slice(-500).join('\n');
  output.scrollTop = output.scrollHeight;
});

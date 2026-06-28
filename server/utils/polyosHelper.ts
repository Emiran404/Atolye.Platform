import { getData } from './storage.js';

export const sendPolyosLabNotification = async (message: string) => {
  try {
    const allSettings = getData('settings') || {};
    const polyosSettings = allSettings.polyos;

    if (!polyosSettings || !polyosSettings.enabled || !polyosSettings.serverUrl) {
      console.log('[PolyOS Helper] Entegrasyon aktif değil veya sunucu adresi girilmemiş.');
      return;
    }

    const serverUrl = polyosSettings.serverUrl;
    const broadcastUrl = `${serverUrl}/api/broadcast`;

    console.log(`[PolyOS Helper] Yayın bildirimi gönderiliyor: ${broadcastUrl}`);

    const response = await fetch(broadcastUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        command: `show_message:${message}`
      }),
      signal: AbortSignal.timeout(3000)
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`[PolyOS Helper] Yayın bildirimi gönderildi. İletilen istemci sayısı: ${data.sent || 0}`);
    } else {
      console.error(`[PolyOS Helper] Yayın bildirimi başarısız oldu. Durum: ${response.status}`);
    }

  } catch (error) {
    console.error('[PolyOS Helper] PolyOS Lab yayın bildirim servisi hatası:', error.message);
  }
};

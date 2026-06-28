// @ts-nocheck
import express from 'express';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import { getData, setData } from '../utils/storage.js';

const router = express.Router();

// PolyOS Lab ayarlarını yükle (settings.json içinden)
const getPolyosSettings = () => {
  try {
    const allSettings = getData('settings') || {};
    return allSettings.polyos || {
      enabled: false,
      serverUrl: 'http://localhost:8080',
      secretToken: 'polyos-secure-token'
    };
  } catch (error) {""
    console.error('PolyOS settings load error:', error);
  }
  return { enabled: false, serverUrl: 'http://localhost:8080', secretToken: 'polyos-secure-token' };
};

// GET /api/polyos/settings
router.get('/settings', authenticateToken, authorizeRole('teacher'), (req, res) => {
  const settings = getPolyosSettings();
  res.json({ success: true, settings });
});

// POST /api/polyos/settings
router.post('/settings', authenticateToken, authorizeRole('teacher'), (req, res) => {
  try {
    const newSettings = req.body;
    let allSettings = getData('settings') || {};

    allSettings.polyos = {
      ...allSettings.polyos,
      ...newSettings
    };

    setData('settings', allSettings);
    res.json({ success: true, message: 'PolyOS Lab ayarları kaydedildi.' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Ayarlar kaydedilemedi: ' + error.message });
  }
});

// POST /api/polyos/test
router.post('/test', authenticateToken, authorizeRole('teacher'), async (req, res) => {
  try {
    const { serverUrl } = req.body;
    if (!serverUrl) {
      return res.status(400).json({ success: false, error: 'Sunucu adresi gerekli.' });
    }

    const testUrl = `${serverUrl}/api/clients`;
    
    // PolyOS Lab yerel sunucusuna bağlanmayı dene
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(3000) // 3 saniye zaman aşımı
    });

    if (response.ok) {
      const clients = await response.json();
      return res.json({ 
        success: true, 
        message: 'Bağlantı başarılı!', 
        clientCount: Array.isArray(clients) ? clients.length : 0 
      });
    } else {
      return res.status(response.status).json({ 
        success: false, 
        error: `Sunucu hata kodu döndürdü: ${response.status}` 
      });
    }
  } catch (error) {
    return res.json({ 
      success: false, 
      error: 'Sunucuya bağlanılamadı. PolyOS Lab servisinin çalıştığından ve adresin doğru olduğundan emin olun.' 
    });
  }
});

// GET /api/polyos/clients
router.get('/clients', authenticateToken, authorizeRole('teacher'), async (req, res) => {
  try {
    const settings = getPolyosSettings();
    if (!settings.enabled) {
      return res.json({ success: false, error: 'PolyOS Lab entegrasyonu aktif değil.' });
    }

    const fetchUrl = `${settings.serverUrl}/api/clients`;
    const response = await fetch(fetchUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(3000)
    });

    if (response.ok) {
      const clients = await response.json();
      res.json({ success: true, clients });
    } else {
      res.status(response.status).json({ success: false, error: 'İstemci listesi alınamadı.' });
    }
  } catch (error) {
    res.json({ success: false, error: 'PolyOS Lab sunucusuyla iletişim kurulamadı.' });
  }
});

export default router;

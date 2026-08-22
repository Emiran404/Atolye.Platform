// @ts-nocheck
const COLLECTION_TYPES = {
  students: 'array',
  teachers: 'array',
  exams: 'array',
  submissions: 'array',
  notifications: 'array',
  schedules: 'array',
  classes: 'array',
  reports: 'array',
  settings: 'object'
};

export const normalizeBackupData = (payload) => {
  let parsedPayload = payload;

  // Bazı eski istemciler JSON dosyasının içeriğini istek gövdesinde metin
  // olarak gönderiyordu. Mevcut nesne biçimlerinin yanında bunu da kabul et.
  for (let depth = 0; depth < 3 && typeof parsedPayload === 'string'; depth += 1) {
    try {
      parsedPayload = JSON.parse(parsedPayload.replace(/^\uFEFF/, '').trim());
    } catch (_) {
      throw new Error('Geçersiz JSON yedek biçimi.');
    }
  }

  // API yanıtı ({ success, backup }), indirilen yedek ({ data }) ve doğrudan
  // koleksiyon nesnesi biçimlerini geriye dönük uyumlu şekilde aç.
  let data = parsedPayload;
  for (let depth = 0; depth < 3; depth += 1) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) break;
    if (data.backup !== undefined) {
      data = data.backup;
      continue;
    }
    if (data.data !== undefined) {
      data = data.data;
      continue;
    }
    break;
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Geçersiz JSON yedek biçimi.');
  }

  const presentKeys = Object.keys(COLLECTION_TYPES).filter((key) => data[key] !== undefined);
  if (presentKeys.length === 0) {
    throw new Error('Yedekte geri yüklenecek platform verisi bulunamadı.');
  }

  for (const key of presentKeys) {
    const expectedType = COLLECTION_TYPES[key];
    const value = data[key];
    const valid = expectedType === 'array'
      ? Array.isArray(value)
      : value !== null && typeof value === 'object' && !Array.isArray(value);
    if (!valid) throw new Error(`Yedekteki ${key} verisi geçersiz.`);
  }

  return data;
};

export const restoreBackupData = (payload, getData, setData) => {
  const data = normalizeBackupData(payload);
  let restoredCollections = 0;

  for (const key of Object.keys(COLLECTION_TYPES)) {
    if (data[key] === undefined) continue;
    if (setData(key, data[key]) !== true) {
      throw new Error(`${key} verisi veritabanına yazılamadı.`);
    }
    restoredCollections += 1;
  }

  return restoredCollections;
};

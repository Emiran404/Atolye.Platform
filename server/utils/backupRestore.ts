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
  const data = payload?.backup?.data ?? payload?.data ?? payload;
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
  const currentSettings = getData('settings') || {};
  let restoredCollections = 0;

  for (const key of Object.keys(COLLECTION_TYPES)) {
    if (data[key] === undefined) continue;
    const value = key === 'settings'
      ? { ...data.settings, dbMigrated: currentSettings.dbMigrated === true }
      : data[key];
    if (setData(key, value) !== true) {
      throw new Error(`${key} verisi veritabanına yazılamadı.`);
    }
    restoredCollections += 1;
  }

  return restoredCollections;
};

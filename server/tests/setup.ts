// @ts-nocheck
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { beforeAll, afterAll, afterEach } from 'vitest';
import * as storage from '../utils/storage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dataPath = join(__dirname, '../../server/data');

// Test veritabanı dosyasının yolu
const testDbPath = join(dataPath, 'atolye_test.db');
const testSettingsPath = join(dataPath, 'settings_test.json');

beforeAll(() => {
  // Testlere başlamadan önce NODE_ENV'in test olduğundan emin olun
  process.env.NODE_ENV = 'test';
  
  // Önceki testlerden kalma dosyaları temizle
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
  if (fs.existsSync(testSettingsPath)) {
    fs.unlinkSync(testSettingsPath);
  }
  
  // Test için başlangıç durumunu ayarla
  storage.setData('settings', { systemName: 'Test Platform' });
  storage.setData('teachers', []);
  storage.setData('students', []);
  storage.setData('exams', []);
  storage.setData('telemetry', []);
});

afterAll(() => {
  // Testler bitince test dosyalarını temizle
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
  if (fs.existsSync(testSettingsPath)) {
    fs.unlinkSync(testSettingsPath);
  }
});

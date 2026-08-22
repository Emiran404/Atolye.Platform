// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { addLog, getLogs } from '../utils/logger.js';
import * as storage from '../utils/storage.js';

vi.mock('../utils/storage.js', () => {
  let store = {};
  return {
    getData: (key) => store[key],
    setData: (key, value) => { store[key] = value; },
  };
});

describe('Logger Utility', () => {
  beforeEach(() => {
    // Testlerden önce logları temizle
    storage.setData('logs', []);
  });

  it('should add a new log successfully', () => {
    const logData = {
      type: 'login',
      userId: 'user123',
      userName: 'Test User',
      role: 'student',
      action: 'Sisteme giriş yaptı',
      details: { ip: '127.0.0.1' }
    };

    const newLog = addLog(logData);

    expect(newLog).toBeDefined();
    expect(newLog.id).toBeDefined();
    expect(newLog.timestamp).toBeDefined();
    expect(newLog.type).toBe('login');
    expect(newLog.userId).toBe('user123');
    expect(newLog.userName).toBe('Test User');
    expect(newLog.role).toBe('student');
    expect(newLog.action).toBe('Sisteme giriş yaptı');
    expect(newLog.details).toEqual({ ip: '127.0.0.1' });

    const logs = getLogs();
    expect(logs.length).toBe(1);
    expect(logs[0].id).toBe(newLog.id);
  });

  it('should use default values if some fields are missing', () => {
    const logData = { action: 'Sistem başlatıldı' };

    const newLog = addLog(logData);

    expect(newLog.type).toBe('system');
    expect(newLog.userId).toBe('system');
    expect(newLog.userName).toBe('System');
    expect(newLog.role).toBe('system');
    expect(newLog.details).toEqual({});
  });

  it('should not exceed MAX_LOGS limit', { timeout: 15000 }, () => {
    // MAX_LOGS = 5000 in logger.ts
    // 5005 log ekleyelim
    for (let i = 0; i < 5005; i++) {
      addLog({ action: `Log ${i}` });
    }

    const logs = getLogs();

    // Toplam log sayısı 5000'i geçmemeli
    expect(logs.length).toBe(5000);

    // En yeni loglar en başta olmalı (unshift yapılıyor),
    // dolayısıyla en son eklenen 5004. log başta olmalı.
    expect(logs[0].action).toBe('Log 5004');
    // Ve en eski olan 'Log 0' ila 'Log 4' silinmiş olmalı
    expect(logs[4999].action).toBe('Log 5');
  });
});

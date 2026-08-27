// @ts-nocheck
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { describe, expect, it } from 'vitest';
import { createDatabaseBackup, getData, getDbStatus, restoreDatabaseBackup, setData } from '../utils/storage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dataPath = join(__dirname, '../data');

describe('SQLite storage', () => {
  it('starts directly in ready SQLite mode', () => {
    expect(getDbStatus()).toEqual({ dbType: 'sqlite', ready: true });
  });

  it('reads and writes collections without creating JSON files', () => {
    const key = 'sqlite_only_test';
    const jsonPath = join(dataPath, `${key}_test.json`);

    expect(setData(key, { active: true })).toBe(true);
    expect(getData(key)).toEqual({ active: true });
    expect(fs.existsSync(jsonPath)).toBe(false);
  });

  it('creates and restores a native SQLite backup', async () => {
    const backupPath = join(dataPath, 'storage-backup-test.db');
    if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);

    setData('backup_roundtrip_test', { state: 'before' });
    await createDatabaseBackup(backupPath);
    setData('backup_roundtrip_test', { state: 'after' });

    expect(restoreDatabaseBackup(backupPath)).toBeGreaterThan(0);
    expect(getData('backup_roundtrip_test')).toEqual({ state: 'before' });
    fs.unlinkSync(backupPath);
  });
});

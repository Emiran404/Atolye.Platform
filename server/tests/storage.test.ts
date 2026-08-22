// @ts-nocheck
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { describe, expect, it } from 'vitest';
import { getData, getDbStatus, setData } from '../utils/storage.js';

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
});

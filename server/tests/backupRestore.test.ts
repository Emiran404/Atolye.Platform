// @ts-nocheck
import { describe, expect, it, vi } from 'vitest';
import { normalizeBackupData, restoreBackupData } from '../utils/backupRestore.js';

describe('JSON backup restore', () => {
  it.each([
    { students: [] },
    { data: { students: [] } },
    { backup: { data: { students: [] } } }
  ])('accepts supported backup shapes', (payload) => {
    expect(normalizeBackupData(payload)).toEqual({ students: [] });
  });

  it('keeps SQLite migration enabled while restoring settings', () => {
    const setData = vi.fn(() => true);
    restoreBackupData(
      { data: { settings: { schoolName: 'Atölye', dbMigrated: false } } },
      () => ({ dbMigrated: true }),
      setData
    );

    expect(setData).toHaveBeenCalledWith('settings', {
      schoolName: 'Atölye',
      dbMigrated: true
    });
  });

  it('reports a database write failure instead of returning success', () => {
    expect(() => restoreBackupData(
      { students: [] },
      () => ({}),
      () => false
    )).toThrow('students verisi veritabanına yazılamadı.');
  });

  it('rejects malformed collection data', () => {
    expect(() => normalizeBackupData({ students: {} }))
      .toThrow('Yedekteki students verisi geçersiz.');
  });
});

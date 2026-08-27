// @ts-nocheck
import { useEffect, useState } from 'react';
import { Download, RefreshCw, X } from 'lucide-react';

export default function ElectronUpdateNotice() {
  const electronAPI = window.electronAPI;
  const [status, setStatus] = useState({ state: 'idle' });
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!electronAPI?.onUpdateStatus) return;

    electronAPI.getUpdateStatus?.().then(initial => {
      if (initial) setStatus(initial);
    }).catch(() => {});

    return electronAPI.onUpdateStatus(next => {
      setStatus(next);
      if (next.state === 'available' || next.state === 'downloaded') setDismissed(false);
    });
  }, [electronAPI]);

  if (!electronAPI || dismissed || ['idle', 'checking'].includes(status.state)) return null;

  const isReady = status.state === 'downloaded';
  const isError = status.state === 'error';
  const percent = Math.max(0, Math.min(100, Number(status.percent) || 0));

  const install = async () => {
    const result = await electronAPI.installUpdate();
    if (!result?.success) setStatus({ state: 'error', message: result?.error || 'Kurulum başlatılamadı.' });
  };

  return (
    <aside style={styles.container} role="status" aria-live="polite">
      <button onClick={() => setDismissed(true)} aria-label="Bildirimi kapat" style={styles.close}>
        <X size={16} />
      </button>
      <div style={styles.header}>
        {isReady ? <RefreshCw size={20} color="#2563eb" /> : <Download size={20} color={isError ? '#dc2626' : '#2563eb'} />}
        <strong>{isError ? 'Güncelleme hatası' : isReady ? `v${status.version || ''} kurulmaya hazır` : `Yeni güncelleme mevcut${status.version ? `: v${status.version}` : ''}`}</strong>
      </div>

      {!isReady && !isError && (
        <>
          <p style={styles.text}>Güncelleme öğretmen sunucusundan indiriliyor.</p>
          <div style={styles.track}><div style={{ ...styles.progress, width: `${percent}%` }} /></div>
          <span style={styles.percent}>%{percent}</span>
        </>
      )}

      {isError && <p style={styles.error}>{status.message || 'Güncelleme indirilemedi.'}</p>}

      {isReady && (
        <div style={styles.actions}>
          <button onClick={() => setDismissed(true)} style={styles.secondary}>Daha Sonra</button>
          <button onClick={install} style={styles.primary}>Yeniden Başlat ve Kur</button>
        </div>
      )}
    </aside>
  );
}

const styles = {
  container: { position: 'fixed', right: 20, bottom: 20, zIndex: 100000, width: 340, padding: 18, borderRadius: 14, background: '#fff', color: '#111827', border: '1px solid #e5e7eb', boxShadow: '0 16px 40px rgba(15,23,42,.18)', fontFamily: 'inherit' },
  close: { position: 'absolute', right: 10, top: 10, border: 0, background: 'transparent', color: '#6b7280', cursor: 'pointer', padding: 4 },
  header: { display: 'flex', alignItems: 'center', gap: 10, paddingRight: 22, fontSize: 15 },
  text: { margin: '12px 0 8px', color: '#6b7280', fontSize: 13 },
  track: { height: 7, overflow: 'hidden', borderRadius: 20, background: '#e5e7eb' },
  progress: { height: '100%', borderRadius: 20, background: '#2563eb', transition: 'width .25s ease' },
  percent: { display: 'block', marginTop: 6, textAlign: 'right', color: '#4b5563', fontSize: 12 },
  error: { margin: '12px 0 0', color: '#b91c1c', fontSize: 13, lineHeight: 1.45 },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 },
  secondary: { padding: '9px 12px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: '#374151', cursor: 'pointer', fontWeight: 600 },
  primary: { padding: '9px 12px', borderRadius: 8, border: 0, background: '#2563eb', color: '#fff', cursor: 'pointer', fontWeight: 600 }
};

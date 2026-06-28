import React, { useState, useEffect } from 'react';
import { 
  Monitor, 
  Settings, 
  Save, 
  RefreshCcw, 
  CheckCircle2, 
  AlertTriangle, 
  Network, 
  Server, 
  Key, 
  Info as InfoIcon,
  Activity,
  ShieldAlert
} from 'lucide-react';
import { TeacherLayout } from '../../components/layouts';
import { useToast } from '../../components/ui/Toast';
import { Button } from '../../components/ui';
import { polyosApi } from '../../services/api';

const styles = {
  container: {
    maxWidth: '1000px',
    margin: '0 auto',
    padding: '32px'
  },
  header: {
    marginBottom: '32px'
  },
  title: {
    fontSize: '28px',
    fontWeight: '700',
    color: 'var(--color-text-primary)',
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  subtitle: {
    fontSize: '15px',
    color: 'var(--color-text-muted)',
    marginTop: '8px'
  },
  card: {
    backgroundColor: 'var(--color-surface)',
    borderRadius: '16px',
    border: '1px solid var(--color-border)',
    overflow: 'hidden',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    marginBottom: '24px'
  },
  cardHeader: {
    padding: '24px',
    borderBottom: '1px solid #f1f5f9',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fafbfc'
  },
  cardTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: 'var(--color-text-primary)',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  cardContent: {
    padding: '24px'
  },
  inputGroup: {
    marginBottom: '20px'
  },
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '500',
    color: 'var(--color-text-secondary)',
    marginBottom: '8px'
  },
  input: {
    width: '100%',
    padding: '12px 16px',
    borderRadius: '10px',
    border: '1px solid var(--color-border)',
    fontSize: '14px',
    transition: 'all 0.2s',
    outline: 'none',
    backgroundColor: 'var(--color-surface)'
  },
  helperText: {
    fontSize: '12px',
    color: '#94a3b8',
    marginTop: '6px'
  },
  switchContainer: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: 'var(--color-background)',
    padding: '16px 20px',
    borderRadius: '12px',
    border: '1px solid var(--color-border)',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  switchLabel: {
    flex: 1,
    fontSize: '15px',
    fontWeight: '600',
    color: 'var(--color-text-primary)'
  },
  switchToggle: (enabled) => ({
    width: '48px',
    height: '24px',
    borderRadius: '12px',
    backgroundColor: enabled ? '#10b981' : '#cbd5e1',
    position: 'relative',
    transition: 'all 0.3s'
  }),
  switchCircle: (enabled) => ({
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    backgroundColor: '#fff',
    position: 'absolute',
    top: '2px',
    left: enabled ? '26px' : '2px',
    transition: 'all 0.3s',
    boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
  }),
  alert: {
    display: 'flex',
    gap: '12px',
    padding: '16px',
    borderRadius: '12px',
    marginBottom: '24px',
    fontSize: '14px'
  },
  infoAlert: {
    backgroundColor: '#eff6ff',
    border: '1px solid #bfdbfe',
    color: '#1e40af'
  },
  successAlert: {
    backgroundColor: '#ecfdf5',
    border: '1px solid #a7f3d0',
    color: '#065f46'
  },
  warningAlert: {
    backgroundColor: '#fffbeb',
    border: '1px solid #fde68a',
    color: '#92400e'
  }
};

const PolyosSettings = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('untested'); // untested, success, failed
  const [activeClients, setActiveClients] = useState([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  
  const [settings, setSettings] = useState({
    enabled: false,
    serverUrl: 'http://localhost:8080',
    secretToken: 'polyos-secure-token'
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await polyosApi.getSettings();
      if (res.success && res.settings) {
        setSettings({
          enabled: res.settings.enabled === true || res.settings.enabled === 'true',
          serverUrl: res.settings.serverUrl || 'http://localhost:8080',
          secretToken: res.settings.secretToken || 'polyos-secure-token'
        });
        
        // Settings are loaded, if enabled also load clients
        if (res.settings.enabled) {
          fetchClients();
        }
      }
    } catch (err) {
      toast.error('PolyOS Lab ayarları yüklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  const fetchClients = async () => {
    setClientsLoading(true);
    try {
      const res = await polyosApi.getClients();
      if (res.success && Array.isArray(res.clients)) {
        setActiveClients(res.clients);
        setConnectionStatus('success');
      } else {
        setConnectionStatus('failed');
      }
    } catch {
      setConnectionStatus('failed');
    } finally {
      setClientsLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaveLoading(true);
    try {
      const res = await polyosApi.saveSettings(settings);
      if (res.success) {
        toast.success('PolyOS Lab entegrasyon ayarları başarıyla kaydedildi.');
        if (settings.enabled) {
          fetchClients();
        } else {
          setActiveClients([]);
          setConnectionStatus('untested');
        }
      } else {
        toast.error(res.error || 'Ayarlar kaydedilirken hata oluştu.');
      }
    } catch {
      toast.error('Sunucuyla iletişim kurulamadı.');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setTestLoading(true);
    setConnectionStatus('testing');
    try {
      const res = await polyosApi.testConnection(settings.serverUrl);
      if (res.success) {
        setConnectionStatus('success');
        toast.success(`Bağlantı başarılı! Lab'da aktif ${res.clientCount} istemci bulundu.`);
        if (settings.enabled) {
          fetchClients();
        }
      } else {
        setConnectionStatus('failed');
        toast.error(res.error || 'Bağlantı testi başarısız.');
      }
    } catch {
      setConnectionStatus('failed');
      toast.error('PolyOS Lab sunucusuna bağlanılamadı.');
    } finally {
      setTestLoading(false);
    }
  };

  if (loading) {
    return (
      <TeacherLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <RefreshCcw className="animate-spin text-blue-600" size={32} />
        </div>
      </TeacherLayout>
    );
  }

  return (
    <TeacherLayout>
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <h1 style={styles.title}>
            <Monitor className="text-blue-600 w-8 h-8" />
            PolyOS Lab Entegrasyonu
          </h1>
          <p style={styles.subtitle}>
            Sınav Gönderme Platformu ile PolyOS Lab (Bilgisayar Laboratuvarı Yönetim Sistemi) arasındaki entegrasyonu buradan yapılandırabilirsiniz.
          </p>
        </div>

        {/* Info Alert */}
        <div style={{ ...styles.alert, ...styles.infoAlert }}>
          <InfoIcon size={20} className="shrink-0" />
          <div>
            <span className="font-bold">Nasıl Çalışır?</span>
            <p className="mt-1 text-sm leading-relaxed text-blue-800">
              Bu entegrasyon aktif olduğunda, öğretmenler sınav oluştururken "PolyOS Lab'a Bildirim Gönder" seçeneğini işaretleyebilir. Sınav zamanı yaklaştığında veya başladığında, laboratuvarda o an açık olan öğrenci bilgisayarlarına masaüstü bildirimleri (`zenity` / `notify-send` üzerinden) otomatik olarak gönderilir.
            </p>
          </div>
        </div>

        <form onSubmit={handleSave}>
          {/* Card: Connection Settings */}
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <div style={styles.cardTitle}>
                <Settings size={20} className="text-slate-500" />
                Bağlantı ve Kimlik Doğrulama
              </div>
              <div className="flex items-center gap-2">
                {connectionStatus === 'success' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                    <CheckCircle2 size={12} /> Bağlantı Var
                  </span>
                )}
                {connectionStatus === 'failed' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
                    <ShieldAlert size={12} /> Bağlantı Koptu
                  </span>
                )}
              </div>
            </div>
            
            <div style={styles.cardContent}>
              {/* Enable Toggle */}
              <div style={styles.inputGroup}>
                <div 
                  style={styles.switchContainer}
                  onClick={() => setSettings(prev => ({ ...prev, enabled: !prev.enabled }))}
                >
                  <div style={styles.switchLabel}>Entegrasyonu Aktifleştir</div>
                  <div style={styles.switchToggle(settings.enabled)}>
                    <div style={styles.switchCircle(settings.enabled)} />
                  </div>
                </div>
              </div>

              {/* Server URL */}
              <div style={styles.inputGroup}>
                <label style={styles.label}>
                  <Server size={14} className="inline mr-2 text-slate-400" />
                  PolyOS Lab Sunucu Adresi (Server URL)
                </label>
                <input
                  type="text"
                  style={styles.input}
                  value={settings.serverUrl}
                  onChange={e => setSettings(prev => ({ ...prev, serverUrl: e.target.value }))}
                  placeholder="http://localhost:8080"
                  disabled={!settings.enabled}
                  required
                />
                <p style={styles.helperText}>
                  PolyOS Lab Go sunucusunun çalıştığı adres. Aynı makinedeyse <code>http://localhost:8080</code> olarak bırakın.
                </p>
              </div>

              {/* Security Token */}
              <div style={styles.inputGroup}>
                <label style={styles.label}>
                  <Key size={14} className="inline mr-2 text-slate-400" />
                  Güvenlik Anahtarı (Token)
                </label>
                <input
                  type="password"
                  style={styles.input}
                  value={settings.secretToken}
                  onChange={e => setSettings(prev => ({ ...prev, secretToken: e.target.value }))}
                  placeholder="polyos-secure-token"
                  disabled={!settings.enabled}
                  required
                />
                <p style={styles.helperText}>
                  PolyOS Lab ile güvenli iletişim kurmak için kullanılan gizli belirteç.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 justify-end mt-8">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTestConnection}
                  disabled={testLoading || !settings.enabled}
                >
                  {testLoading ? (
                    <>
                      <RefreshCcw className="animate-spin mr-2" size={16} />
                      Test Ediliyor...
                    </>
                  ) : (
                    <>
                      <Network className="mr-2" size={16} />
                      Bağlantıyı Test Et
                    </>
                  )}
                </Button>
                
                <Button
                  type="submit"
                  variant="primary"
                  disabled={saveLoading}
                >
                  <Save className="mr-2" size={16} />
                  Ayarları Kaydet
                </Button>
              </div>
            </div>
          </div>
        </form>

        {/* Card: Active Clients List */}
        {settings.enabled && (
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <div style={styles.cardTitle}>
                <Activity size={20} className="text-emerald-500" />
                Aktif Lab İstemcileri ({activeClients.length})
              </div>
              <button 
                onClick={fetchClients}
                disabled={clientsLoading}
                className="p-1 rounded hover:bg-slate-100 transition-colors text-slate-500"
                title="Listeyi Yenile"
              >
                <RefreshCcw size={16} className={clientsLoading ? 'animate-spin' : ''} />
              </button>
            </div>
            
            <div style={styles.cardContent}>
              {activeClients.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <Monitor size={48} className="mx-auto mb-3 opacity-30" />
                  <p>PolyOS Lab sistemine bağlı aktif öğrenci bilgisayarı bulunamadı.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 uppercase text-[11px] tracking-wider">
                        <th className="pb-3 font-semibold">Bilgisayar Adı (Hostname)</th>
                        <th className="pb-3 font-semibold">İstemci ID (MAC)</th>
                        <th className="pb-3 font-semibold">Sürüm</th>
                        <th className="pb-3 font-semibold">Durum</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activeClients.map((client) => (
                        <tr key={client.id} className="text-slate-700">
                          <td className="py-3 font-semibold text-slate-800">{client.hostname}</td>
                          <td className="py-3 font-mono text-xs text-slate-500">{client.mac || client.id}</td>
                          <td className="py-3 text-slate-500">{client.version || '1.0.0'}</td>
                          <td className="py-3">
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                              <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Aktif
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </TeacherLayout>
  );
};

export default PolyosSettings;

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Settings, Shield, Users, Lock, Unlock, Save, UserCheck, UserX, Trash2, Mail, BarChart3, HardDrive, FileText, Clock, Download, Database, Key, AlertTriangle, RefreshCcw, CheckCircle2, Info as InfoIcon, ClipboardList, Activity, Terminal, Server, Power, RefreshCw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { TeacherLayout } from '../../components/layouts';
import { useToast } from '../../components/ui/Toast';
import { Button, ConfirmModal } from '../../components/ui';
import { useAuthStore } from '../../store/authStore';
import { resetAllData } from '../../utils/initData';
import { t } from '../../utils/i18n';
import { 
  settingsApi, 
  userApi, 
  systemApi, 
  statsApi, 
  notificationApi, 
  backupApi,
  classApi,
  logsApi,
  getAuthToken
} from '../../services/api';

const PlatformManagement = () => {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // URL'den tab parametresini al (varsayılan: registration)
  const initialTab = searchParams.get('tab') || 'registration';
  const [activeTab, setActiveTab] = useState(initialTab); // registration, users, bulk, stats, backup, update, reset, audit

  // İşlem Geçmişi (Logs)
  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logFilterType, setLogFilterType] = useState('all');

  // Platform ayarları
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [teacherRegistrationEnabled, setTeacherRegistrationEnabled] = useState(true);
  const [telemetryEnabled, setTelemetryEnabled] = useState(true);
  const [allowedClasses, setAllowedClasses] = useState([]);
  const [classes, setClasses] = useState([]);
  const [newClassName, setNewClassName] = useState('');
  const [editingClass, setEditingClass] = useState(null);
  const [newNameForEdit, setNewNameForEdit] = useState('');

  // Kullanıcı yönetimi
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  // İstatistikler
  const [stats, setStats] = useState(null);

  // Toplu bildirim state'leri
  const [bulkTarget, setBulkTarget] = useState('all-students');
  const [bulkClass, setBulkClass] = useState('9-A');
  const [bulkTitle, setBulkTitle] = useState('');
  const [bulkMessage, setBulkMessage] = useState('');
  const [sending, setSending] = useState(false);

  // Yedekleme state'leri
  const [includePhotos, setIncludePhotos] = useState(false);
  const [backupInProgress, setBackupInProgress] = useState(false);

  // Otomatik yedekleme ve yerel yedek listesi state'leri
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
  const [autoBackupInterval, setAutoBackupInterval] = useState(24);
  const [autoBackupIncludePhotos, setAutoBackupIncludePhotos] = useState(false);
  const [autoBackupWizardConfigured, setAutoBackupWizardConfigured] = useState(false);
  const [lastAutoBackupTime, setLastAutoBackupTime] = useState(null);
  const [localBackups, setLocalBackups] = useState([]);
  const [loadingLocalBackups, setLoadingLocalBackups] = useState(false);

  // Veri sıfırlama error state
  const [resetError, setResetError] = useState('');

  // Sistem Konsolu state'leri
  const [systemLogs, setSystemLogs] = useState([]);
  const [systemMetrics, setSystemMetrics] = useState(null);
  const [consoleSocket, setConsoleSocket] = useState(null);
  const consoleEndRef = React.useRef(null);

  useEffect(() => {
    if (activeTab === 'system' && consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [systemLogs, activeTab]);

  useEffect(() => {
    if (activeTab === 'system' && !consoleSocket) {
      import('socket.io-client').then(({ io }) => {
        const url = window.location.protocol + '//' + window.location.hostname + ':3002';
        const socket = io(url);
        
        socket.on('connect', () => {
          // GÜVENLİK: Canlı sistem konsolu/metrikleri hassas veri içerir; odaya
          // yalnızca geçerli öğretmen token'ı ile katılınabilir.
          socket.emit('join_teachers_room', getAuthToken());
          setSystemLogs(prev => [...prev, { type: 'success', message: 'Sunucu bağlantısı kuruldu.', timestamp: new Date().toISOString() }]);
        });

        socket.on('system_log', (log) => {
          setSystemLogs(prev => [...prev, log].slice(-100));
        });

        socket.on('system_metrics', (metrics) => {
          setSystemMetrics(metrics);
        });

        socket.on('disconnect', () => {
          setSystemLogs(prev => [...prev, { type: 'error', message: 'Sunucu bağlantısı koptu. Yeniden bağlanılıyor...', timestamp: new Date().toISOString() }]);
        });

        setConsoleSocket(socket);
      });
    } else if (activeTab !== 'system' && consoleSocket) {
      consoleSocket.disconnect();
      setConsoleSocket(null);
    }
    
    return () => {
      if (consoleSocket && activeTab !== 'system') {
        consoleSocket.disconnect();
      }
    };
  }, [activeTab]);

  const handleSystemControl = (action) => {
    const isRestart = action === 'restart';
    setConfirmModal({
      isOpen: true,
      title: isRestart ? 'Sistemi Yeniden Başlat' : 'Sistemi Kapat',
      message: isRestart ? 'Sistemi yeniden başlatmak istediğinize emin misiniz? Arka plan araçlarınız ayarlı değilse sistem tekrar açılmayabilir.' : 'Sistemi kapatmak istediğinize emin misiniz? Sunucuya fiziksel erişiminiz yoksa geri açamazsınız.',
      confirmText: isRestart ? 'Yeniden Başlat' : 'Kapat',
      type: 'danger',
      onConfirm: async () => {
        try {
          const res = await systemApi.sendSystemControl(action);
          if (res?.success) {
            toast.success(res.message);
          } else {
            toast.error('İşlem başarısız!');
          }
        } catch(e) {
          toast.error('Sunucuya ulaşılamadı.');
        }
      }
    });
  };

  const renderSystemConsoleTab = () => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px', alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <Activity size={24} style={{ color: '#0ea5e9' }} />
            <h2 style={styles.cardTitle}>Sistem Durumu</h2>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-text-secondary)' }}>CPU Yükü</span>
                <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--color-text-primary)' }}>
                  {systemMetrics?.cpu ? systemMetrics.cpu.toFixed(2) : '0.00'}
                </span>
              </div>
              <div style={{ height: '8px', background: 'var(--color-bg-secondary)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min((systemMetrics?.cpu || 0) * 10, 100)}%`, background: '#0ea5e9', transition: 'width 0.5s' }} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-text-secondary)' }}>RAM Kullanımı (Sunucu Toplam)</span>
                <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--color-text-primary)' }}>
                  {systemMetrics ? `${((systemMetrics.totalMem - systemMetrics.freeMem) / 1024 / 1024 / 1024).toFixed(2)} GB / ${(systemMetrics.totalMem / 1024 / 1024 / 1024).toFixed(2)} GB` : '0 / 0'}
                </span>
              </div>
              <div style={{ height: '8px', background: 'var(--color-bg-secondary)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${systemMetrics ? ((systemMetrics.totalMem - systemMetrics.freeMem) / systemMetrics.totalMem) * 100 : 0}%`, background: '#8b5cf6', transition: 'width 0.5s' }} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-text-secondary)' }}>Uygulama Bellek (Node.js)</span>
                <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--color-text-primary)' }}>
                  {systemMetrics?.processMem ? `${(systemMetrics.processMem / 1024 / 1024).toFixed(2)} MB` : '0 MB'}
                </span>
              </div>
              <div style={{ height: '8px', background: 'var(--color-bg-secondary)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min((systemMetrics?.processMem || 0) / (1024 * 1024 * 1024) * 100, 100)}%`, background: '#10b981', transition: 'width 0.5s' }} />
              </div>
            </div>

            <div style={{ background: 'var(--color-bg-secondary)', padding: '12px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>Çalışma Süresi:</span>
              <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-text-primary)' }}>
                {systemMetrics ? `${Math.floor(systemMetrics.uptime / 3600)}sa ${Math.floor((systemMetrics.uptime % 3600) / 60)}dk ${Math.floor(systemMetrics.uptime % 60)}sn` : '0sa 0dk 0sn'}
              </span>
            </div>
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <Server size={24} style={{ color: '#f59e0b' }} />
            <h2 style={styles.cardTitle}>Sunucu Kontrolü</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              onClick={() => handleSystemControl('restart')}
              style={{
                width: '100%', padding: '12px', borderRadius: '8px', background: '#f59e0b', color: 'white',
                border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                fontWeight: '600', cursor: 'pointer'
              }}
            >
              <RefreshCw size={18} /> Yeniden Başlat
            </button>
            <button
              onClick={() => handleSystemControl('shutdown')}
              style={{
                width: '100%', padding: '12px', borderRadius: '8px', background: '#dc2626', color: 'white',
                border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                fontWeight: '600', cursor: 'pointer'
              }}
            >
              <Power size={18} /> Sistemi Kapat
            </button>
          </div>
        </div>
      </div>

      <div style={{ ...styles.card, height: '600px', display: 'flex', flexDirection: 'column', padding: '0', overflow: 'hidden', background: '#0f172a', border: '1px solid #1e293b' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: '12px', background: '#020617' }}>
          <Terminal size={20} style={{ color: '#10b981' }} />
          <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#f8fafc', margin: 0 }}>Canlı Konsol</h2>
        </div>
        <div style={{ flex: 1, padding: '16px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '13px', lineHeight: '1.5' }}>
          {systemLogs.length === 0 ? (
            <div style={{ color: '#64748b', fontStyle: 'italic' }}>Konsol bekleniyor...</div>
          ) : (
            systemLogs.map((log, index) => {
              let color = '#f8fafc';
              if (log.type === 'error') color = '#ef4444';
              else if (log.type === 'warn') color = '#f59e0b';
              else if (log.type === 'success') color = '#10b981';
              else if (log.type === 'info') color = '#38bdf8';

              return (
                <div key={index} style={{ marginBottom: '4px', wordBreak: 'break-all' }}>
                  <span style={{ color: '#64748b', marginRight: '12px' }}>[{new Date(log.timestamp).toLocaleTimeString('tr-TR')}]</span>
                  <span style={{ color }}>{log.message}</span>
                </div>
              );
            })
          )}
          <div ref={consoleEndRef} />
        </div>
      </div>
    </div>
  );

  // Masaüstü Güncellemeleri
  const [autoDownloadClientUpdates, setAutoDownloadClientUpdates] = useState(true);
  const [clientUpdateChannel, setClientUpdateChannel] = useState('stable');
  const [clientUpdatesUrl, setClientUpdatesUrl] = useState('https://github.com/PolyOS-Team/Atolye.Platform/releases/latest/download');

  // Güncelleme state'leri
  const [currentVersion, setCurrentVersion] = useState('1.0.0');
  const [dbStatus, setDbStatus] = useState({ dbType: 'sqlite', ready: false });
  const [updateHistory, setUpdateHistory] = useState([]);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [availableUpdate, setAvailableUpdate] = useState(null);
  const [installingUpdate, setInstallingUpdate] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(0);
  const [downloadedUpdates, setDownloadedUpdates] = useState([]);

  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Tamam',
    onConfirm: () => { },
    type: 'warning'
  });

  const handleResetAllData = () => {
    setConfirmModal({
      isOpen: true,
      title: 'TÜM VERİLERİ SİL?',
      message: '⚠️ DİKKAT: TÜM VERİLER SİLİNECEK!\n\nÖğrenci kayıtları, öğretmen kayıtları, sınavlar ve teslimler dahil tüm veriler kalıcı olarak silinecek.\n\nBu işlem geri alınamaz!\n\nDevam etmek istiyor musunuz?',
      confirmText: 'Evet, Devam Et',
      type: 'danger',
      onConfirm: () => {
        // İkinci onay modalı (Kilitli dosyalar uyarısı) - setTimeout ile gecikme ekliyoruz ki ilk modal kapansın
        setTimeout(() => {
          setConfirmModal({
            isOpen: true,
            title: '🔐 SON GÜVENLİK ADIMI',
            message: `⚠️ KRİTİK BİLGİLENDİRME:

Sistem sıfırlama işlemi sırasında, bazı dosyalar Windows (OneDrive/Gezgin) veya Vite tarafından "Kilitli" tutulduğu için otomatik silinemeyebilir.

Sıfırlama bittikten sonra tam temizlik için:
• Windows: Kök dizindeki "cleanup_windows.bat" dosyasını çalıştırın.
• Linux/Pardus: Kök dizindeki "cleanup_linux.sh" scriptini kullanın.

Bu araçlar kilitli süreçleri sonlandırıp tüm verileri güvenle temizleyecektir.

HAZIR MISINIZ? Bu işlem tüm sistemi Fabrika Ayarlarına döndürecektir. 👋`,
            confirmText: 'Sistemi Sıfırla ve Temizle',
            type: 'danger',
            onConfirm: async () => {
              try {
                setSaving(true);
                const result = await resetAllData();

                if (result.success === false) {
                  setResetError('Bazı veriler sıfırlanamadı. Lütfen sunucuyu kontrol edin.');
                  toast.error('Bazı veriler sıfırlanamadı. Lütfen sunucuyu kontrol edin.');
                }

                // Kullanıcıyı logout yap ve ana sayfaya yönlendir
                setTimeout(() => {
                  window.location.href = '/';
                }, 500);
              } catch (error) {
                console.error('Veri sıfırlama hatası:', error);
                setResetError('Veri sıfırlama sırasında bir hata oluştu.');
                toast.error('Veri sıfırlama sırasında bir hata oluştu.');
              } finally {
                setSaving(false);
              }
            }
          });
        }, 100);
      }
    });
  };


  useEffect(() => {
    loadSettings();
    if (activeTab === 'users') loadUsers();
    if (activeTab === 'classes' || activeTab === 'registration') loadClasses();
    if (activeTab === 'stats') loadStats();
    if (activeTab === 'backup') loadLocalBackups();
    if (activeTab === 'audit') loadLogs();
    if (activeTab === 'update') {
      loadUpdateData();
      loadDownloadedUpdates();
      handleCheckUpdate(); // Otomatik kontrol et
    }
  }, [activeTab]);

  const loadLogs = async () => {
    setLoadingLogs(true);
    try {
      const data = await logsApi.getAll();
      if (data?.success) setLogs(data.logs || []);
    } catch (error) {
      console.error('Loglar yüklenemedi:', error);
      toast.error('İşlem geçmişi yüklenirken hata oluştu');
    }
    setLoadingLogs(false);
  };

  const loadUpdateData = async () => {
    setLoading(true);
    try {
      const vData = await systemApi.getVersion();
      const hData = await systemApi.getUpdates();

      if (vData?.success) setCurrentVersion(vData.version);
      if (hData?.success) setUpdateHistory(hData.updates);
    } catch (error) {
      console.error('Güncelleme verileri yüklenemedi:', error);
    }
    setLoading(false);
  };

  const loadDownloadedUpdates = async () => {
    try {
      const response = await fetch('/api/settings/downloaded-updates', {
        headers: {
          'Authorization': `Bearer ${useAuthStore.getState().token}`
        }
      });
      const data = await response.json();
      if (data?.success) {
        setDownloadedUpdates(data.files || []);
      }
    } catch (error) {
      console.error('İndirilen güncellemeler yüklenemedi:', error);
    }
  };

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
    setAvailableUpdate(null);
    try {
      const data = await systemApi.checkUpdate(true);
      
      // Sürüm bilgisini de tazeleyelim
      const vData = await systemApi.getVersion();
      if (vData?.success) setCurrentVersion(vData.version);

      if (data?.success && data.updateAvailable) {
        setAvailableUpdate(data);
        toast.info(`Yeni bir güncelleme bulundu: v${data.latestVersion}`);
      } else {
        toast.success('Sisteminiz güncel.');
      }
    } catch (error) {
      toast.error('Güncelleme kontrolü başarısız.');
    } finally {
      setCheckingUpdate(false);
    }
  };

  const handleInstallUpdate = async () => {
    if (!availableUpdate) return;

    setInstallingUpdate(true);
    setUpdateProgress(0);

    // Progress simülasyonu
    const intervals = [
      { p: 20, t: 1000, m: 'Yedek alınıyor...' },
      { p: 50, t: 2000, m: 'Dosyalar indiriliyor...' },
      { p: 80, t: 3000, m: 'Sistem dosyaları güncelleniyor...' },
      { p: 100, t: 1500, m: 'Tamamlanıyor...' }
    ];

    for (const step of intervals) {
      await new Promise(r => setTimeout(r, step.t));
      setUpdateProgress(step.p);
    }

    try {
      const data = await systemApi.installUpdate(
        availableUpdate.latestVersion,
        availableUpdate.customDescription
      );

      if (data?.success) {
        toast.success('Güncelleme başarıyla yüklendi! Sistem yeniden başlatılıyor...');
        setTimeout(() => window.location.reload(), 2000);
      } else {
        toast.error('Güncelleme sırasında hata oluştu.');
        setInstallingUpdate(false);
      }
    } catch (error) {
      toast.error('Geri yükleme hatası!');
      setInstallingUpdate(false);
    }
  };

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await settingsApi.get();
      if (data?.success && data.settings) {
        setRegistrationEnabled(data.settings.registrationEnabled || false);
        setTeacherRegistrationEnabled(data.settings.teacherRegistrationEnabled !== false);
        setTelemetryEnabled(data.settings.telemetryEnabled !== false);
        setAllowedClasses(data.settings.allowedClasses || []);
        setAutoBackupEnabled(data.settings.autoBackupEnabled || false);
        setAutoBackupInterval(data.settings.autoBackupInterval || 24);
        setAutoBackupIncludePhotos(data.settings.autoBackupIncludePhotos || false);
        setAutoBackupWizardConfigured(data.settings.autoBackupWizardConfigured || false);
        setLastAutoBackupTime(data.settings.lastAutoBackupTime || null);
        setAutoDownloadClientUpdates(data.settings.autoDownloadClientUpdates !== false);
        setClientUpdateChannel(data.settings.clientUpdateChannel === 'beta' ? 'beta' : 'stable');
        if (data.settings.clientUpdatesUrl) {
          setClientUpdatesUrl(data.settings.clientUpdatesUrl);
        }
      }
      
      try {
        const dbRes = await fetch('/api/settings/db-status');
        const dbData = await dbRes.json();
        if (dbData?.success) {
          setDbStatus({ dbType: dbData.dbType, ready: dbData.ready === true });
        }
      } catch (dbErr) {
        console.error('Veritabanı durumu alınamadı:', dbErr);
      }
    } catch (error) {
      console.error('Ayarlar yüklenemedi:', error);
    }
    setLoading(false);
  };

  const handleSaveSettings = async (newSettings = {}) => {
    setSaving(true);
    try {
      const settingsToSave = {
        registrationEnabled: newSettings.registrationEnabled !== undefined ? newSettings.registrationEnabled : registrationEnabled,
        teacherRegistrationEnabled: newSettings.teacherRegistrationEnabled !== undefined ? newSettings.teacherRegistrationEnabled : teacherRegistrationEnabled,
        telemetryEnabled: newSettings.telemetryEnabled !== undefined ? newSettings.telemetryEnabled : telemetryEnabled,
        allowedClasses: newSettings.allowedClasses !== undefined ? newSettings.allowedClasses : allowedClasses,
        autoBackupEnabled: newSettings.autoBackupEnabled !== undefined ? newSettings.autoBackupEnabled : autoBackupEnabled,
        autoBackupInterval: newSettings.autoBackupInterval !== undefined ? Number(newSettings.autoBackupInterval) : autoBackupInterval,
        autoBackupIncludePhotos: newSettings.autoBackupIncludePhotos !== undefined ? newSettings.autoBackupIncludePhotos : autoBackupIncludePhotos,
        autoBackupWizardConfigured: newSettings.autoBackupWizardConfigured !== undefined ? newSettings.autoBackupWizardConfigured : autoBackupWizardConfigured,
        autoDownloadClientUpdates: newSettings.autoDownloadClientUpdates !== undefined ? newSettings.autoDownloadClientUpdates : autoDownloadClientUpdates,
        clientUpdateChannel: newSettings.clientUpdateChannel !== undefined ? newSettings.clientUpdateChannel : clientUpdateChannel,
        clientUpdatesUrl: newSettings.clientUpdatesUrl !== undefined ? newSettings.clientUpdatesUrl : clientUpdatesUrl
      };

      const data = await settingsApi.update(settingsToSave);
      if (data?.success) {
        toast.success('Ayarlar kaydedildi');
      } else {
        toast.error('Ayarlar kaydedilemedi');
      }
    } catch (error) {
      toast.error('Bir hata oluştu');
      console.error('Kaydetme hatası:', error);
    }
    setSaving(false);
  };

  const handleCheckDesktopUpdates = async () => {
    setSaving(true);
    toast.info('Güncellemeler kontrol ediliyor...');
    try {
      const response = await fetch('/api/settings/check-updates', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${useAuthStore.getState().token}`
        }
      });
      const data = await response.json();
      if (data?.success) {
        toast.success(data.message);
        loadDownloadedUpdates();
      } else {
        toast.error(data.message || 'Güncelleme kontrolü başarısız.');
        loadDownloadedUpdates();
      }
    } catch (error) {
      toast.error('Bağlantı hatası');
    }
    setSaving(false);
  };

  const handleToggleRegistration = async (enabled) => {
    setRegistrationEnabled(enabled);
    await handleSaveSettings({ registrationEnabled: enabled });
  };

  const handleToggleTeacherRegistration = async (enabled) => {
    setTeacherRegistrationEnabled(enabled);
    await handleSaveSettings({ teacherRegistrationEnabled: enabled });
  };

  const handleToggleTelemetry = async (enabled) => {
    setTelemetryEnabled(enabled);
    await handleSaveSettings({ telemetryEnabled: enabled });
  };

  const toggleClass = async (className) => {
    let newAllowedClasses;
    if (allowedClasses.includes(className)) {
      newAllowedClasses = allowedClasses.filter(c => c !== className);
    } else {
      newAllowedClasses = [...allowedClasses, className];
    }
    setAllowedClasses(newAllowedClasses);
    await handleSaveSettings({ allowedClasses: newAllowedClasses });
  };

  const selectAllClasses = async () => {
    // Tüm dinamik sınıfları seç
    const allClassNames = classes.map(c => typeof c === 'string' ? c : c.name);
    setAllowedClasses(allClassNames);
    await handleSaveSettings({ allowedClasses: allClassNames });
  };

  const deselectAllClasses = async () => {
    setAllowedClasses([]);
    await handleSaveSettings({ allowedClasses: [] });
  };

  // Kullanıcı yönetimi fonksiyonları
  const loadUsers = async () => {
    try {
      const studentsData = await userApi.getStudents();
      const teachersData = await userApi.getTeachers();

      if (studentsData?.success) setStudents(studentsData.students);
      if (teachersData?.success) setTeachers(teachersData.teachers);
    } catch (error) {
      console.error('Kullanıcılar yüklenemedi:', error);
    }
  };

  const handleDeleteUser = (userId, userType) => {
    setConfirmModal({
      isOpen: true,
      title: 'Kullanıcıyı Sil',
      message: 'Bu kullanıcıyı silmek istediğinizden emin misiniz?',
      confirmText: 'Sil',
      type: 'danger',
      onConfirm: async () => {
        try {
          const data = await userApi.delete(userId, userType);
          if (data?.success) {
            toast.success('Kullanıcı silindi');
            loadUsers();
          } else {
            toast.error('Kullanıcı silinemedi');
          }
        } catch (error) {
          toast.error('Bir hata oluştu');
        }
      }
    });
  };

  const handleToggleSuspend = async (userId, userType, currentStatus) => {
    try {
      const data = await userApi.suspend(userId, userType, !currentStatus);

      if (data?.success) {
        toast.success(currentStatus ? 'Kullanıcı aktif edildi' : 'Kullanıcı askıya alındı');
        loadUsers();
      } else {
        toast.error('İşlem başarısız');
      }
    } catch (error) {
      toast.error('Bir hata oluştu');
    }
  };

  // İstatistik yükleme
  const loadStats = async () => {
    try {
      const data = await statsApi.get();
      if (data?.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('İstatistikler yüklenemedi:', error);
    }
  };

  // Toplu bildirim gönderme
  const handleSendBulkNotification = async (target, title, message) => {
    try {
      const data = await notificationApi.createBulk({ target, title, message });
      if (data?.success) {
        toast.success(`${data.count} kullanıcıya bildirim gönderildi`);
      } else {
        toast.error('Bildirim gönderilemedi');
      }
    } catch (error) {
      toast.error('Bir hata oluştu');
    }
  };

  // Yedekleme fonksiyonları
  const handleBackupData = async () => {
    setBackupInProgress(true);
    try {
      const token = useAuthStore.getState().token;
      const response = await fetch('/api/backup', {
        headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
      });
      if (!response.ok) throw new Error('Yedekleme başarısız');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `atolye-platform-backup-${new Date().toISOString().split('T')[0]}.db`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('Yedek başarıyla indirildi');
    } catch (error) {
      console.error('Yedekleme hatası:', error);
      toast.error('Yedekleme sırasında hata oluştu');
    } finally {
      setBackupInProgress(false);
    }
  };

  const handleBackupWithPhotos = async () => {
    setBackupInProgress(true);
    try {
      toast.info('Fotoğraflarla yedekleme hazırlanıyor... Bu biraz zaman alabilir.');

      // Backend'den ZIP olarak indir
      const token = useAuthStore.getState().token;
      const response = await fetch('/api/backup/with-photos', {
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });

      if (!response.ok) {
        toast.error('Yedekleme başarısız');
        return;
      }

      // ZIP dosyasını blob olarak al
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `platform-backup-with-photos-${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('Fotoğraflı yedek başarıyla indirildi (ZIP)');
    } catch (error) {
      console.error('Yedekleme hatası:', error);
      toast.error('Yedekleme sırasında bir hata oluştu');
    } finally {
      setBackupInProgress(false);
    }
  };

  const loadLocalBackups = async () => {
    setLoadingLocalBackups(true);
    try {
      const res = await fetch('/api/backup/list', {
        headers: { 'Authorization': `Bearer ${useAuthStore.getState().token}` }
      });
      const data = await res.json();
      if (data?.success) {
        setLocalBackups(data.backups || []);
      }
    } catch (err) {
      console.error('Local backups load error:', err);
    }
    setLoadingLocalBackups(false);
  };

  const handleDownloadLocalBackup = async (fileName) => {
    try {
      const response = await fetch(`/api/backup/download/${fileName}`, {
        headers: { 'Authorization': `Bearer ${useAuthStore.getState().token}` }
      });
      if (!response.ok) throw new Error('İndirme hatası');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success('Yedek başarıyla indirildi');
    } catch (err) {
      toast.error('İndirme başarısız');
    }
  };

  const handleRestoreLocalBackup = (fileName) => {
    setConfirmModal({
      isOpen: true,
      title: 'Yerel Yedeği Geri Yükle',
      message: `"${fileName}" isimli yedek dosyası geri yüklenecektir. Bu işlem mevcut tüm verileri (öğrenciler, sınavlar, notlar, teslimler) silecek ve yedekteki verileri yazacaktır. Bu işlem geri alınamaz! Devam etmek istiyor musunuz?`,
      confirmText: 'Yedeği Geri Yükle',
      type: 'warning',
      onConfirm: async () => {
        toast.info('Yedek geri yükleniyor...');
        try {
          const res = await fetch(`/api/backup/restore-local/${fileName}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${useAuthStore.getState().token}`
            }
          });
          const data = await res.json();
          if (data?.success) {
            toast.success('Yedek başarıyla geri yüklendi! Sayfa yenileniyor...');
            setTimeout(() => {
              window.location.reload();
            }, 2000);
          } else {
            toast.error('Geri yükleme başarısız: ' + (data?.error || 'Bilinmeyen hata'));
          }
        } catch (err) {
          console.error(err);
          toast.error('Geri yükleme sırasında bir hata oluştu');
        }
      }
    });
  };

  const handleDeleteLocalBackup = (fileName) => {
    setConfirmModal({
      isOpen: true,
      title: 'Yedek Dosyasını Sil',
      message: `"${fileName}" isimli yedek dosyası kalıcı olarak silinecektir. Devam etmek istiyor musunuz?`,
      confirmText: 'Yedeği Sil',
      type: 'danger',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/backup/${fileName}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${useAuthStore.getState().token}`
            }
          });
          const data = await res.json();
          if (data?.success) {
            toast.success('Yedek dosyası silindi');
            loadLocalBackups();
          } else {
            toast.error('Silme başarısız: ' + (data?.error || 'Bilinmeyen hata'));
          }
        } catch (err) {
          console.error(err);
          toast.error('Silme işlemi sırasında hata oluştu');
        }
      }
    });
  };

  // Sınıf yönetimi fonksiyonları
  const loadClasses = async () => {
    setLoading(true);
    try {
      const data = await classApi.getAll();
      if (data?.success) setClasses(data.classes);
    } catch (error) {
      console.error('Sınıflar yüklenemedi:', error);
    }
    setLoading(false);
  };

  const handleAddClass = async () => {
    if (!newClassName.trim()) return;
    setSaving(true);
    try {
      const data = await classApi.add(newClassName.trim());
      if (data?.success) {
        toast.success(`Sınıf eklendi: ${newClassName}`);
        setNewClassName('');
        loadClasses();
        loadSettings(); // allowedClasses listesini de güncellemek için
      } else {
        toast.error(data.error || 'Sınıf eklenemedi');
      }
    } catch (error) {
      toast.error('Bağlantı hatası');
    }
    setSaving(false);
  };

  const handleDeleteClass = (className) => {
    setConfirmModal({
      isOpen: true,
      title: 'Sınıfı Sil',
      message: `${className} sınıfını silmek istediğinizden emin misiniz? Bu sınıfa kayıtlı öğrenciler artık "Sınıf Silindi" olarak görünecektir.`,
      confirmText: 'Sil',
      type: 'danger',
      onConfirm: async () => {
        try {
          const data = await classApi.delete(className);
          if (data?.success) {
            toast.success('Sınıf silindi');
            loadClasses();
            loadSettings();
            if (activeTab === 'users') loadUsers(); // Öğrenci isimleri güncellenmiş olabilir
          } else {
            toast.error('Sınıf silinemedi');
          }
        } catch (error) {
          toast.error('Bir hata oluştu');
        }
      }
    });
  };

  const handleUpdateClass = async () => {
    if (!editingClass || !newNameForEdit.trim()) return;
    setSaving(true);
    try {
      const data = await classApi.update(editingClass, newNameForEdit.trim());
      if (data?.success) {
        toast.success('Sınıf güncellendi');
        setEditingClass(null);
        setNewNameForEdit('');
        loadClasses();
        loadSettings();
      } else {
        toast.error(data.error || 'Güncelleme başarısız');
      }
    } catch (error) {
      toast.error('Bağlantı hatası');
    }
    setSaving(false);
  };

  const handleRestoreData = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setConfirmModal({
      isOpen: true,
      title: 'Yedek Geri Yükle',
      message: 'Yedek geri yüklendiğinde mevcut veriler silinecek. Devam etmek istiyor musunuz?',
      confirmText: 'Yedeği Yükle',
      type: 'warning',
      onConfirm: async () => {
        try {
          const isZip = file.name.toLowerCase().endsWith('.zip');
          let result;

          if (isZip) {
            toast.info('ZIP dosyası yükleniyor ve geri yükleniyor...');
            result = await backupApi.restoreZip(file);
          } else {
            toast.info('SQLite veritabanı doğrulanıyor ve geri yükleniyor...');
            result = await backupApi.restoreDatabase(file);
          }

          if (result?.success) {
            toast.success('Yedek başarıyla geri yüklendi! Sayfa yenileniyor...');
            setTimeout(() => {
              window.location.reload();
            }, 2000);
          } else {
            toast.error('Geri yükleme başarısız: ' + (result?.error || 'Bilinmeyen hata'));
          }
        } catch (error) {
          console.error('Geri yükleme hatası:', error);
          toast.error(error.message || 'Geçersiz yedek dosyası veya bir hata oluştu');
        }
      }
    });

    event.target.value = '';
  };

  // Render fonksiyonları
  const renderRegistrationTab = () => (
    <>
      {/* Öğretmen Kayıt Kontrolü */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <Users size={24} style={{ color: '#8b5cf6' }} />
          <h2 style={styles.cardTitle}>Öğretmen Kayıt Kontrolü</h2>
        </div>

        <div style={styles.toggleSection}>
          <div style={styles.toggleLabel}>
            <span style={styles.toggleTitle}>Öğretmen Kayıtları</span>
            <span style={styles.toggleDesc}>
              {teacherRegistrationEnabled
                ? 'Yeni öğretmen kayıtları aktif'
                : 'Yeni öğretmen kayıtları kapalı'}
            </span>
          </div>
          <button
            style={styles.toggleButton(teacherRegistrationEnabled)}
            onClick={() => handleToggleTeacherRegistration(!teacherRegistrationEnabled)}
            disabled={saving}
          >
            {teacherRegistrationEnabled ? (
              <>
                <Unlock size={18} />
                <span>Açık</span>
              </>
            ) : (
              <>
                <Lock size={18} />
                <span>Kapalı</span>
              </>
            )}
          </button>
        </div>

        {!teacherRegistrationEnabled && (
          <div style={styles.warningBox}>
            <p style={styles.warningTitle}>⚠️ Öğretmen Kayıtları Kapalı</p>
            <p style={styles.warningText}>
              Şu anda hiçbir öğretmen sisteme kayıt olamaz. Kayıtları tekrar açmak için yukarıdaki butonu kullanın.
            </p>
          </div>
        )}
      </div>

      {/* Telemetri Kontrolü */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <Activity size={24} style={{ color: '#10b981' }} />
          <h2 style={styles.cardTitle}>Kullanım İstatistikleri (Telemetri)</h2>
        </div>

        <div style={styles.toggleSection}>
          <div style={styles.toggleLabel}>
            <span style={styles.toggleTitle}>Telemetri Verisi Gönderimi</span>
            <span style={styles.toggleDesc}>
              {telemetryEnabled
                ? 'İstatistikler ve hata raporları arka planda toplanıyor'
                : 'Veri toplama devre dışı bırakıldı'}
            </span>
          </div>
          <button
            style={styles.toggleButton(telemetryEnabled)}
            onClick={() => handleToggleTelemetry(!telemetryEnabled)}
            disabled={saving}
          >
            {telemetryEnabled ? (
              <>
                <Unlock size={18} />
                <span>Açık</span>
              </>
            ) : (
              <>
                <Lock size={18} />
                <span>Kapalı</span>
              </>
            )}
          </button>
        </div>

        {!telemetryEnabled && (
          <div style={styles.warningBox}>
            <p style={styles.warningTitle}>⚠️ Telemetri Kapalı</p>
            <p style={styles.warningText}>
              Platformun kullanımı, aktif öğrenci sayıları ve varsa ortaya çıkan sistem hataları artık dışarıya (veya Google Sheets'e) iletilmeyecektir. Bu durum sorun tespitini zorlaştırabilir.
            </p>
          </div>
        )}
      </div>


      {/* Öğrenci Kayıt Kontrolü */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <Shield size={24} style={{ color: '#3b82f6' }} />
          <h2 style={styles.cardTitle}>Öğrenci Kayıt Kontrolü</h2>
        </div>

        <div style={styles.toggleSection}>
          <div style={styles.toggleLabel}>
            <span style={styles.toggleTitle}>Öğrenci Kayıtları</span>
            <span style={styles.toggleDesc}>
              {registrationEnabled
                ? 'Yeni öğrenci kayıtları aktif'
                : 'Yeni öğrenci kayıtları kapalı'}
            </span>
          </div>
          <button
            style={styles.toggleButton(registrationEnabled)}
            onClick={() => handleToggleRegistration(!registrationEnabled)}
            disabled={saving}
          >
            {registrationEnabled ? (
              <>
                <Unlock size={18} />
                <span>Açık</span>
              </>
            ) : (
              <>
                <Lock size={18} />
                <span>Kapalı</span>
              </>
            )}
          </button>
        </div>

        {!registrationEnabled && (
          <div style={styles.warningBox}>
            <p style={styles.warningTitle}>⚠️ Kayıtlar Kapalı</p>
            <p style={styles.warningText}>
              Şu anda hiçbir öğrenci sisteme kayıt olamaz. Kayıtları tekrar açmak için yukarıdaki butonu kullanın.
            </p>
          </div>
        )}
      </div>

      {/* Sınıf Bazlı Kayıt Kontrolü */}
      {registrationEnabled && (
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <Users size={24} style={{ color: '#10b981' }} />
            <h2 style={styles.cardTitle}>Kayıt Açık Sınıflar</h2>
          </div>

          <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
            Sadece seçili sınıflar kayıt olabilir. Diğer sınıflar kayıt ekranında görünmez.
          </p>

          <div style={styles.actionButtons}>
            <button
              style={styles.button('secondary')}
              onClick={selectAllClasses}
            >
              Tümünü Seç
            </button>
            <button
              style={styles.button('secondary')}
              onClick={deselectAllClasses}
            >
              Tümünü Kaldır
            </button>
          </div>

          <div style={styles.classGrid}>
            {classes.map((c) => {
              const className = typeof c === 'string' ? c : c.name;
              const isSelected = allowedClasses.includes(className);
              return (
                <div
                  key={className}
                  style={styles.classCard(isSelected)}
                  onClick={() => toggleClass(className)}
                >
                  <div style={styles.className(isSelected)}>{className}</div>
                  <div style={styles.classStatus(isSelected)}>
                    {isSelected ? (
                      <>
                        <Unlock size={14} />
                        <span>Açık</span>
                      </>
                    ) : (
                      <>
                        <Lock size={14} />
                        <span>Kapalı</span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {allowedClasses.length === 0 && (
            <div style={{ ...styles.warningBox, backgroundColor: '#fee2e2', borderColor: '#fecaca' }}>
              <p style={{ ...styles.warningTitle, color: '#991b1b' }}>❌ Hiçbir Sınıf Seçilmedi</p>
              <p style={{ ...styles.warningText, color: '#7f1d1d' }}>
                Kayıtlar açık olmasına rağmen hiçbir sınıf seçilmedi. Öğrenciler kayıt olamayacak.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Bilgi Kutusu */}
      <div style={{ ...styles.card, backgroundColor: 'var(--color-background-secondary)', borderColor: '#bfdbfe' }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Settings size={24} style={{ color: '#3b82f6', flexShrink: 0 }} />
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: '600', color: '#1e40af', marginBottom: '8px' }}>
              💡 Nasıl Çalışır?
            </h3>
            <ul style={{ fontSize: '13px', color: '#1e40af', lineHeight: '1.8', paddingLeft: '20px' }}>
              <li>Değişiklikler otomatik olarak kaydedilir</li>
              <li>Kayıtlar kapalıyken hiçbir öğrenci sisteme kayıt olamaz</li>
              <li>Kayıtlar açıkken sadece seçili sınıflar kayıt formunda görünür</li>
              <li>Öğrenciler sadece kendi sınıflarına kayıt olabilir</li>
              <li>Toksik davranış durumunda tüm kayıtları kapatabilir veya belirli sınıfları engelleyebilirsiniz</li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );

  const [passwordChangeModeRemaining, setPasswordChangeModeRemaining] = useState(null);

  useEffect(() => {
    // İlk yüklemede ve 1 saniyede bir kalan süreyi kontrol et
    const checkPasswordModeStatus = async () => {
      try {
        const data = await settingsApi.get();

        if (data?.success && data.settings?.passwordChangeModeExpiresAt) {
          const expiresAt = new Date(data.settings.passwordChangeModeExpiresAt).getTime();
          const now = Date.now();

          if (expiresAt > now) {
            setPasswordChangeModeRemaining(Math.floor((expiresAt - now) / 1000));
          } else {
            setPasswordChangeModeRemaining(null);
          }
        } else {
          setPasswordChangeModeRemaining(null);
        }
      } catch (error) {
        console.error('Ayarlar alınamadı:', error);
      }
    };

    if (activeTab === 'users') {
      checkPasswordModeStatus();
      const interval = setInterval(() => {
        setPasswordChangeModeRemaining((prev) => {
          if (prev === null) {
            checkPasswordModeStatus(); // Belki arkada biri açtı diye periyodik kontrol et
            return null;
          }
          if (prev <= 1) {
            return null;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [activeTab]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleTogglePasswordChangeMode = async () => {
    try {
      const data = await settingsApi.get();
      const currentSettings = data?.settings || {};

      let result;
      if (passwordChangeModeRemaining !== null) {
        // İptal et
        result = await settingsApi.update({
          ...currentSettings,
          passwordChangeModeExpiresAt: null
        });
        if (result?.success) {
          setPasswordChangeModeRemaining(null);
          toast.success('Şifre Değiştirme Modu iptal edildi.');
        } else {
          toast.error('Mod iptal edilemedi.');
        }
      } else {
        // Aktif et
        const expiresAt = new Date(Date.now() + 10 * 60000).toISOString();
        result = await settingsApi.update({
          ...currentSettings,
          passwordChangeModeExpiresAt: expiresAt
        });
        if (result?.success) {
          setPasswordChangeModeRemaining(600); // 10 dakika = 600 saniye
          toast.success('Öğrenci Şifre Değiştirme Modu 10 dakikalığına aktif edildi!');
        } else {
          toast.error('Mod aktif edilemedi.');
        }
      }
    } catch (error) {
      toast.error('Bağlantı hatası!');
    }
  };

  const renderUsersTab = () => {
    const filteredStudents = students.filter(s =>
      s.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.studentNumber?.includes(searchQuery) ||
      s.className?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredTeachers = teachers.filter(t =>
      t.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.department?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
      <>
        {/* Arama */}
        <div style={styles.card}>
          <input
            type="text"
            placeholder="🔍 Öğrenci veya öğretmen ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 16px',
              fontSize: '14px',
              border: '2px solid var(--color-border)',
              borderRadius: '10px',
              outline: 'none'
            }}
          />
        </div>

        {/* Öğrenciler */}
        <div style={styles.card}>
          <div style={{ ...styles.cardHeader, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <Users size={24} style={{ color: '#3b82f6' }} />
              <h2 style={styles.cardTitle}>Öğrenciler ({filteredStudents.length})</h2>
            </div>
            <Button
              variant={passwordChangeModeRemaining !== null ? "error" : "warning"}
              onClick={handleTogglePasswordChangeMode}
            >
              <Key size={16} />
              {passwordChangeModeRemaining !== null
                ? `İptal Et (${formatTime(passwordChangeModeRemaining)})`
                : 'Tüm Öğrenciler için Şifre Değişim Modu (10dk)'}
            </Button>
          </div>

          {filteredStudents.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '20px' }}>
              Öğrenci bulunamadı
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                    <th style={{ textAlign: 'left', padding: '12px', fontSize: '13px', color: 'var(--color-text-muted)' }}>Ad Soyad</th>
                    <th style={{ textAlign: 'left', padding: '12px', fontSize: '13px', color: 'var(--color-text-muted)' }}>Okul No</th>
                    <th style={{ textAlign: 'left', padding: '12px', fontSize: '13px', color: 'var(--color-text-muted)' }}>Sınıf</th>
                    <th style={{ textAlign: 'left', padding: '12px', fontSize: '13px', color: 'var(--color-text-muted)' }}>Durum</th>
                    <th style={{ textAlign: 'center', padding: '12px', fontSize: '13px', color: 'var(--color-text-muted)' }}>İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map(student => (
                    <tr key={student.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px', fontSize: '14px' }}>{student.fullName}</td>
                      <td style={{ padding: '12px', fontSize: '14px' }}>{student.studentNumber}</td>
                      <td style={{ padding: '12px', fontSize: '14px' }}>{student.className}</td>
                      <td style={{ padding: '12px' }}>
                        <span style={{
                          padding: '4px 12px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '600',
                          backgroundColor: student.suspended ? '#fee2e2' : '#dcfce7',
                          color: student.suspended ? '#991b1b' : '#166534'
                        }}>
                          {student.suspended ? 'Askıda' : 'Aktif'}
                        </span>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                          <button
                            onClick={() => handleToggleSuspend(student.id, 'student', student.suspended)}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: student.suspended ? '#dcfce7' : '#fef3c7',
                              color: student.suspended ? '#166534' : '#92400e',
                              border: 'none',
                              borderRadius: '8px',
                              fontSize: '12px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            {student.suspended ? <UserCheck size={14} /> : <UserX size={14} />}
                            {student.suspended ? 'Aktif Et' : 'Askıya Al'}
                          </button>
                          <button
                            onClick={() => handleDeleteUser(student.id, 'student')}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: '#fee2e2',
                              color: '#991b1b',
                              border: 'none',
                              borderRadius: '8px',
                              fontSize: '12px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <Trash2 size={14} />
                            Sil
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Öğretmenler */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <UserCheck size={24} style={{ color: '#8b5cf6' }} />
            <h2 style={styles.cardTitle}>Öğretmenler ({filteredTeachers.length})</h2>
          </div>

          {filteredTeachers.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '20px' }}>
              Öğretmen bulunamadı
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                    <th style={{ textAlign: 'left', padding: '12px', fontSize: '13px', color: 'var(--color-text-muted)' }}>Ad Soyad</th>
                    <th style={{ textAlign: 'left', padding: '12px', fontSize: '13px', color: 'var(--color-text-muted)' }}>Kullanıcı Adı</th>
                    <th style={{ textAlign: 'left', padding: '12px', fontSize: '13px', color: 'var(--color-text-muted)' }}>Bölüm</th>
                    <th style={{ textAlign: 'left', padding: '12px', fontSize: '13px', color: 'var(--color-text-muted)' }}>Durum</th>
                    <th style={{ textAlign: 'center', padding: '12px', fontSize: '13px', color: 'var(--color-text-muted)' }}>İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTeachers.map(teacher => (
                    <tr key={teacher.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px', fontSize: '14px' }}>{teacher.fullName}</td>
                      <td style={{ padding: '12px', fontSize: '14px' }}>{teacher.username}</td>
                      <td style={{ padding: '12px', fontSize: '14px' }}>{teacher.department}</td>
                      <td style={{ padding: '12px' }}>
                        <span style={{
                          padding: '4px 12px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '600',
                          backgroundColor: teacher.suspended ? '#fee2e2' : '#dcfce7',
                          color: teacher.suspended ? '#991b1b' : '#166534'
                        }}>
                          {teacher.suspended ? 'Askıda' : 'Aktif'}
                        </span>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                          <button
                            onClick={() => handleToggleSuspend(teacher.id, 'teacher', teacher.suspended)}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: teacher.suspended ? '#dcfce7' : '#fef3c7',
                              color: teacher.suspended ? '#166534' : '#92400e',
                              border: 'none',
                              borderRadius: '8px',
                              fontSize: '12px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            {teacher.suspended ? <UserCheck size={14} /> : <UserX size={14} />}
                            {teacher.suspended ? 'Aktif Et' : 'Askıya Al'}
                          </button>
                          <button
                            onClick={() => handleDeleteUser(teacher.id, 'teacher')}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: '#fee2e2',
                              color: '#991b1b',
                              border: 'none',
                              borderRadius: '8px',
                              fontSize: '12px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <Trash2 size={14} />
                            Sil
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </>
    );
  };

  const renderBulkTab = () => {
    const handleSendBulk = async () => {
      if (!bulkTitle || !bulkMessage) {
        toast.error('Başlık ve mesaj gerekli');
        return;
      }

      setSending(true);
      const target = bulkTarget === 'class' ? `class-${bulkClass}` : bulkTarget;
      await handleSendBulkNotification(target, bulkTitle, bulkMessage);
      setBulkTitle('');
      setBulkMessage('');
      setSending(false);
    };

    return (
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <Mail size={24} style={{ color: '#10b981' }} />
          <h2 style={styles.cardTitle}>Toplu Bildirim Gönder</h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Kime */}
          <div>
            <label style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '8px', display: 'block' }}>
              Kime Gönderilsin?
            </label>
            <select
              value={bulkTarget}
              onChange={(e) => setBulkTarget(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '14px',
                border: '2px solid var(--color-border)',
                borderRadius: '10px',
                outline: 'none'
              }}
            >
              <option value="all-students">Tüm Öğrenciler</option>
              <option value="class">Belirli Sınıf</option>
              <option value="all-teachers">Tüm Öğretmenler</option>
            </select>
          </div>

          {/* Sınıf Seçimi */}
          {bulkTarget === 'class' && (
            <div>
              <label style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '8px', display: 'block' }}>
                Sınıf Seç
              </label>
              <select
                value={bulkClass}
                onChange={(e) => setBulkClass(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  fontSize: '14px',
                  border: '2px solid var(--color-border)',
                  borderRadius: '10px',
                  outline: 'none'
                }}
              >
                {classes.map((c) => {
                  const className = typeof c === 'string' ? c : c.name;
                  return <option key={className} value={className}>{className}</option>;
                })}
              </select>
            </div>
          )}

          {/* Başlık */}
          <div>
            <label style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '8px', display: 'block' }}>
              Bildirim Başlığı
            </label>
            <input
              type="text"
              value={bulkTitle}
              onChange={(e) => setBulkTitle(e.target.value)}
              placeholder="Örn: Önemli Duyuru"
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '14px',
                border: '2px solid var(--color-border)',
                borderRadius: '10px',
                outline: 'none'
              }}
            />
          </div>

          {/* Mesaj */}
          <div>
            <label style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '8px', display: 'block' }}>
              Mesaj
            </label>
            <textarea
              value={bulkMessage}
              onChange={(e) => setBulkMessage(e.target.value)}
              placeholder="Bildirim mesajınızı buraya yazın..."
              rows={5}
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '14px',
                border: '2px solid var(--color-border)',
                borderRadius: '10px',
                outline: 'none',
                fontFamily: 'inherit',
                resize: 'vertical'
              }}
            />
          </div>

          {/* Gönder Butonu */}
          <button
            onClick={handleSendBulk}
            disabled={sending || !bulkTitle || !bulkMessage}
            style={{
              padding: '12px',
              backgroundColor: sending ? '#94a3b8' : '#10b981',
              color: 'var(--color-text-inverse, #fff)',
              border: 'none',
              borderRadius: '10px',
              fontSize: '15px',
              fontWeight: '600',
              cursor: sending ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <Mail size={18} />
            {sending ? 'Gönderiliyor...' : 'Bildirim Gönder'}
          </button>
        </div>
      </div>
    );
  };

  const renderStatsTab = () => {
    if (!stats) {
      return (
        <div style={styles.card}>
          <p style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>İstatistikler yükleniyor...</p>
        </div>
      );
    }

    const statCards = [
      {
        icon: Users,
        title: 'Toplam Öğrenci',
        value: stats.totalStudents || 0,
        color: '#3b82f6'
      },
      {
        icon: UserCheck,
        title: 'Toplam Öğretmen',
        value: stats.totalTeachers || 0,
        color: '#8b5cf6'
      },
      {
        icon: FileText,
        title: 'Aktif Sınavlar',
        value: stats.activeExams || 0,
        color: '#10b981'
      },
      {
        icon: Clock,
        title: 'Toplam Gönderim',
        value: stats.totalSubmissions || 0,
        color: '#f59e0b'
      },
      {
        icon: HardDrive,
        title: 'Kullanılan Depolama',
        value: stats.storageUsed || '0 B',
        subtitle: `Kalan: ${stats.remainingSpace || '10 GB'}`,
        color: '#ef4444'
      }
    ];

    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
        {statCards.map((stat, index) => (
          <div
            key={index}
            style={{
              ...styles.card,
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              marginBottom: 0
            }}
          >
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '12px',
              backgroundColor: `${stat.color}20`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <stat.icon size={28} style={{ color: stat.color }} />
            </div>
            <div>
              <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>{stat.title}</p>
              <p style={{ fontSize: '24px', fontWeight: '700', color: 'var(--color-text-primary)' }}>{stat.value}</p>
              {stat.subtitle && <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>{stat.subtitle}</p>}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderBackupTab = () => (
    <>
      {/* Yedekleme Bilgisi */}
      <div style={{ ...styles.card, backgroundColor: 'var(--color-background-secondary)', borderColor: '#bfdbfe' }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Database size={24} style={{ color: '#3b82f6', flexShrink: 0 }} />
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e40af', marginBottom: '8px' }}>
              📦 Veri Yedekleme Sistemi
            </h3>
            <p style={{ fontSize: '14px', color: '#1e40af', lineHeight: '1.6', marginBottom: '8px' }}>
              Platform verilerinizi güvenli bir şekilde yedekleyin ve gerektiğinde geri yükleyin.
            </p>
            <ul style={{ fontSize: '13px', color: '#1e40af', lineHeight: '1.8', paddingLeft: '20px' }}>
              <li><strong>Yedeklenen Veriler:</strong> Öğrenciler, Öğretmenler, Sınavlar, Gönderimler, Notlar, Bildirimler, Programlar</li>
              <li><strong>Fotoğraflar:</strong> Manuel veya otomatik yedeklerde tercihinize bağlı yedeklenir.</li>
              <li><strong>Format:</strong> ZIP veya JSON dosyası (kolayca okunabilir ve geri yüklenebilir)</li>
              <li><strong>Güvenlik:</strong> Yedek dosyalarını güvenli bir yerde saklayın.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Otomatik Yedekleme Ayarları */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <Database size={24} style={{ color: '#3b82f6' }} />
          <h2 style={styles.cardTitle}>Otomatik Yedekleme Ayarları</h2>
        </div>

        <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', marginBottom: '20px' }}>
          Sistem verilerinin güvenliğini artırmak için arka planda çalışan otomatik yedekleme sistemini yapılandırın.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Aktif mi */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', backgroundColor: 'var(--color-background)', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
            <div>
              <label style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-foreground-secondary)' }}>
                Otomatik Yedekleme Sistemi
              </label>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>
                Sistem belirli periyotlarla otomatik olarak yerel yedek dosyaları oluşturur.
              </p>
            </div>
            <input
              type="checkbox"
              checked={autoBackupEnabled}
              onChange={(e) => setAutoBackupEnabled(e.target.checked)}
              style={{ width: '20px', height: '20px', accentColor: '#3b82f6', cursor: 'pointer' }}
            />
          </div>

          {autoBackupEnabled && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              {/* Sıklık */}
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--color-text-secondary)', marginBottom: '6px', display: 'block' }}>
                  Yedekleme Sıklığı (Periyot)
                </label>
                <select
                  value={autoBackupInterval}
                  onChange={(e) => setAutoBackupInterval(Number(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: '14px',
                    border: '2px solid var(--color-border)',
                    borderRadius: '10px',
                    outline: 'none',
                    backgroundColor: 'var(--color-surface)',
                    color: 'var(--color-foreground-secondary)'
                  }}
                >
                  <option value={12}>12 Saatte Bir</option>
                  <option value={24}>Her Gün (24 Saatte Bir)</option>
                  <option value={72}>3 Günde Bir (72 Saatte Bir)</option>
                  <option value={168}>Her Hafta (168 Saatte Bir)</option>
                </select>
              </div>

              {/* Fotoğraflar dahil edilsin mi */}
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    id="autoBackupIncludePhotos"
                    checked={autoBackupIncludePhotos}
                    onChange={(e) => setAutoBackupIncludePhotos(e.target.checked)}
                    style={{ cursor: 'pointer', width: '18px', height: '18px', accentColor: '#3b82f6' }}
                  />
                  <label htmlFor="autoBackupIncludePhotos" style={{
                    fontSize: '13px',
                    color: 'var(--color-text-secondary)',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}>
                    Öğrenci Dosyalarını (uploads) Yedekle
                  </label>
                </div>
                <p style={{ margin: '4px 0 0 26px', fontSize: '11px', color: '#94a3b8' }}>
                  Öğrencilerin gönderdiği resim ve ödev dosyalarını da yedek dosyasına ekler.
                </p>
              </div>
            </div>
          )}

          <button
            onClick={async () => {
              setSaving(true);
              try {
                await handleSaveSettings({
                  autoBackupEnabled,
                  autoBackupInterval,
                  autoBackupIncludePhotos
                });
              } catch (err) {
                console.error(err);
              }
              setSaving(false);
            }}
            disabled={saving}
            style={{
              ...styles.button('primary'),
              width: '100%'
            }}
          >
            Otomatik Yedekleme Ayarlarını Kaydet
          </button>
        </div>
      </div>

      {/* Yerel Yedek Dosyaları */}
      <div style={styles.card}>
        <div style={{ ...styles.cardHeader, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Database size={24} style={{ color: '#10b981' }} />
            <h2 style={styles.cardTitle}>Mevcut Yerel Yedekler ({localBackups.length})</h2>
          </div>
          <button
            onClick={loadLocalBackups}
            disabled={loadingLocalBackups}
            style={{
              padding: '6px 12px',
              backgroundColor: 'var(--color-background-secondary)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: '600',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer'
            }}
          >
            Tazele
          </button>
        </div>

        {loadingLocalBackups ? (
          <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '24px' }}>Yedekler yükleniyor...</p>
        ) : localBackups.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>
            <Database size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
            <p>Henüz yerel veya otomatik alınmış bir yedek yok.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                  <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '13px', color: 'var(--color-text-muted)', fontWeight: '700' }}>Dosya Adı</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '13px', color: 'var(--color-text-muted)', fontWeight: '700' }}>Boyut</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '13px', color: 'var(--color-text-muted)', fontWeight: '700' }}>Tür / Tarih</th>
                  <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: '13px', color: 'var(--color-text-muted)', fontWeight: '700' }}>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {localBackups.map((backup, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: '500', color: 'var(--color-text-primary)' }}>
                      {backup.name}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--color-text-muted)' }}>
                      {backup.size > 1024 * 1024 
                        ? `${(backup.size / (1024 * 1024)).toFixed(2)} MB` 
                        : `${(backup.size / 1024).toFixed(1)} KB`}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--color-text-muted)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{
                          alignSelf: 'flex-start',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '10px',
                          fontWeight: '700',
                          backgroundColor: backup.isAuto ? 'var(--color-background-secondary)' : 'var(--color-background-secondary)',
                          color: backup.isAuto ? '#15803d' : '#1d4ed8'
                        }}>
                          {backup.isAuto ? 'Otomatik' : 'Manuel'}
                        </span>
                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                          {new Date(backup.createdAt).toLocaleString('tr-TR')}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => handleRestoreLocalBackup(backup.name)}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#fef3c7',
                            color: '#92400e',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          Geri Yükle
                        </button>
                        <button
                          onClick={() => handleDownloadLocalBackup(backup.name)}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: 'var(--color-primary-light)',
                            color: '#4338ca',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          İndir
                        </button>
                        <button
                          onClick={() => handleDeleteLocalBackup(backup.name)}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#fee2e2',
                            color: '#991b1b',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          Sil
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SQLite Yedekleme */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <Download size={24} style={{ color: '#10b981' }} />
          <h2 style={styles.cardTitle}>Manuel Veri Yedekleme</h2>
        </div>

        <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', marginBottom: '20px' }}>
          Platformun SQLite veritabanını doğrudan yedekleyin. Öğrenci, öğretmen, sınav, teslim, ayar ve diğer sistem verilerinin tamamı `.db` dosyasına dahil edilir.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Standart Yedek */}
          <div style={{
            padding: '20px',
            border: '2px solid var(--color-border)',
            borderRadius: '12px',
            backgroundColor: 'var(--color-background)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <Database size={20} style={{ color: '#10b981' }} />
              <h3 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--color-text-primary)' }}>
                Veritabanı Yedeği (SQLite)
              </h3>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '16px', lineHeight: '1.6' }}>
              Çalışan SQLite veritabanının güvenli ve tutarlı bir `.db` kopyası indirilir. Yüklenen dosyalar dahil <strong>değildir</strong>.
            </p>
            <button
              onClick={handleBackupData}
              disabled={backupInProgress}
              style={{
                ...styles.button('primary'),
                width: '100%',
                opacity: backupInProgress ? 0.6 : 1
              }}
            >
              <Download size={18} />
              {backupInProgress ? 'Yedekleniyor...' : 'SQLite Yedeği İndir (.db)'}
            </button>
          </div>

          {/* Fotoğraflı Yedek */}
          <div style={{
            padding: '20px',
            border: '2px solid var(--color-border)',
            borderRadius: '12px',
            backgroundColor: 'var(--color-background)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <Download size={20} style={{ color: '#f59e0b' }} />
              <h3 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--color-text-primary)' }}>
                Fotoğraflı Yedekleme (ZIP)
              </h3>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '16px', lineHeight: '1.6' }}>
              SQLite veritabanı + yüklenen dosyalar ZIP arşivi olarak indirilir.
              <strong> Dosya boyutu büyük olabilir.</strong> İndirme işlemi daha uzun sürebilir.
              ZIP içeriği: database.db, uploads/ ve uploads_student/ klasörleri.
            </p>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px',
              backgroundColor: '#fff7ed',
              border: '1px solid #fed7aa',
              borderRadius: '8px',
              marginBottom: '16px'
            }}>
              <input
                type="checkbox"
                id="includePhotos"
                checked={includePhotos}
                onChange={(e) => setIncludePhotos(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <label htmlFor="includePhotos" style={{
                fontSize: '13px',
                color: '#92400e',
                cursor: 'pointer',
                fontWeight: '500'
              }}>
                Fotoğrafları dahil et (uploads ve uploads_student klasörleri)
              </label>
            </div>

            <button
              onClick={handleBackupWithPhotos}
              disabled={backupInProgress || !includePhotos}
              style={{
                ...styles.button('primary'),
                width: '100%',
                opacity: 1,
                backgroundColor: !includePhotos ? 'var(--color-text-muted)' : '#3b82f6',
                color: 'var(--color-text-inverse, #fff)',
                cursor: !includePhotos ? 'not-allowed' : 'pointer'
              }}
            >
              <Download size={18} />
              {backupInProgress ? 'Yedekleniyor...' : 'Fotoğraflı Yedek İndir (ZIP)'}
            </button>

            {!includePhotos && (
              <p style={{
                fontSize: '12px',
                color: 'var(--color-text-muted)',
                marginTop: '8px',
                fontStyle: 'italic',
                textAlign: 'center'
              }}>
                Fotoğrafları dahil etmek için yukarıdaki kutucuğu işaretleyin
              </p>
            )}
          </div>
        </div>

        {/* Uyarı */}
        <div style={{
          marginTop: '20px',
          padding: '16px',
          backgroundColor: '#fef3c7',
          border: '1px solid #fde68a',
          borderRadius: '8px'
        }}>
          <p style={{ fontSize: '13px', color: '#92400e', lineHeight: '1.6' }}>
            <strong>⚠️ Önemli:</strong> Yedek dosyalarını güvenli bir yerde saklayın.
            Bu dosyalar tüm platform verilerinizi içerir ve yetkisiz kişilerin eline geçmemelidir.
          </p>
        </div>
      </div>

      {/* Geri Yükleme */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <Database size={24} style={{ color: '#ef4444' }} />
          <h2 style={styles.cardTitle}>Veri Geri Yükleme</h2>
        </div>

        <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', marginBottom: '20px' }}>
          Daha önce aldığınız yedek dosyasından verileri geri yükleyin.
          <strong style={{ color: '#ef4444' }}> Bu işlem mevcut tüm verileri silecektir!</strong>
          <br />
          <span style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '8px', display: 'block' }}>
            Desteklenen formatlar: <strong>DB</strong> (SQLite veritabanı) veya <strong>ZIP</strong> (database.db + yüklenen dosyalar)
          </span>
        </p>

        <div style={{
          padding: '20px',
          border: '2px dashed #fecaca',
          borderRadius: '12px',
          backgroundColor: 'var(--color-background-secondary)',
          textAlign: 'center'
        }}>
          <Database size={48} style={{ color: '#ef4444', margin: '0 auto 16px' }} />
          <h3 style={{ fontSize: '15px', fontWeight: '600', color: '#991b1b', marginBottom: '8px' }}>
            Dikkatli Olun!
          </h3>
          <p style={{ fontSize: '13px', color: '#7f1d1d', marginBottom: '16px', lineHeight: '1.6' }}>
            Yedek geri yüklendiğinde mevcut tüm veriler (öğrenciler, sınavlar, notlar) silinecek ve
            yedek dosyasındaki verilerle değiştirilecektir. Bu işlem geri alınamaz.
            {' '}ZIP dosyası seçerseniz fotoğraflar da geri yüklenecektir.
          </p>

          <input
            type="file"
            accept=".db,.zip"
            onChange={handleRestoreData}
            style={{ display: 'none' }}
            id="restore-file-input"
          />
          <label
            htmlFor="restore-file-input"
            style={{
              ...styles.button('secondary'),
              display: 'inline-flex',
              cursor: 'pointer'
            }}
          >
            <Database size={18} />
            Yedek Dosyası Seç (.db veya .zip)
          </label>
        </div>
      </div>
    </>
  );

  const renderClassesTab = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Sınıf Ekleme */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <Users size={24} style={{ color: '#0ea5e9' }} />
          <h2 style={styles.cardTitle}>Yeni Sınıf Ekle</h2>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <input
            type="text"
            placeholder="Sınıf Adı (Örn: 11-B)"
            value={newClassName}
            onChange={(e) => setNewClassName(e.target.value)}
            style={{
              flex: 1,
              padding: '12px 16px',
              border: '2px solid var(--color-border)',
              borderRadius: '12px',
              outline: 'none',
              fontSize: '14px'
            }}
            onKeyPress={(e) => e.key === 'Enter' && handleAddClass()}
          />
          <Button
            onClick={handleAddClass}
            disabled={saving || !newClassName.trim()}
          >
            Sınıfı Oluştur
          </Button>
        </div>
      </div>

      {/* Sınıf Listesi */}
      <div style={styles.card}>
        <div style={{ ...styles.cardHeader, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Database size={24} style={{ color: '#10b981' }} />
            <h2 style={styles.cardTitle}>Mevcut Sınıflar ({classes.length})</h2>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Alfabetik Siralı</span>
        </div>

        {classes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>
            <Users size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
            <p>Henüz tanımlanmış bir sınıf yok.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                  <th style={{ textAlign: 'left', padding: '16px', fontSize: '13px', color: 'var(--color-text-muted)', fontWeight: '700' }}>Sınıf Adı</th>
                  <th style={{ textAlign: 'right', padding: '16px', fontSize: '13px', color: 'var(--color-text-muted)', fontWeight: '700' }}>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {classes.map((cls, index) => {
                  const className = typeof cls === 'string' ? cls : cls.name;
                  return (
                    <tr key={index} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.2s' }}>
                      <td style={{ padding: '16px' }}>
                        {editingClass === className ? (
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <input
                              type="text"
                              value={newNameForEdit}
                              onChange={(e) => setNewNameForEdit(e.target.value)}
                              style={{
                                padding: '8px 12px',
                                border: '2px solid #3b82f6',
                                borderRadius: '8px',
                                fontSize: '14px',
                                width: '120px'
                              }}
                              autoFocus
                            />
                            <button
                              onClick={handleUpdateClass}
                              style={{ padding: '8px 12px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                            >
                              Kaydet
                            </button>
                            <button
                              onClick={() => { setEditingClass(null); setNewNameForEdit(''); }}
                              style={{ padding: '8px 12px', backgroundColor: 'var(--color-background-secondary)', color: 'var(--color-text-muted)', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                            >
                              İptal
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontWeight: '600', color: 'var(--color-text-primary)' }}>{className}</span>
                        )}
                      </td>
                      <td style={{ padding: '16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => { setEditingClass(className); setNewNameForEdit(className); }}
                            title="Düzenle"
                            style={{
                               padding: '8px',
                               borderRadius: '8px',
                               border: 'none',
                               backgroundColor: 'var(--color-background-secondary)',
                               color: 'var(--color-text-muted)',
                               cursor: 'pointer',
                               transition: 'all 0.2s'
                            }}
                          >
                            <RefreshCcw size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteClass(className)}
                            title="Sil"
                            style={{
                               padding: '8px',
                               borderRadius: '8px',
                               border: 'none',
                               backgroundColor: '#fee2e2',
                               color: '#ef4444',
                               cursor: 'pointer',
                               transition: 'all 0.2s'
                            }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  const renderUpdateTab = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Mevcut Durum */}
      <div style={{
        ...styles.card,
        background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
        border: 'none',
        color: 'white',
        padding: '32px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: '14px', opacity: 0.8, marginBottom: '8px' }}>Sistem Durumu</p>
            <h2 style={{ fontSize: '32px', fontWeight: '800', marginBottom: '8px' }}>
              Sürüm v{currentVersion}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }}></div>
              <span style={{ fontSize: '14px', fontWeight: '600', color: '#10b981' }}>Sistem Güncel ve Kararlı</span>
            </div>
          </div>
          <button
            onClick={handleCheckUpdate}
            disabled={checkingUpdate || installingUpdate}
            style={{
              padding: '12px 24px',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '12px',
              color: 'white',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backdropFilter: 'blur(10px)',
              transition: 'all 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'}
          >
            <RefreshCcw size={18} className={checkingUpdate ? 'animate-spin' : ''} />
            {checkingUpdate ? 'Kontrol Ediliyor...' : 'Güncellemeleri Kontrol Et'}
          </button>
        </div>
      </div>

      {/* Yeni Güncelleme Varsa */}
      {availableUpdate && (
        <div style={{
          ...styles.card,
          borderColor: '#3b82f6',
          boxShadow: '0 10px 25px -5px rgba(59, 130, 246, 0.1), 0 8px 10px -6px rgba(59, 130, 246, 0.1)',
          animation: 'in-expo 0.5s ease-out'
        }}>
          <div style={{ display: 'flex', gap: '20px' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '16px',
              backgroundColor: 'var(--color-background-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#3b82f6',
              flexShrink: 0
            }}>
              <RefreshCcw size={32} />
            </div>
            <style>{`
                .markdown-content ul { padding-left: 20px; list-style-type: disc; margin-bottom: 12px; }
                .markdown-content li { margin-bottom: 4px; }
                .markdown-content h1, .markdown-content h2, .markdown-content h3 { 
                  font-size: 1.1em; 
                  font-weight: 700; 
                  margin-top: 12px; 
                  margin-bottom: 8px;
                  color: #1e293b;
                }
                .markdown-content p { margin-bottom: 8px; }
                .markdown-content strong { font-weight: 700; color: #1e293b; }
                .markdown-content code { 
                  background-color: #f1f5f9; 
                  padding: 2px 4px; 
                  border-radius: 4px; 
                  font-family: monospace;
                  font-size: 0.9em;
                }
              `}</style>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--color-text-primary)' }}>
                    Yeni Sürüm Mevcut: v{availableUpdate.latestVersion}
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                    Yayınlanma Tarihi: {new Date(availableUpdate.releaseDate).toLocaleDateString('tr-TR')}
                  </p>
                </div>
                <span style={{
                  padding: '4px 12px',
                  backgroundColor: '#dcfce7',
                  color: '#166534',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: '700'
                }}>Kritik Güncelleme</span>
              </div>

              <div style={{
                backgroundColor: 'var(--color-background)',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '20px'
              }}>
                <h4 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>Neler Değişti?</h4>
                <div style={{
                  fontSize: '13px',
                  color: 'var(--color-text-muted)',
                  lineHeight: '1.6',
                  overflowY: 'auto',
                  maxHeight: '300px'
                }} className="markdown-content">
                  <ReactMarkdown>{availableUpdate.changelog}</ReactMarkdown>
                </div>
              </div>

              {installingUpdate ? (
                <div style={{ width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: '#3b82f6' }}>Yükleniyor...</span>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#3b82f6' }}>%{updateProgress}</span>
                  </div>
                  <div style={{ height: '8px', backgroundColor: 'var(--color-border)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${updateProgress}%`,
                      backgroundColor: '#3b82f6',
                      transition: 'width 0.3s ease'
                    }}></div>
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleInstallUpdate}
                  style={{
                    ...styles.button('primary'),
                    width: '100%',
                    padding: '14px',
                    fontSize: '15px'
                  }}
                >
                  Şimdi Yükle ve Yeniden Başlat
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Geçmiş */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <Clock size={24} style={{ color: 'var(--color-text-muted)' }} />
          <h2 style={styles.cardTitle}>Güncelleme Geçmişi</h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {updateHistory.map((update, index) => (
            <div
              key={update.version}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                padding: '16px',
                backgroundColor: index === 0 ? 'var(--color-background-secondary)' : 'white',
                border: `1px solid ${index === 0 ? '#bae6fd' : 'var(--color-background-secondary)'}`,
                borderRadius: '12px'
              }}
            >
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: update.status === 'installed' ? '#dcfce7' : '#fee2e2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: update.status === 'installed' ? '#166534' : '#991b1b',
                flexShrink: 0
              }}>
                {update.status === 'installed' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--color-text-primary)' }}>v{update.version}</span>
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>•</span>
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                    {new Date(update.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '4px' }}>{update.description}</p>
              </div>
              {index === 0 && (
                <span style={{
                  padding: '4px 8px',
                  backgroundColor: '#bae6fd',
                  color: '#0369a1',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: '700'
                }}>AKTİF SÜRÜM</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Bilgi Kutusu */}
      <div style={{ ...styles.card, backgroundColor: '#fff7ed', borderColor: '#ffedd5' }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          <InfoIcon size={24} style={{ color: '#f97316', flexShrink: 0 }} />
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: '600', color: '#9a3412', marginBottom: '8px' }}>
              💡 Güncelleme Hakkında
            </h3>
            <p style={{ fontSize: '13px', color: '#9a3412', lineHeight: '1.6' }}>
              Güncelleme işlemi sırasında sistem dosyaları yenilenirken otomatik olarak bir veri yedeği alınır.
              İşlem tamamlandığında platform otomatik olarak yenilenecek ve yeni sürüm aktif olacaktır.
              Önemli güncellemeleri kaçırmamak için düzenli olarak kontrol etmeniz önerilir.
            </p>
          </div>
        </div>
      </div>

      {/* Sunucu İstemci Otomatik İndirme */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <Download size={24} style={{ color: '#ec4899' }} />
          <h2 style={styles.cardTitle}>Masaüstü Uygulaması Güncellemeleri</h2>
        </div>

        <div style={styles.toggleSection}>
          <div style={styles.toggleLabel}>
            <span style={styles.toggleTitle}>Güncellemeleri Otomatik İndir (Sunucu)</span>
            <span style={styles.toggleDesc}>
              {autoDownloadClientUpdates
                ? 'Sunucu dış ağdan güncellemeleri kendi bulup indirir'
                : 'Otomatik indirme devre dışı, güncellemeler manuel yüklenmeli'}
            </span>
          </div>
          <button
            style={styles.toggleButton(autoDownloadClientUpdates)}
            onClick={() => {
              const newVal = !autoDownloadClientUpdates;
              setAutoDownloadClientUpdates(newVal);
              handleSaveSettings({ autoDownloadClientUpdates: newVal });
            }}
            disabled={saving}
          >
            {autoDownloadClientUpdates ? (
              <>
                <Unlock size={18} />
                <span>Açık</span>
              </>
            ) : (
              <>
                <Lock size={18} />
                <span>Kapalı</span>
              </>
            )}
          </button>
        </div>

        <div style={{ marginTop: '16px' }}>
          <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '8px', display: 'block' }}>
            Yayın Kanalı
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            {[
              { value: 'stable', label: 'Stable', description: 'Kararlı sürümler' },
              { value: 'beta', label: 'Beta', description: 'Erken deneme sürümleri' }
            ].map(channel => (
              <button
                key={channel.value}
                onClick={() => {
                  setClientUpdateChannel(channel.value);
                  handleSaveSettings({ clientUpdateChannel: channel.value });
                }}
                disabled={saving}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '10px',
                  border: clientUpdateChannel === channel.value ? '2px solid #2563eb' : '1px solid var(--color-border)',
                  backgroundColor: clientUpdateChannel === channel.value ? '#eff6ff' : 'var(--color-background)',
                  color: clientUpdateChannel === channel.value ? '#1d4ed8' : 'var(--color-text-primary)',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <strong style={{ display: 'block', fontSize: '14px' }}>{channel.label}</strong>
                <span style={{ display: 'block', marginTop: '3px', fontSize: '12px', opacity: 0.75 }}>{channel.description}</span>
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginTop: '16px' }}>
          <label style={{ fontSize: '13px', fontWeight: '500', color: 'var(--color-text-muted)', marginBottom: '8px', display: 'block' }}>
            Güncelleme Kaynak URL'si (latest.yml ve exe bulunduğu dizin)
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={clientUpdatesUrl}
              onChange={(e) => setClientUpdatesUrl(e.target.value)}
              placeholder="https://github.com/PolyOS-Team/Atolye.Platform/releases/latest/download"
              style={{
                flex: 1,
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid var(--color-border)',
                outline: 'none',
                backgroundColor: 'var(--color-background)',
                color: 'var(--color-text-primary)',
                fontSize: '14px'
              }}
            />
            <button
              onClick={() => handleSaveSettings({ clientUpdatesUrl })}
              disabled={saving}
              style={{
                padding: '8px 16px',
                backgroundColor: 'var(--color-background-secondary)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border)',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '500',
                transition: 'all 0.2s'
              }}
            >
              Kaydet
            </button>
          </div>
        </div>

        <div style={{ marginTop: '16px' }}>
          <button
            onClick={handleCheckDesktopUpdates}
            disabled={saving}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              backgroundColor: '#ec4899',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '500',
              fontSize: '14px'
            }}
          >
            <Download size={16} />
            Şimdi Yeni Sürüm Denetle
          </button>
        </div>

        <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--color-border)' }}>
          <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-text-secondary)', marginBottom: '12px' }}>
            İndirilen İstemci Güncellemeleri ({downloadedUpdates.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {downloadedUpdates.length > 0 ? (
              downloadedUpdates.map((file, i) => (
                <div key={i} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px',
                  backgroundColor: 'var(--color-background-secondary)',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      backgroundColor: file.name.endsWith('.yml') ? '#fef08a' : '#bfdbfe',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: file.name.endsWith('.yml') ? '#ca8a04' : '#2563eb'
                    }}>
                      <FileText size={16} />
                    </div>
                    <div>
                      <p style={{ fontSize: '14px', fontWeight: '500', color: 'var(--color-text-primary)' }}>{file.name}</p>
                      <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                        {(file.size / 1024 / 1024).toFixed(2)} MB • {new Date(file.date).toLocaleDateString('tr-TR')}
                      </p>
                      <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', opacity: 0.7, marginTop: '2px', fontFamily: 'monospace' }}>
                        {file.path}
                      </p>
                    </div>
                  </div>
                  <span style={{
                    padding: '4px 8px',
                    backgroundColor: '#dcfce7',
                    color: '#166534',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: '700'
                  }}>Hazır</span>
                </div>
              ))
            ) : (
              <div style={{ 
                padding: '24px', 
                textAlign: 'center', 
                backgroundColor: 'var(--color-background-secondary)', 
                borderRadius: '8px',
                border: '1px dashed var(--color-border)'
              }}>
                <p style={{ fontSize: '14px', color: 'var(--color-text-muted)' }}>Henüz hiçbir masaüstü güncelleme paketi indirilmedi.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderAuditTab = () => {
    const filteredLogs = logFilterType === 'all' 
      ? logs 
      : logs.filter(log => log.type === logFilterType);

    return (
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <ClipboardList size={24} style={{ color: '#8b5cf6' }} />
          <h2 style={styles.cardTitle}>İşlem Geçmişi (Audit)</h2>
        </div>
        
        <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', marginBottom: '20px' }}>
          Platform üzerindeki kullanıcı işlemlerini ve güvenlik ihlallerini görüntüleyin.
        </p>

        <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
          <select 
            value={logFilterType}
            onChange={(e) => setLogFilterType(e.target.value)}
            style={styles.select}
          >
            <option value="all">Tüm İşlemler</option>
            <option value="login">Girişler</option>
            <option value="submission">Sınav/Ödev Teslimleri</option>
            <option value="focus_loss">Odak Kaybı</option>
            <option value="kiosk_violation">Kiosk İhlali</option>
            <option value="teacher_action">Öğretmen İşlemleri</option>
            <option value="system">Sistem</option>
          </select>
          <Button onClick={() => window.open('/api/telemetry/export', '_blank')} variant="secondary" style={{ marginLeft: 'auto' }}>
            İstatistikleri İndir
          </Button>
        </div>

        {loadingLogs ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-muted)' }}>Yükleniyor...</div>
        ) : filteredLogs.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-muted)' }}>Kayıt bulunamadı.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...styles.th, width: '150px' }}>Tarih</th>
                  <th style={{ ...styles.th, width: '120px' }}>Tür</th>
                  <th style={{ ...styles.th }}>Kullanıcı</th>
                  <th style={{ ...styles.th }}>İşlem</th>
                  <th style={{ ...styles.th, width: '200px' }}>Detay</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map(log => (
                  <tr key={log.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={styles.td}>
                      {new Date(log.timestamp).toLocaleString('tr-TR')}
                    </td>
                    <td style={styles.td}>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        backgroundColor: 
                          log.type === 'login' ? '#dcfce7' :
                          log.type === 'submission' ? '#dbeafe' :
                          (log.type === 'kiosk_violation' || log.type === 'focus_loss') ? '#fee2e2' :
                          log.type === 'teacher_action' ? '#f3e8ff' : '#f1f5f9',
                        color: 
                          log.type === 'login' ? '#166534' :
                          log.type === 'submission' ? '#1e40af' :
                          (log.type === 'kiosk_violation' || log.type === 'focus_loss') ? '#991b1b' :
                          log.type === 'teacher_action' ? '#6b21a8' : '#334155',
                      }}>
                        {log.type === 'login' ? 'Giriş' :
                         log.type === 'submission' ? 'Teslim' :
                         log.type === 'focus_loss' ? 'Odak Kaybı' :
                         log.type === 'kiosk_violation' ? 'Kiosk İhlali' :
                         log.type === 'teacher_action' ? 'Öğretmen' : log.type}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <div style={{ fontWeight: '500' }}>{log.userName}</div>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{log.role}</div>
                    </td>
                    <td style={styles.td}>{log.action}</td>
                    <td style={{ ...styles.td, fontSize: '12px', color: 'var(--color-text-muted)', wordBreak: 'break-all' }}>
                      {Object.entries(log.details || {}).map(([k, v]) => (
                        <div key={k}><b>{k}:</b> {String(v)}</div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  const renderResetTab = () => (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <AlertTriangle size={24} style={{ color: '#dc2626' }} />
        <h2 style={styles.cardTitle}>DİKKAT: Sistemi Sıfırla</h2>
      </div>

      <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', marginBottom: '20px' }}>
        Tüm platform verilerini kalıcı olarak silip sistemi başlangıç durumuna getirin.
      </p>

      {resetError && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: '#fee2e2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          color: '#991b1b',
          fontSize: '14px',
          marginBottom: '16px'
        }}>
          {resetError}
        </div>
      )}

      <div style={{
        backgroundColor: 'var(--color-background-secondary)',
        border: '1px solid #fecaca',
        borderRadius: '12px',
        padding: '24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            backgroundColor: '#dc2626',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Database size={24} style={{ color: 'white' }} />
          </div>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#dc2626', margin: 0 }}>Tüm Verileri Sıfırla</h3>
            <p style={{ fontSize: '14px', color: '#991b1b', margin: '4px 0 0 0' }}>Bütün sistemi siler</p>
          </div>
        </div>

        <div style={{
          backgroundColor: '#fee2e2',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <AlertTriangle size={20} style={{ color: '#dc2626', flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: '14px', color: '#991b1b' }}>
              <strong>Uyarı:</strong> Bu işlem geri alınamaz! Aşağıdaki veriler kalıcı olarak silinecektir:
              <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
                <li>Öğrenci ve öğretmen hesapları</li>
                <li>Sınavlar, ödevler, değerlendirmeler</li>
              </ul>
            </div>
          </div>
        </div>

        <button
          onClick={handleResetAllData}
          disabled={saving}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            width: '100%',
            padding: '14px 24px',
            backgroundColor: saving ? '#fca5a5' : '#dc2626',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '15px',
            fontWeight: '600',
            cursor: saving ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s'
          }}
        >
          <Trash2 size={18} />
          {saving ? 'Sıfırlanıyor...' : 'Tüm Verileri Sıfırla'}
        </button>
      </div>

      {/* Sistem Bilgileri */}
      <div style={{
        marginTop: '24px',
        backgroundColor: 'var(--color-background)',
        border: '1px solid var(--color-border)',
        borderRadius: '12px',
        padding: '24px'
      }}>
        <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '16px' }}>Platform Bilgileri</h3>
        <div style={{ display: 'grid', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
            <span style={{ color: 'var(--color-text-muted)' }}>Platform Versiyonu</span>
            <span style={{ fontWeight: '500', color: 'var(--color-text-primary)' }}>v{currentVersion || '...'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
            <span style={{ color: 'var(--color-text-muted)' }}>Kullanılan Veritabanı</span>
            <span style={{ 
              fontWeight: '600', 
              color: dbStatus.ready ? '#10b981' : '#ef4444'
            }}>
              {dbStatus.ready ? 'SQLite (Aktif)' : 'SQLite (Bağlantı Hatası)'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
            <span style={{ color: 'var(--color-text-muted)' }}>Son Güncelleme</span>
            <span style={{ fontWeight: '500', color: 'var(--color-text-primary)' }}>{updateHistory[0]?.date ? new Date(updateHistory[0].date).toLocaleDateString('tr-TR') : '15.03.2026'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
            <span style={{ color: 'var(--color-text-muted)' }}>Altyapı</span>
            <span style={{ fontWeight: '500', color: 'var(--color-text-primary)' }}>PolyOS Engine</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
            <span style={{ color: 'var(--color-text-muted)' }}>Geliştirici</span>
            <span style={{ fontWeight: '500', color: 'var(--color-text-primary)' }}>PolyOS Team</span>
          </div>
        </div>
      </div>
    </div>
  );

  const styles = {
    container: { maxWidth: '1200px', margin: '0 auto', padding: '32px' },
    header: { marginBottom: '32px' },
    title: { fontSize: '28px', fontWeight: '700', color: 'var(--color-text-primary)', marginBottom: '8px' },
    subtitle: { fontSize: '14px', color: 'var(--color-text-muted)' },

    tabs: {
      display: 'flex',
      gap: '8px',
      marginBottom: '24px',
      borderBottom: '2px solid var(--color-border)',
      overflowX: 'auto'
    },

    tab: (isActive) => ({
      padding: '12px 20px',
      backgroundColor: 'transparent',
      border: 'none',
      borderBottom: isActive ? '3px solid #3b82f6' : '3px solid transparent',
      color: isActive ? '#3b82f6' : 'var(--color-text-muted)',
      fontSize: '14px',
      fontWeight: isActive ? '600' : '500',
      cursor: 'pointer',
      transition: 'all 0.2s',
      whiteSpace: 'nowrap',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    }),

    card: {
      backgroundColor: 'var(--color-surface)',
      borderRadius: '16px',
      padding: '24px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      border: '1px solid var(--color-border)',
      marginBottom: '24px'
    },

    cardHeader: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      marginBottom: '20px',
      paddingBottom: '16px',
      borderBottom: '1px solid var(--color-border)'
    },

    cardTitle: { fontSize: '18px', fontWeight: '600', color: 'var(--color-text-primary)' },

    toggleSection: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px',
      backgroundColor: 'var(--color-background)',
      borderRadius: '12px',
      marginBottom: '16px'
    },

    toggleLabel: {
      display: 'flex',
      flexDirection: 'column',
      gap: '4px'
    },

    toggleTitle: { fontSize: '15px', fontWeight: '600', color: 'var(--color-text-primary)' },
    toggleDesc: { fontSize: '13px', color: 'var(--color-text-muted)' },

    toggleButton: (enabled) => ({
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '10px 16px',
      backgroundColor: enabled ? '#dcfce7' : '#fee2e2',
      color: enabled ? '#166534' : '#991b1b',
      border: 'none',
      borderRadius: '10px',
      fontSize: '14px',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.2s'
    }),

    classGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
      gap: '12px',
      marginTop: '16px'
    },

    classCard: (isSelected) => ({
      padding: '16px',
      borderRadius: '12px',
      border: isSelected ? '2px solid #3b82f6' : '2px solid #e2e8f0',
      backgroundColor: isSelected ? 'var(--color-background-secondary)' : '#ffffff',
      cursor: 'pointer',
      transition: 'all 0.2s',
      textAlign: 'center'
    }),

    className: (isSelected) => ({
      fontSize: '16px',
      fontWeight: '700',
      color: isSelected ? '#3b82f6' : 'var(--color-text-muted)',
      marginBottom: '8px'
    }),

    classStatus: (isSelected) => ({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '6px',
      fontSize: '12px',
      fontWeight: '500',
      color: isSelected ? '#166534' : '#991b1b'
    }),

    actionButtons: {
      display: 'flex',
      gap: '12px',
      marginTop: '20px'
    },

    button: (variant = 'primary') => ({
      padding: '10px 20px',
      backgroundColor: variant === 'primary' ? '#3b82f6' : variant === 'secondary' ? 'var(--color-background-secondary)' : '#ef4444',
      color: variant === 'primary' ? '#ffffff' : variant === 'secondary' ? 'var(--color-text-secondary)' : '#ffffff',
      border: 'none',
      borderRadius: '10px',
      fontSize: '14px',
      fontWeight: '600',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      transition: 'all 0.2s'
    }),

    saveButton: {
      width: '100%',
      padding: '14px',
      backgroundColor: '#10b981',
      color: 'var(--color-text-inverse, #fff)',
      border: 'none',
      borderRadius: '12px',
      fontSize: '15px',
      fontWeight: '600',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      marginTop: '24px',
      transition: 'all 0.2s'
    },

    warningBox: {
      padding: '16px',
      backgroundColor: '#fef3c7',
      border: '1px solid #fcd34d',
      borderRadius: '12px',
      marginTop: '16px'
    },

    warningTitle: {
      fontSize: '14px',
      fontWeight: '600',
      color: '#92400e',
      marginBottom: '8px'
    },

    warningText: {
      fontSize: '13px',
      color: '#78350f',
      lineHeight: '1.6'
    }
  };

  if (loading) {
    return (
      <TeacherLayout>
        <div style={styles.container}>
          <p style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>Yükleniyor...</p>
        </div>
      </TeacherLayout>
    );
  }

  return (
    <TeacherLayout>
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>Platform Yönetimi</h1>
          <p style={styles.subtitle}>Platform ayarlarını, kullanıcıları ve istatistikleri yönetin</p>
        </div>

        {/* Tab Navigation */}
        <div style={styles.tabs}>
          <button
            style={styles.tab(activeTab === 'registration')}
            onClick={() => setActiveTab('registration')}
          >
            <Shield size={18} />
            Kayıt Kontrolü
          </button>
          <button
            style={styles.tab(activeTab === 'classes')}
            onClick={() => {
              setActiveTab('classes');
              setSearchParams({ tab: 'classes' });
            }}
          >
            <Database size={18} />
            Sınıf Yönetimi
          </button>
          <button
            style={styles.tab(activeTab === 'users')}
            onClick={() => setActiveTab('users')}
          >
            <Users size={18} />
            Kullanıcı Yönetimi
          </button>
          <button
            style={styles.tab(activeTab === 'bulk')}
            onClick={() => setActiveTab('bulk')}
          >
            <Mail size={18} />
            Toplu İşlemler
          </button>
          <button
            style={styles.tab(activeTab === 'stats')}
            onClick={() => setActiveTab('stats')}
          >
            <BarChart3 size={18} />
            İstatistikler
          </button>
          <button
            style={styles.tab(activeTab === 'backup')}
            onClick={() => setActiveTab('backup')}
          >
            <Database size={18} />
            Veri Yedekleme
          </button>
          <button
            style={styles.tab(activeTab === 'update')}
            onClick={() => setActiveTab('update')}
          >
            <RefreshCcw size={18} />
            Güncelleme Yönetimi
          </button>
          <button
            style={styles.tab(activeTab === 'audit')}
            onClick={() => {
              setActiveTab('audit');
              setSearchParams({ tab: 'audit' });
            }}
          >
            <ClipboardList size={18} />
            İşlem Geçmişi
          </button>
          <button
            style={styles.tab(activeTab === 'system')}
            onClick={() => {
              setActiveTab('system');
              setSearchParams({ tab: 'system' });
            }}
          >
            <Terminal size={18} />
            Sistem Konsolu
          </button>
          <button
            style={{ ...styles.tab(activeTab === 'reset'), color: activeTab === 'reset' ? '#dc2626' : 'var(--color-text-muted)', borderBottomColor: activeTab === 'reset' ? '#dc2626' : 'transparent' }}
            onClick={() => setActiveTab('reset')}
          >
            <AlertTriangle size={18} />
            Sistem Sıfırlama
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'registration' && renderRegistrationTab()}
        {activeTab === 'classes' && renderClassesTab()}
        {activeTab === 'users' && renderUsersTab()}
        {activeTab === 'bulk' && renderBulkTab()}
        {activeTab === 'stats' && renderStatsTab()}
        {activeTab === 'backup' && renderBackupTab()}
        {activeTab === 'update' && renderUpdateTab()}
        {activeTab === 'audit' && renderAuditTab()}
        {activeTab === 'system' && renderSystemConsoleTab()}
        {activeTab === 'reset' && renderResetTab()}
        <ConfirmModal
          {...confirmModal}
          onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        />
      </div>
    </TeacherLayout>
  );
};

export default PlatformManagement;

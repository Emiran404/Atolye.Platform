import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Home,
  PlusCircle,
  FileText,
  Users,
  ClipboardCheck,
  BarChart3,
  Bell,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Archive,
  Shield,
  Monitor,
  MonitorPlay,
  Award,
  AlertTriangle,
  ArrowUpCircle,
  AlertCircle,
  ArrowLeft,
  Database,
  Loader2,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import PasskeyModal from '../ui/PasskeyModal';
import { canUsePasskey } from '../../utils/platform';

const TeacherLayout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, token, theme, setTheme } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showPasskeyModal, setShowPasskeyModal] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(null);
  const [showUpdateBanner, setShowUpdateBanner] = useState(true);

  useEffect(() => {
    // Force light theme for teacher panel
    if (theme === 'dark') {
      setTheme('light');
    }
    document.documentElement.classList.remove('dark');
  }, [theme, setTheme]);

  // Veritabanı geçiş durumları
  const [dbStatus, setDbStatus] = useState({
    dbType: 'json',
    isMigrated: false,
    checking: true,
    error: null
  });
  const [migrationStatus, setMigrationStatus] = useState('idle'); // 'idle' | 'migrating' | 'success' | 'error'
  const [migrationLogs, setMigrationLogs] = useState([]);
  const [migrationProgress, setMigrationProgress] = useState(0);
  const [migrationError, setMigrationError] = useState(null);
  const [isCheckingDb, setIsCheckingDb] = useState(false);

  // Veritabanı durumu yükle
  const fetchDbStatus = async () => {
    try {
      const response = await fetch('/api/settings/db-status');
      const data = await response.json();
      if (data.success) {
        setDbStatus({
          dbType: data.dbType,
          isMigrated: data.isMigrated,
          checking: false,
          error: null
        });
      } else {
        setDbStatus(prev => ({ ...prev, checking: false, error: data.error || 'Bilinmeyen hata' }));
      }
    } catch (error) {
      console.error('Veritabanı durum kontrol hatası:', error);
      setDbStatus(prev => ({ ...prev, checking: false, error: 'Bağlantı Hatası: Sunucuya ulaşılamıyor. (' + error.message + ')' }));
    }
  };

  useEffect(() => {
    fetchDbStatus();
  }, []);

  // Otomatik yeniden deneme mekanizması (Hata varsa 3 saniyede bir kontrol et)
  useEffect(() => {
    let interval;
    if (dbStatus.error) {
      interval = setInterval(() => {
        fetchDbStatus();
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [dbStatus.error]);

  const handleRecheckDb = async () => {
    setIsCheckingDb(true);
    try {
      const response = await fetch('/api/settings/db-status');
      const data = await response.json();
      if (data.success) {
        setDbStatus({
          dbType: data.dbType,
          isMigrated: data.isMigrated,
          checking: false
        });
      }
    } catch (error) {
      console.error('Veritabanı durum kontrol hatası:', error);
    } finally {
      setIsCheckingDb(false);
    }
  };

  const handleMigrate = async () => {
    setMigrationStatus('migrating');
    setMigrationProgress(10);
    setMigrationLogs(['🔍 JSON yedek dosyaları analiz ediliyor...']);
    
    const steps = [
      { progress: 25, log: '📂 JSON sınıflar (classes.json) okunuyor...' },
      { progress: 45, log: '📂 Sınavlar ve öğrenci kayıtları taşınıyor...' },
      { progress: 70, log: '📂 Sınav teslimleri (submissions.json) SQLite veritabanına aktarılıyor...' },
      { progress: 90, log: '⚙️ SQLite şeması doğrulanıyor ve indeksler oluşturuluyor...' }
    ];

    for (let i = 0; i < steps.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 800));
      setMigrationProgress(steps[i].progress);
      setMigrationLogs(prev => [...prev, steps[i].log]);
    }

    try {
      const response = await fetch('/api/settings/migrate-db', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      
      if (data.success) {
        setMigrationProgress(100);
        setMigrationLogs(prev => [...prev, '✅ Veritabanı geçişi başarıyla tamamlandı! 💾 atolye.db dosyası güncellendi.']);
        setMigrationStatus('success');
      } else {
        setMigrationStatus('error');
        setMigrationError(data.error || 'Bilinmeyen bir hata oluştu.');
        setMigrationLogs(prev => [...prev, `❌ Hata: ${data.error || 'Geçiş başarısız oldu.'}`]);
      }
    } catch (error) {
      setMigrationStatus('error');
      setMigrationError(error.message);
      setMigrationLogs(prev => [...prev, `❌ Sunucu bağlantı hatası: ${error.message}`]);
    }
  };

  const handleFinishMigration = async () => {
    await fetchDbStatus();
    setMigrationStatus('idle');
    setMigrationProgress(0);
    setMigrationLogs([]);
  };

  const handleBypassSqlite = () => {
    localStorage.setItem('sqlite_bypass', 'true');
    fetchDbStatus();
  };

  const isDbBlocked = !dbStatus.checking && (dbStatus.error || dbStatus.dbType === 'json' || !dbStatus.isMigrated) && localStorage.getItem('sqlite_bypass') !== 'true';

  // Passkey modal kontrolü - giriş yapıldığında göster
  useEffect(() => {
    // Sadece desteklenen platformlarda (Windows) göster
    if (!canUsePasskey()) return;

    const passkeyDismissed = localStorage.getItem('passkey_modal_dismissed');
    if (!passkeyDismissed) {
      // Kısa bir gecikme ile modal göster (sayfa yüklendikten sonra)
      const timer = setTimeout(() => {
        setShowPasskeyModal(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, []);
  
  // Güncelleme Kontrolü
  useEffect(() => {
    const checkUpdates = async () => {
      try {
        const response = await fetch('/api/system/check-update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ force: false }) // Önbelleği (cache) kullan
        });
        const data = await response.json();
        if (data.success && data.updateAvailable) {
          setUpdateAvailable(data);
          
          // Eğer banner daha önce bu oturumda kapatılmadıysa göster
          const dismissedVersion = sessionStorage.getItem('update_banner_dismissed');
          if (dismissedVersion === data.latestVersion) {
            setShowUpdateBanner(false);
          }
        }
      } catch (error) {
        console.error('Güncelleme kontrolü başarısız:', error);
      }
    };

    checkUpdates();
    
    // Her 30 dakikada bir kontrol et
    const interval = setInterval(checkUpdates, 1800000);
    return () => clearInterval(interval);
  }, []);

  // CSS Animasyonları
  const animationStyles = `
    @keyframes logoFloat {
      0%, 100% { transform: translateY(0) rotate(0deg); }
      50% { transform: translateY(-3px) rotate(1deg); }
    }
    @keyframes logoPulse {
      0%, 100% { box-shadow: 0 4px 14px rgba(13, 148, 136, 0.3); }
      50% { box-shadow: 0 6px 20px rgba(13, 148, 136, 0.5); }
    }
    @keyframes textShimmer {
      0% { background-position: -200% center; }
      100% { background-position: 200% center; }
    }
    @keyframes emojiWave {
      0%, 100% { transform: rotate(0deg); }
      25% { transform: rotate(-10deg); }
      75% { transform: rotate(10deg); }
    }
    .teacher-logo-container {
      transition: all 0.3s ease;
      display: inline-block;
    }
    .teacher-logo-container:hover {
      animation: emojiWave 0.5s ease-in-out;
    }
    .teacher-brand-text {
      background: linear-gradient(90deg, #0d9488 0%, #14b8a6 25%, #2dd4bf 50%, #14b8a6 75%, #0d9488 100%);
      background-size: 200% auto;
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
      animation: textShimmer 4s linear infinite;
    }
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    .spin-icon {
      animation: spin 1s linear infinite;
    }
    .wizard-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(15, 23, 42, 0.45);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .wizard-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 20px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      padding: 32px;
      max-width: 600px;
      width: 100%;
      position: relative;
      animation: fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    .wizard-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 600;
    }
    .wizard-badge.success {
      background-color: #f0fdf4;
      color: #16a34a;
      border: 1px solid #bbf7d0;
    }
    .wizard-badge.warning {
      background-color: #fffbeb;
      color: #d97706;
      border: 1px solid #fde68a;
    }
    .wizard-btn-primary {
      width: 100%;
      padding: 14px;
      border: none;
      border-radius: 12px;
      font-size: 15px;
      font-weight: 700;
      color: #ffffff;
      background: linear-gradient(135deg, #0d9488 0%, #0f766e 100%);
      box-shadow: 0 4px 12px rgba(13, 148, 136, 0.3);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: all 0.2s ease;
    }
    .wizard-btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(13, 148, 136, 0.4);
    }
    .wizard-btn-primary:active {
      transform: translateY(0);
    }
    .wizard-btn-primary:disabled {
      opacity: 0.7;
      cursor: not-allowed;
      transform: none !important;
      box-shadow: none !important;
    }
    .wizard-btn-secondary {
      width: 100%;
      padding: 14px;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      font-size: 15px;
      font-weight: 600;
      color: #475569;
      background-color: #ffffff;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: all 0.2s ease;
    }
    .wizard-btn-secondary:hover {
      background-color: #f8fafc;
      border-color: #cbd5e1;
    }
    .wizard-code {
      background-color: #1e293b;
      color: #f8fafc;
      border-radius: 8px;
      padding: 12px;
      font-family: ui-monospace, monospace;
      font-size: 12px;
      overflow-x: auto;
      margin: 8px 0;
      text-align: left;
    }
    .step-log {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      font-size: 13px;
      color: #334155;
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px;
      margin-top: 16px;
      max-height: 120px;
      overflow-y: auto;
      text-align: left;
    }
  `;

  const menuItems = [
    { icon: Home, label: 'Ana Sayfa', path: '/ogretmen/panel' },
    { icon: PlusCircle, label: 'Sınav Oluştur', path: '/ogretmen/sinav-olustur' },
    { icon: FileText, label: 'Aktif Sınavlar', path: '/ogretmen/aktif-sinavlar' },
    { icon: MonitorPlay, label: 'Canlı Sınav', path: '/ogretmen/canli-sinav' },
    { icon: Users, label: 'Öğrenci Listesi', path: '/ogretmen/ogrenci-listesi' },
    { icon: ClipboardCheck, label: 'Değerlendirme', path: '/ogretmen/degerlendirme' },
    { icon: Archive, label: 'Arşiv', path: '/ogretmen/arsiv' },
    { icon: BarChart3, label: 'İstatistikler', path: '/ogretmen/istatistikler' },
    { icon: Award, label: 'Öğrenci Notları', path: '/ogretmen/ogrenci-notlari' },
    { icon: Shield, label: 'Platform Yönetimi', path: '/ogretmen/platform-yonetimi' },
    { icon: Monitor, label: 'Entegre Sistemler', path: '/ogretmen/entegre-sistemler', special: true },
    { icon: Bell, label: 'Bildirimler', path: '/ogretmen/bildirimler' },
    { icon: Settings, label: 'Ayarlar', path: '/ogretmen/ayarlar' },
    { icon: AlertTriangle, label: 'Sorun Bildir', path: '/ogretmen/sorun-bildir' },
  ];

  const handleLogout = () => {
    localStorage.removeItem('sqlite_bypass');
    logout();
    navigate('/');
  };

  const isActive = (path) => location.pathname === path;

  const sidebarStyles = {
    sidebar: {
      position: 'fixed',
      top: 0,
      left: 0,
      height: '100vh',
      width: sidebarOpen ? '280px' : '80px',
      backgroundColor: 'var(--color-surface)',
      borderRight: '1px solid var(--color-border)',
      display: 'flex',
      flexDirection: 'column',
      transition: 'width 0.3s ease',
      zIndex: 1000,
      boxShadow: '2px 0 8px rgba(0,0,0,0.05)'
    },
    logo: {
      padding: '20px',
      borderBottom: '1px solid var(--color-border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: sidebarOpen ? 'space-between' : 'center',
      minHeight: '80px'
    },
    logoText: {
      fontSize: '18px',
      fontWeight: '700',
      display: sidebarOpen ? 'flex' : 'none',
      alignItems: 'center',
      gap: '8px'
    },
    toggleBtn: {
      padding: '8px',
      borderRadius: '8px',
      border: 'none',
      backgroundColor: 'var(--color-background-secondary)',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--color-text-muted)',
      transition: 'all 0.2s'
    },
    userSection: {
      padding: sidebarOpen ? '20px' : '12px',
      borderBottom: '1px solid var(--color-border)',
      display: 'flex',
      alignItems: 'center',
      gap: '12px'
    },
    avatar: {
      width: '48px',
      height: '48px',
      borderRadius: '12px',
      background: 'linear-gradient(135deg, #0d9488 0%, #14b8a6 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--color-text-inverse, #fff)',
      fontSize: '18px',
      fontWeight: '600',
      flexShrink: 0
    },
    userInfo: {
      display: sidebarOpen ? 'block' : 'none',
      overflow: 'hidden'
    },
    userName: {
      fontSize: '14px',
      fontWeight: '600',
      color: 'var(--color-text-primary)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    },
    userRole: {
      fontSize: '12px',
      color: 'var(--color-text-muted)',
      marginTop: '2px'
    },
    nav: {
      flex: 1,
      padding: '16px 12px',
      overflowY: 'auto'
    },
    navItem: (active, isSpecial = false) => ({
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: sidebarOpen ? '12px 16px' : '12px',
      marginBottom: '4px',
      borderRadius: '10px',
      cursor: 'pointer',
      backgroundColor: (isSpecial && active)
        ? undefined
        : (isSpecial
          ? (active ? 'rgba(147, 51, 234, 0.15)' : 'rgba(147, 51, 234, 0.08)')
          : (active ? 'var(--color-background-secondary)' : 'transparent')),
      background: isSpecial && active
        ? 'linear-gradient(135deg, rgba(147, 51, 234, 0.2) 0%, rgba(59, 130, 246, 0.2) 100%)'
        : undefined,
      color: isSpecial
        ? (active ? '#a855f7' : '#9333ea')
        : (active ? '#0d9488' : 'var(--color-text-secondary)'),
      fontWeight: active ? '600' : '500',
      fontSize: '14px',
      transition: 'all 0.2s',
      border: isSpecial ? '1px solid rgba(147, 51, 234, 0.3)' : 'none',
      width: '100%',
      textAlign: 'left',
      justifyContent: sidebarOpen ? 'flex-start' : 'center',
      boxShadow: isSpecial && active ? '0 4px 12px rgba(147, 51, 234, 0.2)' : 'none'
    }),
    navLabel: {
      display: sidebarOpen ? 'block' : 'none',
      whiteSpace: 'nowrap'
    },
    logoutSection: {
      padding: '16px 12px',
      borderTop: '1px solid var(--color-border)'
    },
    logoutBtn: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: sidebarOpen ? '12px 16px' : '12px',
      borderRadius: '10px',
      cursor: 'pointer',
      backgroundColor: 'var(--color-background-secondary)',
      color: '#dc2626',
      fontWeight: '500',
      fontSize: '14px',
      border: 'none',
      width: '100%',
      justifyContent: sidebarOpen ? 'flex-start' : 'center',
      transition: 'all 0.2s'
    },
    main: {
      marginLeft: sidebarOpen ? '280px' : '80px',
      minHeight: '100vh',
      backgroundColor: 'var(--color-background)',
      transition: 'margin-left 0.3s ease'
    },
    content: {
      padding: '32px'
    },
    mobileHeader: {
      display: 'none',
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      height: '64px',
      backgroundColor: 'var(--color-surface)',
      borderBottom: '1px solid var(--color-border)',
      padding: '0 16px',
      alignItems: 'center',
      justifyContent: 'space-between',
      zIndex: 999
    },
    mobileMenuBtn: {
      padding: '8px',
      borderRadius: '8px',
      border: 'none',
      backgroundColor: 'transparent',
      cursor: 'pointer',
      color: 'var(--color-text-secondary)'
    },
    overlay: {
      display: mobileMenuOpen ? 'block' : 'none',
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      zIndex: 998
    },
    updateBanner: {
      marginBottom: '24px',
      background: 'linear-gradient(135deg, #0d9488 0%, #3b82f6 100%)',
      borderRadius: '16px',
      padding: '16px 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      color: 'var(--color-text-inverse, #fff)',
      boxShadow: '0 10px 25px -5px rgba(13, 148, 136, 0.4)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      position: 'relative',
      overflow: 'hidden'
    },
    bannerGlow: {
      position: 'absolute',
      top: '-50%',
      left: '-50%',
      width: '200%',
      height: '200%',
      background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
      pointerEvents: 'none'
    },
    bannerContent: {
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      zIndex: 1
    },
    bannerIcon: {
      width: '40px',
      height: '40px',
      borderRadius: '12px',
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    },
    bannerInfo: {
      display: 'flex',
      flexDirection: 'column'
    },
    bannerTitle: {
      fontSize: '15px',
      fontWeight: '700',
      marginBottom: '2px'
    },
    bannerText: {
      fontSize: '13px',
      opacity: 0.9
    },
    bannerActions: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      zIndex: 1
    },
    updateBtn: {
      padding: '10px 20px',
      backgroundColor: 'var(--color-surface)',
      color: '#0d9488',
      border: 'none',
      borderRadius: '10px',
      fontSize: '13px',
      fontWeight: '700',
      cursor: 'pointer',
      transition: 'all 0.2s',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
    },
    closeBannerBtn: {
      padding: '8px',
      backgroundColor: 'rgba(255, 255, 255, 0.15)',
      color: 'var(--color-text-inverse, #fff)',
      border: 'none',
      borderRadius: '8px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'all 0.2s'
    }
  };

  return (
    <div>
      <style>{`
        ${animationStyles}
        @media (max-width: 768px) {
          .teacher-sidebar {
            transform: ${mobileMenuOpen ? 'translateX(0)' : 'translateX(-100%)'} !important;
            width: 280px !important;
          }
          .teacher-main {
            margin-left: 0 !important;
            padding-top: 64px !important;
          }
          .teacher-mobile-header {
            display: flex !important;
          }
          .teacher-toggle-btn {
            display: none !important;
          }
        }
      `}</style>

      {/* Mobile Header */}
      <div 
        className="teacher-mobile-header" 
        style={{
          ...sidebarStyles.mobileHeader,
          ...(isDbBlocked ? { pointerEvents: 'none', filter: 'blur(2px)', opacity: 0.7 } : {})
        }}
      >
        <button
          className="teacher-mobile-menu-btn"
          style={sidebarStyles.mobileMenuBtn}
          onClick={() => setMobileMenuOpen(true)}
        >
          <Menu size={24} />
        </button>
        <span style={{ fontSize: '16px', fontWeight: '600', color: '#0d9488' }}>
          Öğretmen Paneli
        </span>
        <div style={{ width: '40px' }} />
      </div>

      {/* Overlay */}
      <div style={sidebarStyles.overlay} onClick={() => setMobileMenuOpen(false)} />

      {/* Sidebar */}
      <aside 
        className="teacher-sidebar" 
        style={{
          ...sidebarStyles.sidebar,
          ...(isDbBlocked ? { pointerEvents: 'none', filter: 'blur(3px)', opacity: 0.6 } : {})
        }}
      >
        {/* Logo */}
        <div style={sidebarStyles.logo}>
          <span style={sidebarStyles.logoText}>
            <span className="teacher-logo-container">📚</span>
            <span className="teacher-brand-text">Öğretmen Paneli</span>
          </span>
          <button
            className="teacher-toggle-btn"
            style={sidebarStyles.toggleBtn}
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
          </button>
        </div>

        {/* User Section */}
        <div style={sidebarStyles.userSection}>
          <div style={sidebarStyles.avatar}>
            {user?.fullName?.charAt(0) || 'Ö'}
          </div>
          <div style={sidebarStyles.userInfo}>
            <div style={sidebarStyles.userName}>{user?.fullName || 'Öğretmen'}</div>
            <div style={sidebarStyles.userRole}>{user?.department || 'Öğretmen'}</div>
          </div>
        </div>

        {/* Navigation */}
        <nav style={sidebarStyles.nav}>
          {menuItems.map((item) => (
            <button
              key={item.path}
              id={`nav-${item.path.replace('/ogretmen/', '')}`}
              style={sidebarStyles.navItem(isActive(item.path), item.special)}
              onClick={() => {
                navigate(item.path);
                setMobileMenuOpen(false);
              }}
              onMouseEnter={(e) => {
                if (!isActive(item.path)) {
                  if (item.special) {
                    e.currentTarget.style.background = 'linear-gradient(135deg, rgba(147, 51, 234, 0.15) 0%, rgba(59, 130, 246, 0.15) 100%)';
                  } else {
                    e.currentTarget.style.backgroundColor = 'var(--color-background-secondary)';
                  }
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive(item.path)) {
                  if (item.special) {
                    e.currentTarget.style.background = 'rgba(147, 51, 234, 0.08)';
                  } else {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }
              }}
            >
              <item.icon size={20} />
              <span style={sidebarStyles.navLabel}>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Actions Area */}
        <div style={sidebarStyles.logoutSection}>
          <button
            style={{
              ...sidebarStyles.logoutBtn,
              backgroundColor: 'var(--color-background-secondary)',
              color: 'var(--color-text-secondary)',
              marginBottom: '8px',
              border: '1px solid var(--color-border)'
            }}
            onClick={() => navigate('/')}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#0d9488';
              e.currentTarget.style.color = '#ffffff';
              e.currentTarget.style.borderColor = '#0d9488';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-background-secondary)';
              e.currentTarget.style.color = 'var(--color-text-secondary)';
              e.currentTarget.style.borderColor = 'var(--color-border)';
            }}
          >
            <ArrowLeft size={20} />
            <span style={sidebarStyles.navLabel}>Ana Sayfaya Dön</span>
          </button>

          <button
            style={sidebarStyles.logoutBtn}
            onClick={handleLogout}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fee2e2'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-background-secondary)'}
          >
            <LogOut size={20} />
            <span style={sidebarStyles.navLabel}>Çıkış Yap</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main 
        className="teacher-main" 
        style={{
          ...sidebarStyles.main,
          ...(isDbBlocked ? { pointerEvents: 'none', filter: 'blur(4px)', opacity: 0.5 } : {})
        }}
      >
        <div style={sidebarStyles.content}>
          {/* Sürüm Güncelleme Bildirimi */}
          {updateAvailable && showUpdateBanner && (
            <div className="update-banner-anim" style={sidebarStyles.updateBanner}>
              <div style={sidebarStyles.bannerGlow} />
              <div style={sidebarStyles.bannerContent}>
                <div style={sidebarStyles.bannerIcon}>
                  <ArrowUpCircle size={24} />
                </div>
                <div style={sidebarStyles.bannerInfo}>
                  <div style={sidebarStyles.bannerTitle}>Yeni Sürüm Mevcut! ({updateAvailable.latestVersion})</div>
                  <div style={sidebarStyles.bannerText}>
                    Sisteminiz için kritik iyileştirmeler içeren bir güncelleme hazır.
                  </div>
                </div>
              </div>
              <div style={sidebarStyles.bannerActions}>
                <button 
                  style={sidebarStyles.updateBtn}
                  onClick={() => navigate('/ogretmen/platform-yonetimi?tab=update')}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 15px rgba(0,0,0,0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                  }}
                >
                  Şimdi Güncelle
                </button>
                <button 
                  style={sidebarStyles.closeBannerBtn}
                  onClick={() => {
                    setShowUpdateBanner(false);
                    sessionStorage.setItem('update_banner_dismissed', updateAvailable.latestVersion);
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.25)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.15)'}
                  title="Kapat"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          )}

          {children}
        </div>
      </main>

      {/* Passkey Modal */}
      <PasskeyModal
        isOpen={showPasskeyModal}
        onClose={() => setShowPasskeyModal(false)}
        userName={user?.fullName}
        onGoToSettings={() => navigate('/ogretmen/ayarlar')}
      />

      {/* Veritabanı Geçiş Sihirbazı Overlay */}
      {isDbBlocked && (
        <div className="wizard-overlay">
          <div className={`wizard-card ${dbStatus.dbType === 'sqlite' ? 'sqlite-ready' : 'sqlite-missing'}`}>
            
            {/* Sürücü Durumu Rozeti */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Database size={24} style={{ color: dbStatus.dbType === 'sqlite' ? '#0d9488' : '#f59e0b' }} />
                <h2 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--color-text-primary)', margin: 0 }}>
                  Yeni Sistem Veritabanı Geçişi
                </h2>
              </div>
              <span className={`wizard-badge ${dbStatus.dbType === 'sqlite' ? 'success' : 'warning'}`}>
                {dbStatus.error ? (
                  <>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
                    Bağlantı Koptu
                  </>
                ) : dbStatus.dbType === 'sqlite' ? (
                  <>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22c55e' }} />
                    SQLite Hazır
                  </>
                ) : (
                  <>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
                    JSON Modu (Kısıtlı)
                  </>
                )}
              </span>
            </div>

            {/* Sunucu Bağlantı Hatası */}
            {dbStatus.error && (
              <div>
                <div style={{ backgroundColor: 'var(--color-background-secondary)', border: '1px solid #fca5a5', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <AlertTriangle size={20} style={{ color: '#ef4444', flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#991b1b', margin: '0 0 6px 0' }}>
                        Sunucu ile İletişim Koptu
                      </h4>
                      <p style={{ fontSize: '13px', color: '#991b1b', lineHeight: '1.6', margin: 0 }}>
                        {dbStatus.error} <br/>
                        Lütfen arka planda sunucunun (`npm run dev` veya node) çalıştığından ve 3002 portunun açık olduğundan emin olun.
                      </p>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  <button 
                    className="btn btn-primary" 
                    onClick={() => {
                      setIsCheckingDb(true);
                      fetchDbStatus();
                      setTimeout(() => setIsCheckingDb(false), 800);
                    }}
                    disabled={isCheckingDb}
                  >
                    Tekrar Dene
                  </button>
                  <button 
                    className="btn" 
                    onClick={handleBypassSqlite}
                    style={{ width: 'auto' }}
                  >
                    Geç
                  </button>
                </div>
              </div>
            )}

            {/* SQLite Modülü Yüklenemedi (Çok nadir - eski Node.js sürümü) */}
            {!dbStatus.error && dbStatus.dbType === 'json' && (
              <div>
                <div style={{ backgroundColor: 'var(--color-background-secondary)', border: '1px solid #fde68a', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <AlertTriangle size={20} style={{ color: '#d97706', flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#92400e', margin: '0 0 6px 0' }}>
                        Node.js Sürümü Uyumsuz
                      </h4>
                      <p style={{ fontSize: '13px', color: '#92400e', lineHeight: '1.6', margin: 0 }}>
                        Sisteminiz şu anda <strong>JSON dosya tabanlı geçici modda</strong> çalışmaktadır. 
                        Node.js yerleşik <strong>node:sqlite</strong> modülü yüklenemedi. 
                        Bu genellikle Node.js sürümünüzün v22'den eski olması durumunda gerçekleşir.
                      </p>
                    </div>
                  </div>
                </div>

                <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: '1.6', marginBottom: '20px' }}>
                  Lütfen Node.js sürümünüzü <strong>v22 veya üstüne</strong> güncelleyin ve sunucuyu yeniden başlatın.
                </p>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    className="wizard-btn-primary"
                    onClick={handleRecheckDb}
                    disabled={isCheckingDb}
                    style={{ background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)', boxShadow: '0 4px 12px rgba(13, 148, 136, 0.3)' }}
                  >
                    {isCheckingDb ? <Loader2 size={18} className="spin-icon" /> : <RefreshCw size={18} />}
                    {isCheckingDb ? 'Kontrol Ediliyor...' : 'Tekrar Kontrol Et'}
                  </button>
                  <button
                    className="wizard-btn-secondary"
                    onClick={handleBypassSqlite}
                    style={{ width: 'auto' }}
                  >
                    JSON ile Devam Et (Test)
                  </button>
                </div>
              </div>
            )}

            {/* SQLite Sürücüsü Hazır, Göç Bekleniyor Durumu */}
            {!dbStatus.error && dbStatus.dbType === 'sqlite' && !dbStatus.isMigrated && (
              <div>
                {migrationStatus === 'idle' && (
                  <div>
                    <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: '1.6', marginBottom: '20px' }}>
                      SQLite veritabanı modülü sisteminizde aktif. 
                      Şimdi mevcut tüm JSON dosyalarınızdaki verileri (sınıflar, öğrenciler, sınavlar, teslimler vb.) 
                      güvenli bir şekilde yeni veritabanına aktarmamız gerekiyor.
                    </p>

                    <div style={{ backgroundColor: 'var(--color-background-secondary)', border: '1px solid #ccfbf1', borderRadius: '12px', padding: '16px', marginBottom: '24px' }}>
                      <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#0f766e', margin: '0 0 8px 0' }}>
                        Taşınacak Veriler:
                      </h4>
                      <ul style={{ fontSize: '13px', color: '#0f766e', margin: 0, paddingLeft: '20px', lineHeight: '1.8' }}>
                        <li>Sınıf tanımlamaları ve platform ayarları</li>
                        <li>Öğrenci ve öğretmen kayıtları</li>
                        <li>Oluşturulan sınavlar ve öğrenci teslim dosyaları</li>
                        <li>İstatistikler, bildirimler ve arşiv kayıtları</li>
                      </ul>
                    </div>

                    <button className="wizard-btn-primary" onClick={handleMigrate}>
                      <Database size={18} /> Verileri Güvenle Aktar ve Başlat
                    </button>
                  </div>
                )}

                {migrationStatus === 'migrating' && (
                  <div style={{ textAlign: 'center', padding: '10px 0' }}>
                    <Loader2 size={40} className="spin-icon" style={{ color: '#0d9488', margin: '0 auto 16px auto' }} />
                    <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--color-text-primary)', marginBottom: '8px' }}>
                      Veriler Aktarılıyor...
                    </h3>
                    <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
                      Lütfen işlemi bölmeyin veya sayfayı kapatmayın.
                    </p>

                    {/* Progress Bar */}
                    <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--color-border)', borderRadius: '4px', overflow: 'hidden', marginBottom: '20px' }}>
                      <div style={{ width: `${migrationProgress}%`, height: '100%', background: 'linear-gradient(90deg, #0d9488, #3b82f6)', transition: 'width 0.4s ease' }} />
                    </div>

                    {/* Console Logs */}
                    <div className="step-log">
                      {migrationLogs.map((log, index) => (
                        <div key={index} style={{ marginBottom: '4px', color: log.startsWith('❌') ? '#dc2626' : log.startsWith('✅') ? '#0d9488' : 'var(--color-text-secondary)' }}>
                          {log}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {migrationStatus === 'success' && (
                  <div style={{ textAlign: 'center', padding: '10px 0' }}>
                    <CheckCircle2 size={56} style={{ color: '#22c55e', margin: '0 auto 16px auto' }} />
                    <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--color-text-primary)', marginBottom: '8px' }}>
                      Veri Geçişi Başarılı!
                    </h3>
                    <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: '1.6', marginBottom: '24px' }}>
                      Tüm JSON verileriniz kayıpsız bir şekilde SQLite veritabanına taşındı. 
                      Sisteminiz artık en yüksek performanslı ve güvenli modda çalışmaya hazır.
                    </p>

                    <button className="wizard-btn-primary" onClick={handleFinishMigration} style={{ background: 'linear-gradient(135deg, #22c55e 0%, #15803d 100%)', boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)' }}>
                      <CheckCircle2 size={18} /> Sistemi Kullanmaya Başla
                    </button>
                  </div>
                )}

                {migrationStatus === 'error' && (
                  <div style={{ textAlign: 'center', padding: '10px 0' }}>
                    <AlertCircle size={56} style={{ color: '#ef4444', margin: '0 auto 16px auto' }} />
                    <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--color-text-primary)', marginBottom: '8px' }}>
                      Geçiş Sırasında Hata Oluştu
                    </h3>
                    <p style={{ fontSize: '14px', color: '#ef4444', marginBottom: '16px' }}>
                      {migrationError || 'Bilinmeyen bir hata oluştu.'}
                    </p>

                    <div className="step-log" style={{ marginBottom: '20px' }}>
                      {migrationLogs.map((log, index) => (
                        <div key={index} style={{ marginBottom: '4px', color: '#ef4444' }}>
                          {log}
                        </div>
                      ))}
                    </div>

                    <button className="wizard-btn-primary" onClick={handleMigrate} style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)' }}>
                      <RefreshCw size={18} /> Tekrar Dene
                    </button>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      )}

      {/* Passkey Modal */}
      <PasskeyModal
        isOpen={showPasskeyModal}
        onClose={() => setShowPasskeyModal(false)}
        userName={user?.fullName}
        onGoToSettings={() => navigate('/ogretmen/ayarlar')}
      />
    </div>
  );
};

export default TeacherLayout;

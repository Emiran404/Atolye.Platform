import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Users, User, Lock, ArrowLeft, Key } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Button, Input } from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import { useAuthStore } from '../../store/authStore';
import { useNotificationStore } from '../../store/notificationStore';
import { authApi } from '../../services/api';
import { t } from '../../utils/i18n';
import { canUsePasskey } from '../../utils/platform';


const TeacherLogin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { loginTeacher } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    rememberMe: false
  });
  const [errors, setErrors] = useState({});
  const [activeTab, setActiveTab] = useState(canUsePasskey() ? 'passkey' : 'password');
  const [mnComboPressed, setMnComboPressed] = useState(false);
  const [hasPasskey, setHasPasskey] = useState(false);

  // Recovery States
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [recoveryUsername, setRecoveryUsername] = useState('');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [recoveryNewPassword, setRecoveryNewPassword] = useState('');
  const [recoveryConfirmPassword, setRecoveryConfirmPassword] = useState('');

  // M+N kombinasyonu dinle
  React.useEffect(() => {
    let mPressed = false;
    let nPressed = false;

    const handleKeyDown = (e) => {
      if (e.key === 'm' || e.key === 'M') mPressed = true;
      if (e.key === 'n' || e.key === 'N') nPressed = true;

      if (mPressed && nPressed) {
        setMnComboPressed(true);
        if (hasPasskey) {
          setActiveTab('password');
        }
      }
    };

    const handleKeyUp = (e) => {
      if (e.key === 'm' || e.key === 'M') mPressed = false;
      if (e.key === 'n' || e.key === 'N') nPressed = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [hasPasskey, toast]);

  // Username değiştiğinde passkey durumunu kontrol et
  React.useEffect(() => {
    if (formData.username) {
      authApi.passkeyLoginChallenge(formData.username)
        .then((res) => setHasPasskey(res.success !== false))
        .catch(() => setHasPasskey(false));
    } else {
      setHasPasskey(false);
    }
  }, [formData.username]);

  // Parolayla aç için enter tuşu kontrolü
  const handlePasswordKeyDown = (e) => {
    if (activeTab === 'password' && e.key === 'Enter') {
      handleSubmit(e);
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.username) {
      newErrors.username = 'Kullanıcı adı gerekli';
      toast.warning('Lütfen kullanıcı adınızı girin');
    }
    if (activeTab === 'password' && !formData.password) {
      newErrors.password = 'Şifre gerekli';
      if (!newErrors.username) toast.warning('Lütfen şifrenizi girin');
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Passkey ile giriş (WebAuthn API - gerçek entegrasyon)
  const handlePasskeyLogin = async () => {
    if (!formData.username) {
      setErrors({ username: 'Kullanıcı adı gerekli' });
      toast.warning('Kullanıcı adı zorunlu!');
      return;
    }

    // Secure Context (HTTPS/localhost) kontrolü
    if (!window.isSecureContext) {
      toast.error('Passkey yalnızca güvenli bağlantılarda (HTTPS/localhost) çalışır.');
      setActiveTab('password');
      return;
    }

    // Tarayıcı desteği kontrolü
    if (!window.PublicKeyCredential || !navigator.credentials || !navigator.credentials.get) {
      toast.error('Passkey bu tarayıcıda desteklenmiyor.');
      toast.info('Lütfen şifre ile giriş yapın veya güncel Chrome, Edge, Safari kullanın.');
      setActiveTab('password'); // Şifre sekmesine geçir
      return;
    }

    setLoading(true);
    try {
      toast.info('Passkey ile giriş deneniyor...');

      // Backend'den challenge al
      const res = await authApi.passkeyLoginChallenge(formData.username);
      
      if (res.success === false) {
        toast.error(res.error || 'Passkey bulunamadı.');
        setActiveTab('password');
        setLoading(false);
        return;
      }

      const { challenge, credentialIds } = res;

      // WebAuthn ile kimlik doğrulama
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge: Uint8Array.from(atob(challenge.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)),
          allowCredentials: credentialIds.map(id => ({
            type: 'public-key',
            id: Uint8Array.from(atob(id), c => c.charCodeAt(0))
          })),
          timeout: 60000
        }
      });

      // Backend'e doğrulama gönder
      const authenticatorData = btoa(String.fromCharCode(...new Uint8Array(assertion.response.authenticatorData)));
      const clientDataJSON = btoa(String.fromCharCode(...new Uint8Array(assertion.response.clientDataJSON)));
      const signature = btoa(String.fromCharCode(...new Uint8Array(assertion.response.signature)));
      const credId = btoa(String.fromCharCode(...new Uint8Array(assertion.rawId)));

      const result = await authApi.passkeyLogin(
        formData.username, 
        credId, 
        authenticatorData, 
        clientDataJSON, 
        signature,
        formData.rememberMe
      );

      if (result.success) {
        toast.success('Passkey ile giriş başarılı!');
        // authStore'u güncelle
        useAuthStore.setState({
          user: result.user,
          userType: 'teacher',
          isAuthenticated: true,
          token: result.token,
          rememberMe: formData.rememberMe,
          lastActivity: Date.now()
        });

        // Giriş bildirimi oluştur
        const settings = result.user?.notificationSettings || { loginAlerts: true };
        if (settings.loginAlerts && result.user?.id) {
          const now = new Date();
          const browserInfo = navigator.userAgent.split(') ')[0].split(' (')[1] || 'Bilinmeyen Cihaz';
          const logDate = now.toLocaleDateString() + ' ' + now.toLocaleTimeString();
          const clientIp = result.clientIp || '127.0.0.1';
          
          useNotificationStore.getState().createNotification({
            type: 'security_alert',
            title: t('notifLoginTitle'),
            message: `${t('notifLoginDate')}: ${logDate}\n${t('notifLoginDevice')}: ${browserInfo}\n${t('notifLoginIP')}: ${clientIp}`,
            targetType: 'teacher',
            targetId: result.user.id
          });
        }

        // Kısa gecikme ile yönlendir
        setTimeout(() => {
          navigate('/ogretmen/panel');
        }, 500);
      } else {
        toast.error('Passkey doğrulama başarısız!');
      }
    } catch (error) {
      console.error('Passkey giriş hatası:', error);

      // Kullanıcı dostu hata mesajları
      if (error.name === 'NotAllowedError') {
        toast.error('Passkey kullanımı iptal edildi.');
        toast.info('Şifre ile giriş yapmayı deneyebilirsiniz.');
      } else if (error.name === 'NotSupportedError') {
        toast.error('Bu cihaz veya tarayıcı passkey desteklemiyor.');
        toast.info('Lütfen şifre ile giriş yapın.');
        setActiveTab('password');
      } else if (error.message && error.message.includes('credentials is undefined')) {
        toast.error('Passkey bu tarayıcıda desteklenmiyor.');
        toast.info('Lütfen şifre ile giriş yapın veya farklı tarayıcı deneyin.');
        setActiveTab('password');
      } else {
        toast.error('Passkey ile giriş başarısız: ' + (error.message || 'Bilinmeyen hata'));
        toast.info('Şifre ile giriş yapmayı deneyebilirsiniz.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    toast.info('Giriş yapılıyor...');
    try {
      const result = await loginTeacher(formData.username, formData.password, formData.rememberMe);
      if (result && result.success) {
        toast.success('Giriş başarılı! Yönlendiriliyorsunuz...');
        
        // Giriş bildirimi oluştur
        const settings = result.user?.notificationSettings || { loginAlerts: true };
        if (settings.loginAlerts && result.user?.id) {
          const now = new Date();
          const browserInfo = navigator.userAgent.split(') ')[0].split(' (')[1] || 'Bilinmeyen Cihaz';
          const logDate = now.toLocaleDateString() + ' ' + now.toLocaleTimeString();
          const clientIp = result.clientIp || '127.0.0.1';
          
          useNotificationStore.getState().createNotification({
            type: 'security_alert',
            title: t('notifLoginTitle'),
            message: `${t('notifLoginDate')}: ${logDate}\n${t('notifLoginDevice')}: ${browserInfo}\n${t('notifLoginIP')}: ${clientIp}`,
            targetType: 'teacher',
            targetId: result.user.id
          });
        }

        navigate('/ogretmen/panel');
      } else {
        toast.error(result.error || 'Giriş başarısız!');
      }
    } catch (error) {
      toast.error('Bağlantı hatası! Lütfen tekrar deneyin.');
    }
    setLoading(false);
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const handleRecoveryReset = async (e) => {
    e.preventDefault();

    if (!recoveryUsername || !recoveryKey || !recoveryNewPassword || !recoveryConfirmPassword) {
      toast.warning('Lütfen tüm alanları doldurun.');
      return;
    }

    if (recoveryNewPassword !== recoveryConfirmPassword) {
      toast.error('Yeni şifreler eşleşmiyor!');
      return;
    }

    if (recoveryNewPassword.length < 6) {
      toast.error('Şifre en az 6 karakter olmalıdır.');
      return;
    }

    try {
      setLoading(true);
      const result = await authApi.resetPasswordWithKey(recoveryUsername, recoveryKey, recoveryNewPassword);

      if (result.success) {
        toast.success('Şifreniz başarıyla sıfırlandı! Yeni şifrenizle giriş yapabilirsiniz.');
        setShowRecoveryModal(false);
        setActiveTab('password');
        setFormData(prev => ({ ...prev, username: recoveryUsername, password: '' }));
        // Reset recovery fields
        setRecoveryKey('');
        setRecoveryNewPassword('');
        setRecoveryConfirmPassword('');
      }
    } catch (error) {
      toast.error(error.message || 'Şifre sıfırlama başarısız!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #eef2ff 0%, #faf5ff 50%, #fdf2f8 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px'
    }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>
        <Link
          to="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            color: 'var(--color-text-muted)',
            textDecoration: 'none',
            marginBottom: '24px',
            fontSize: '14px'
          }}
        >
          <ArrowLeft style={{ width: '16px', height: '16px' }} />
          Ana Sayfa
        </Link>

        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '64px',
            height: '64px',
            background: 'linear-gradient(135deg, #6366f1, #a855f7)',
            borderRadius: '16px',
            marginBottom: '16px',
            boxShadow: '0 10px 25px -5px rgba(99, 102, 241, 0.4)'
          }}>
            <Users style={{ width: '32px', height: '32px', color: 'white' }} />
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--color-text-primary)', marginBottom: '8px' }}>
            Öğretmen Girişi
          </h1>
          <p style={{ color: 'var(--color-text-muted)' }}>Atölye Sınav Platformuna hoş geldiniz</p>
        </div>

        <div style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: '16px',
          padding: '32px',
          boxShadow: '0 10px 40px -10px rgba(0,0,0,0.1)',
          border: '1px solid var(--color-border)'
        }}>
          {/* Sekmeler */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
            <button
              type="button"
              onClick={() => {
                if (canUsePasskey()) {
                  setActiveTab('passkey');
                } else {
                  toast.warning('Passkey bu platformda kullanılamaz.');
                }
              }}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '10px',
                border: activeTab === 'passkey' ? '2px solid #6366f1' : '2px solid #e2e8f0',
                background: !canUsePasskey()
                  ? 'var(--color-background-secondary)'
                  : activeTab === 'passkey'
                    ? 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)'
                    : 'var(--color-background)',
                color: !canUsePasskey() ? '#94a3b8' : activeTab === 'passkey' ? '#fff' : '#6366f1',
                fontWeight: '600',
                cursor: canUsePasskey() ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s',
                opacity: canUsePasskey() ? 1 : 0.7,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px'
              }}
              disabled={!canUsePasskey()}
            >
              {canUsePasskey() ? 'Passkey ile Giriş' : 'Kullanılamaz'} 
              {!canUsePasskey() && <Lock size={14} />}
            </button>
            <button
              type="button"
              onClick={() => {
                if (hasPasskey && !mnComboPressed) {
                  return;
                }
                setActiveTab('password');
              }}
              disabled={hasPasskey && !mnComboPressed}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '10px',
                border: activeTab === 'password' ? '2px solid #6366f1' : '2px solid #e2e8f0',
                background: (hasPasskey && !mnComboPressed)
                  ? 'var(--color-border)'
                  : activeTab === 'password'
                    ? 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)'
                    : 'var(--color-background)',
                color: (hasPasskey && !mnComboPressed) ? '#94a3b8' : activeTab === 'password' ? '#fff' : '#6366f1',
                fontWeight: '600',
                cursor: (hasPasskey && !mnComboPressed) ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                opacity: (hasPasskey && !mnComboPressed) ? 0.6 : 1
              }}
            >
              Parolayla Aç {hasPasskey && !mnComboPressed && '🔒'}
            </button>
          </div>

          {/* Passkey ile Giriş */}
          {activeTab === 'passkey' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <Input
                label="Kullanıcı Adı"
                icon={User}
                type="text"
                placeholder="ahmet_ogretmen"
                value={formData.username}
                onChange={(e) => handleChange('username', e.target.value)}
                error={errors.username}
                required
              />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formData.rememberMe}
                    onChange={(e) => handleChange('rememberMe', e.target.checked)}
                    style={{ width: '16px', height: '16px', accentColor: '#6366f1' }}
                  />
                  <span style={{ fontSize: '14px', color: 'var(--color-text-muted)' }}>Beni hatırla</span>
                </label>
              </div>
              <button
                type="button"
                onClick={handlePasskeyLogin}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '10px',
                  background: canUsePasskey() 
                    ? 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)'
                    : 'var(--color-border)',
                  color: canUsePasskey() ? '#fff' : '#94a3b8',
                  fontWeight: '600',
                  fontSize: '16px',
                  border: 'none',
                  cursor: canUsePasskey() ? 'pointer' : 'not-allowed',
                  boxShadow: canUsePasskey() ? '0 4px 14px rgba(99,102,241,0.15)' : 'none',
                  marginTop: '8px'
                }}
                disabled={loading || !canUsePasskey()}
              >
                {canUsePasskey() ? 'Passkey ile Giriş Yap' : 'Platform Desteklenmiyor'}
              </button>
              <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', textAlign: 'center', marginTop: '8px' }}>
                {canUsePasskey() 
                  ? 'Windows Hello, Linux (Pardus) ve MacOS ile uyumlu.' 
                  : 'Tarayıcınız Passkey desteklemiyor.'}
              </p>
            </div>
          )}

          {/* Parolayla Aç */}
          {activeTab === 'password' && (
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <Input
                  label="Kullanıcı Adı"
                  icon={User}
                  type="text"
                  placeholder="ahmet_ogretmen"
                  value={formData.username}
                  onChange={(e) => handleChange('username', e.target.value)}
                  error={errors.username}
                  required
                />

                <Input
                  label="Şifre"
                  icon={Lock}
                  type="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => handleChange('password', e.target.value)}
                  error={errors.password}
                  required
                  onKeyDown={handlePasswordKeyDown}
                />

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formData.rememberMe}
                      onChange={(e) => handleChange('rememberMe', e.target.checked)}
                      style={{ width: '16px', height: '16px', accentColor: '#6366f1' }}
                    />
                    <span style={{ fontSize: '14px', color: 'var(--color-text-muted)' }}>Beni hatırla</span>

                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setRecoveryUsername(formData.username);
                      setShowRecoveryModal(true);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#6366f1',
                      fontSize: '14px',
                      cursor: 'pointer',
                      fontWeight: '500'
                    }}
                  >
                    Şifremi Unuttum?
                  </button>
                </div>

                <button
                  type="submit"
                  style={{
                    width: '100%',
                    padding: '14px',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                    color: 'var(--color-text-inverse, #fff)',
                    fontWeight: '600',
                    fontSize: '16px',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(99,102,241,0.15)',
                    marginTop: '8px'
                  }}
                  disabled={loading}
                >
                  Parolayla Aç
                </button>
                <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', textAlign: 'center', marginTop: '8px' }}>
                  Giriş yapmak için bilgileri girip Enter tuşuna basın.
                </p>
              </div>
            </form>
          )}


          {/* Recovery Modal */}
          <Modal isOpen={showRecoveryModal} onClose={() => setShowRecoveryModal(false)} title="Şifre Sıfırlama">
            <div style={{ padding: '8px 24px 24px' }}>
              <div style={{
                marginBottom: '24px',
                padding: '16px',
                backgroundColor: 'var(--color-background)',
                borderRadius: '12px',
                border: '1px solid var(--color-border)'
              }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div style={{
                    padding: '8px',
                    backgroundColor: 'var(--color-primary-light)',
                    borderRadius: '8px',
                    color: '#4f46e5'
                  }}>
                    <Key size={20} />
                  </div>
                  <div>
                    <h4 style={{ margin: '0 0 4px 0', color: 'var(--color-text-primary)', fontSize: '15px', fontWeight: '600' }}>Kurtarma Anahtarı</h4>
                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: '1.5' }}>
                      Hesabınızı kurtarmak için "Ayarlar" sayfasından aldığınız özel anahtarı girin.
                    </p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleRecoveryReset} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <Input
                  label="Kullanıcı Adı"
                  icon={User}
                  value={recoveryUsername}
                  onChange={(e) => setRecoveryUsername(e.target.value)}
                  placeholder="Kullanıcı adınız"
                  required
                />

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '14px', fontWeight: '500', color: 'var(--color-foreground-secondary)', marginLeft: '4px' }}>Kurtarma Anahtarı</label>
                  <div style={{ position: 'relative' }}>
                    <Key size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input
                      type="text"
                      value={recoveryKey}
                      onChange={(e) => setRecoveryKey(e.target.value)}
                      placeholder="POLYOS-REC-XXXX-XXXX-XXXX-XXXX"
                      style={{
                        width: '100%',
                        padding: '12px 16px 12px 48px',
                        borderRadius: '12px',
                        border: '1px solid var(--color-border)',
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                        fontSize: '15px',
                        backgroundColor: 'var(--color-background)',
                        color: 'var(--color-foreground-secondary)',
                        transition: 'all 0.2s',
                        outline: 'none',
                        letterSpacing: '0.5px'
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#6366f1';
                        e.target.style.backgroundColor = '#fff';
                        e.target.style.boxShadow = '0 0 0 4px rgba(99, 102, 241, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = 'var(--color-border)';
                        e.target.style.backgroundColor = 'var(--color-background)';
                        e.target.style.boxShadow = 'none';
                      }}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <Input
                    label="Yeni Şifre"
                    icon={Lock}
                    type="password"
                    value={recoveryNewPassword}
                    onChange={(e) => setRecoveryNewPassword(e.target.value)}
                    placeholder="Yeni şifre"
                    required
                  />

                  <Input
                    label="Tekrar"
                    icon={Lock}
                    type="password"
                    value={recoveryConfirmPassword}
                    onChange={(e) => setRecoveryConfirmPassword(e.target.value)}
                    placeholder="Şifre tekrar"
                    required
                  />
                </div>

                <div style={{ marginTop: '12px', display: 'flex', gap: '16px' }}>
                  <Button
                    type="button"
                    onClick={() => setShowRecoveryModal(false)}
                    style={{
                      flex: 1,
                      backgroundColor: 'var(--color-surface)',
                      color: 'var(--color-text-muted)',
                      border: '1px solid var(--color-border)',
                      padding: '12px',
                      borderRadius: '12px',
                      fontWeight: '500',
                      transition: 'all 0.2s'
                    }}
                    onMouseOver={(e) => e.target.style.backgroundColor = 'var(--color-background)'}
                    onMouseOut={(e) => e.target.style.backgroundColor = '#fff'}
                  >
                    İptal
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading}
                    style={{
                      flex: 2,
                      background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                      border: 'none',
                      padding: '12px',
                      borderRadius: '12px',
                      fontWeight: '600',
                      boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)',
                      transition: 'transform 0.1s'
                    }}
                    onMouseDown={(e) => e.target.style.transform = 'scale(0.98)'}
                    onMouseUp={(e) => e.target.style.transform = 'scale(1)'}
                  >
                    Şifreyi Sıfırla
                  </Button>
                </div>
              </form>
            </div>
          </Modal>

          <div style={{ marginTop: '24px', textAlign: 'center' }}>
            <p style={{ fontSize: '14px', color: 'var(--color-text-muted)' }}>
              Hesabınız yok mu?{' '}
              <Link to="/ogretmen/kayit" style={{ color: '#6366f1', textDecoration: 'none', fontWeight: '500' }}>
                Kayıt Ol
              </Link>
            </p>
          </div>
        </div>

        <p style={{ textAlign: 'center', fontSize: '14px', color: 'var(--color-text-muted)', marginTop: '24px' }}>
          Öğrenci misiniz?{' '}
          <Link to="/ogrenci/giris" style={{ color: '#6366f1', textDecoration: 'none', fontWeight: '500' }}>
            Öğrenci girişi
          </Link>
        </p>
      </div >
    </div >
  );
};

export { TeacherLogin };

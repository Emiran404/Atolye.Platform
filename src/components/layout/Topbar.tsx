import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, LogOut, User, Sun, Moon, Settings, Check, ArrowRight, DownloadCloud } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { useNotificationStore } from '../../store/notificationStore';
import { useToast } from '../ui/Toast';
import { t } from '../../utils/i18n';
import { formatRelativeTime } from '../../utils/dateHelpers';

const Topbar = () => {
  const navigate = useNavigate();
  const { user, userType, logout, theme, toggleTheme } = useAuthStore();
  const { notifications, unreadCount, loadNotifications, markAsRead, markAllAsRead, pushEnabled } = useNotificationStore();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotificationMenu, setShowNotificationMenu] = useState(false);

  const { toast } = useToast();
  const { isInstallable, promptInstall } = usePWAInstall();

  const handleLogout = () => {
    navigate('/login');
  };

  const displayName = user?.fullName || user?.username || t('user');
  const displayInfo = userType === 'student' 
    ? `${user?.studentNumber} - ${user?.className}` 
    : user?.department;

  return (
    <header className="h-16 bg-slate-900/80 backdrop-blur-sm border-b border-slate-800 flex items-center justify-between px-6 sticky top-0 z-30">
      {/* Left - Page Title (optional) */}
      <div className="flex items-center gap-4">
        {/* Can be used for breadcrumb or page title */}
      </div>

      {/* Right - User Info & Actions */}
      <div className="flex items-center gap-4">
        {/* PWA Install Button */}
        {isInstallable && (
          <button
            onClick={promptInstall}
            className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-500 rounded-lg transition-colors border border-emerald-600/20"
            title="Uygulamayı Yükle"
          >
            <DownloadCloud className="w-4 h-4" />
            <span className="text-sm font-medium hidden sm:inline">Yükle</span>
          </button>
        )}

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          title={theme === 'dark' ? t('lightTheme') : t('darkTheme')}
        >
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotificationMenu(!showNotificationMenu)}
            className="relative p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notification Dropdown */}
          {showNotificationMenu && (
            <>
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setShowNotificationMenu(false)}
              />
              <div className="absolute right-0 mt-2 w-80 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 flex flex-column overflow-hidden">
                <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/90">
                  <h3 className="font-semibold text-slate-200">{t('notificationsPage')}</h3>
                  {unreadCount > 0 && (
                    <button 
                      onClick={() => markAllAsRead(userType, user.id)}
                      className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                    >
                      <Check className="w-3 h-3" />
                      {t('markAllAsRead')}
                    </button>
                  )}
                </div>
                
                <div className="max-h-80 overflow-y-auto">
                  {notifications?.length > 0 ? (
                    notifications.slice(0, 5).map((notif) => (
                      <div 
                        key={notif.id}
                        onClick={() => {
                          if (!notif.isRead) markAsRead(notif.id);
                        }}
                        className={`p-4 border-b border-slate-700/50 hover:bg-slate-700/50 cursor-pointer transition-colors ${!notif.isRead ? 'bg-slate-700/30' : ''}`}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <h4 className={`text-sm ${!notif.isRead ? 'font-semibold text-slate-200' : 'text-slate-300'}`}>{notif.title}</h4>
                          <span className="text-xs text-slate-500 whitespace-nowrap ml-2">
                            {formatRelativeTime(notif.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm text-slate-400 line-clamp-2">{notif.message}</p>
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center text-slate-500">
                      <Bell className="w-8 h-8 mx-auto mb-2 opacity-20" />
                      <p className="text-sm">{t('noNotificationsYet')}</p>
                    </div>
                  )}
                </div>

                <div className="p-3 border-t border-slate-700 bg-slate-800/90 text-center">
                  <button
                    onClick={() => {
                      setShowNotificationMenu(false);
                      navigate(`/${userType}/notifications`);
                    }}
                    className="text-sm text-blue-400 hover:text-blue-300 flex items-center justify-center gap-1 w-full"
                  >
                    <span>{t('viewAllNotifications')}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Divider */}
        <div className="w-px h-8 bg-slate-700" />

        {/* User Info with Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <div className="w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-white" />
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-sm font-medium text-slate-200">{displayName}</p>
              <p className="text-xs text-slate-500">{displayInfo}</p>
            </div>
          </button>

          {/* Dropdown Menu */}
          {showProfileMenu && (
            <>
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setShowProfileMenu(false)}
              />
              <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden">
                <button
                  onClick={() => {
                    navigate(`/${userType}/settings`);
                    setShowProfileMenu(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  <span className="text-sm">{t('settings')}</span>
                </button>
                <button
                  onClick={() => {
                    handleLogout();
                    setShowProfileMenu(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-slate-700 transition-colors border-t border-slate-700"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="text-sm">{t('logout')}</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Topbar;

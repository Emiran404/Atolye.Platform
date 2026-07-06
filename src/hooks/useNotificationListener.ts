import { useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore, showPushNotification } from '../store/notificationStore';
import { useToast } from '../components/ui/Toast';
import { t } from '../utils/i18n';
import { getNotificationTranslation } from '../utils/notificationHelpers';

/**
 * Global notification listener hook.
 * Polls for new notifications and triggers browser push notifications + in-app toasts.
 */
export const useNotificationListener = () => {
  const { user, userType, isAuthenticated } = useAuthStore();
  const {
    notifications,
    unreadCount,
    loadNotifications,
    pushEnabled,
    enablePushNotifications
  } = useNotificationStore();

  const { toast } = useToast();
  const prevUnreadCountRef = useRef(0);
  const lastProcessedNotifIdRef = useRef(null);
  const isRefreshingRef = useRef(false);
  // İlk yükleme bayrağı: sayfa açıldığında/yenilendiğinde zaten var olan
  // okunmamış bildirimler için toast ATILMAZ; yalnızca oturum sırasında gelen
  // YENİ bildirimler toast tetikler. (Aksi halde okunmamış bir bildirim varken
  // her F5'te aynı toast tekrar çıkıyordu.)
  const isInitialLoadRef = useRef(true);

  // Sync push enabled state with browser permission on mount
  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      enablePushNotifications();
    }
  }, [enablePushNotifications]);

  // Polling for notifications
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    const fetchNotifications = async () => {
      if (isRefreshingRef.current) return;
      isRefreshingRef.current = true;
      try {
        await loadNotifications(userType, user.id);
      } finally {
        isRefreshingRef.current = false;
      }
    };

    // Initial load
    fetchNotifications();

    // Set polling interval (15 seconds for more responsive "live" feel)
    const intervalId = setInterval(fetchNotifications, 15000);

    return () => clearInterval(intervalId);
  }, [isAuthenticated, user, userType, loadNotifications]);

  // Check for new notifications to fire Push API and Toast
  useEffect(() => {
    if (!notifications || notifications.length === 0) {
      prevUnreadCountRef.current = 0;
      return;
    }

    // Determine the latest unread notification
    const unreadNotifications = notifications.filter(n => !n.isRead);

    // İlk yükleme: mevcut okunmamış bildirimleri sessizce "işlenmiş" say ve çık.
    // Böylece sayfa yenilendiğinde eski bir okunmamış bildirim tekrar toast atmaz.
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      lastProcessedNotifIdRef.current = unreadNotifications[0]?.id ?? null;
      prevUnreadCountRef.current = unreadCount;
      return;
    }

    if (unreadNotifications.length > 0) {
      const latestNotif = unreadNotifications[0];

      // Fire notification if unread count increased OR it's a new ID we haven't processed
      const isNewNotification =
        unreadCount > prevUnreadCountRef.current ||
        (latestNotif.id !== lastProcessedNotifIdRef.current);

      if (isNewNotification) {
        // Update refs immediately to prevent double firing
        lastProcessedNotifIdRef.current = latestNotif.id;

        // Translate notification
        const { title, message } = getNotificationTranslation(latestNotif);

        // In-app Toast Notification
        toast.info(title, {
          description: message.length > 80
            ? message.substring(0, 80) + '...'
            : message
        });

        // Browser Push Notification
        if (pushEnabled || (typeof Notification !== 'undefined' && Notification.permission === 'granted')) {
          showPushNotification(title, {
            body: message,
            tag: latestNotif.type || 'new-notification',
            requireInteraction: true // Keep it visible until the user interacts
          });
        }
      }
    }

    prevUnreadCountRef.current = unreadCount;
  }, [unreadCount, notifications, pushEnabled, toast]);

  return { notifications, unreadCount };
};

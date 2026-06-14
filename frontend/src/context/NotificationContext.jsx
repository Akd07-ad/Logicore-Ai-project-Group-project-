import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import useSocket from '../hooks/useSocket';
import { WS_BASE_URL } from '../utils/api';
import { normalizeNotification } from '../utils/notifications';

export const NotificationContext = createContext();

const STORAGE_PREFIX = 'app_notifications';

function getStorageKey(userId) {
  return `${STORAGE_PREFIX}_${userId || 'anonymous'}`;
}

function readStoredNotifications(storageKey) {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      return JSON.parse(saved);
    }

    const legacy = localStorage.getItem('app_notifications');
    if (legacy) {
      return JSON.parse(legacy);
    }
  } catch (error) {
    console.warn('Failed to read notifications from localStorage', error);
  }

  return [];
}

export function NotificationProvider({ children, userId }) {
  const storageKey = useMemo(() => getStorageKey(userId), [userId]);
  const [notifications, setNotifications] = useState([]);
  const [lastAddedNotification, setLastAddedNotification] = useState(null);

  const persistNotifications = useCallback(
    (nextNotifications) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(nextNotifications));
        localStorage.setItem('app_notifications', JSON.stringify(nextNotifications));
      } catch (error) {
        console.warn('Unable to persist notifications to localStorage', error);
      }
    },
    [storageKey]
  );

  const replaceNotifications = useCallback(
    (updater) => {
      setNotifications((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        persistNotifications(next);
        return next;
      });
    },
    [persistNotifications]
  );

  const handleMessage = useCallback((message) => {
    if (message.type === 'notification') {
      const newNotif = normalizeNotification({
        id: message.id,
        type: message.notification_type,
        title: message.title,
        message: message.message,
        data: message.data,
        source: message.source || message.module_name || 'System',
        isRead: false,
        timestamp: message.created_at,
      });
      replaceNotifications((prev) => [newNotif, ...prev.filter((item) => item.id !== newNotif.id)]);
      setLastAddedNotification(newNotif);
    }
  }, [replaceNotifications]);

  const addNotification = useCallback((notification) => {
    const nextNotification = normalizeNotification({
      ...notification,
      isRead: Boolean(notification.isRead ?? notification.is_read),
      timestamp: notification.timestamp || notification.created_at,
    });

    replaceNotifications((prev) => [nextNotification, ...prev.filter((item) => item.id !== nextNotification.id)]);

    setLastAddedNotification(nextNotification);

    return nextNotification;
  }, [replaceNotifications]);

  const wsUrl = userId ? `${WS_BASE_URL}/ws/notifications/${userId}` : null;
  useSocket(wsUrl, { onMessage: handleMessage, enabled: !!userId });

  const setNotificationReadState = useCallback((notificationId, isRead) => {
    replaceNotifications((prev) =>
      prev.map((notification) =>
        notification.id === notificationId
          ? { ...notification, isRead, is_read: isRead }
          : notification
      )
    );
  }, [replaceNotifications]);

  const markAsRead = useCallback((notificationId) => {
    setNotificationReadState(notificationId, true);
  }, [setNotificationReadState]);

  const markAsUnread = useCallback((notificationId) => {
    setNotificationReadState(notificationId, false);
  }, [setNotificationReadState]);

  const markAllAsRead = useCallback(() => {
    replaceNotifications((prev) => prev.map((notification) => ({ ...notification, isRead: true, is_read: true })));
  }, [replaceNotifications]);

  const clearAllNotifications = useCallback(() => {
    replaceNotifications([]);
    setLastAddedNotification(null);
  }, [replaceNotifications]);

  useEffect(() => {
    const stored = readStoredNotifications(storageKey)
      .map((notification) => normalizeNotification(notification))
      .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime());

    setNotifications(stored);
  }, [storageKey]);

  useEffect(() => {
    const handleStorageChange = (event) => {
      if (event.key !== storageKey && event.key !== 'app_notifications') return;
      const stored = readStoredNotifications(storageKey)
        .map((notification) => normalizeNotification(notification))
        .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime());
      setNotifications(stored);
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [storageKey]);

  useEffect(() => {
    persistNotifications(notifications);
  }, [notifications, persistNotifications]);

  const unreadCount = useMemo(() => notifications.filter((notification) => !notification.isRead && !notification.is_read).length, [notifications]);

  const value = {
    notifications,
    unreadCount,
    markAsRead,
    markAsUnread,
    markAllAsRead,
    clearAllNotifications,
    addNotification,
    lastAddedNotification,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

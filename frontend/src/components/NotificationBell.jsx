import React, { useContext, useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { NotificationContext } from '../context/NotificationContext';
import { getNotificationMeta } from '../utils/notifications';

export default function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useContext(NotificationContext);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = (notification) => {
    if (!(notification.isRead ?? notification.is_read)) {
      markAsRead(notification.id);
    }
  };

  const getNotificationIcon = (type) => {
    const meta = getNotificationMeta({ type });
    return meta.icon === 'check-circle' ? '✓' : meta.icon === 'alert-triangle' ? '!' : meta.icon === 'shield-alert' ? '!' : 'i';
  };

  return (
    <div ref={dropdownRef} className="relative">
      {/* Bell Icon Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-300 hover:text-cyan-300 transition-colors"
        aria-label="Notifications"
      >
        {/* Bell Icon */}
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0018 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {/* Unread Badge */}
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-500 rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-slate-800 border border-slate-700 rounded-2xl shadow-lg z-50">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-700">
            <h3 className="font-bold text-slate-100">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-cyan-300 hover:text-cyan-200"
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* Notification List */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-slate-400">
                <p>No notifications yet</p>
              </div>
            ) : (
              notifications.map((notification) => {
                const notificationMeta = getNotificationMeta(notification);
                const isUnread = !(notification.isRead ?? notification.is_read);

                return (
                  <button
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`w-full border-b border-slate-700 px-4 py-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-750 ${
                      notificationMeta.variant === 'prediction' ? 'bg-slate-950/90' : isUnread ? 'bg-slate-750' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`text-lg shrink-0 ${notificationMeta.variant === 'prediction' ? 'text-cyan-200' : 'text-slate-300'}`}>
                        {getNotificationIcon(notification.type)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className={`text-sm font-semibold ${notificationMeta.variant === 'prediction' ? 'text-white' : 'text-slate-100'}`}>
                            {notification.title}
                          </h4>
                          {isUnread && (
                            <div className="w-2 h-2 shrink-0 rounded-full bg-cyan-400" />
                          )}
                        </div>
                        <p className={`line-clamp-2 text-xs ${notificationMeta.variant === 'prediction' ? 'text-slate-200/90' : 'text-slate-400'}`}>
                          {notification.message}
                        </p>
                        <time className="mt-1 block text-xs text-slate-500">
                          {new Date(notification.timestamp || notification.created_at).toLocaleString()}
                        </time>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="p-3 border-t border-slate-700 text-center">
              <Link to="/notifications" className="text-xs text-cyan-300 hover:text-cyan-200" onClick={() => setIsOpen(false)}>
                View all notifications →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

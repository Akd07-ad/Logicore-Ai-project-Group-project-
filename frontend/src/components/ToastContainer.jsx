import React, { useContext, useEffect, useState } from 'react';
import { NotificationContext } from '../context/NotificationContext';
import { getNotificationMeta } from '../utils/notifications';

export default function ToastContainer() {
  const { lastAddedNotification } = useContext(NotificationContext);
  const [visibleToast, setVisibleToast] = useState(null);

  useEffect(() => {
    if (!lastAddedNotification) return;
    setVisibleToast(lastAddedNotification);
    const timer = setTimeout(() => setVisibleToast(null), 5000);
    return () => clearTimeout(timer);
  }, [lastAddedNotification]);

  if (!visibleToast) return null;

  const notificationType = getNotificationMeta(visibleToast);

  return (
    <div className="fixed right-4 bottom-6 z-50 w-full max-w-sm">
      <div className="pointer-events-auto mb-2 w-full">
        <div className={`animate-slide-in transform-gpu rounded-2xl border ${notificationType.borderClass} ${notificationType.fillClass} p-4 shadow-[0_22px_60px_rgba(2,6,23,0.45)] text-slate-100 backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_26px_70px_rgba(2,6,23,0.5)]`}>
          <div className="flex items-start gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg ${notificationType.variant === 'prediction' ? 'bg-cyan-400/10 text-cyan-200' : `bg-slate-950/60 ${notificationType.textClass}`}`}>
              {notificationType.icon === 'check-circle' ? '✓' : notificationType.icon === 'alert-triangle' ? '!' : notificationType.icon === 'shield-alert' ? '!' : 'i'}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between gap-3">
                <strong className={`block text-sm ${notificationType.titleClass}`}>{visibleToast.title}</strong>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.22em] ${notificationType.badgeClass}`}>
                  {visibleToast.type}
                </span>
              </div>
              <p className={`mt-1 text-xs ${notificationType.messageClass}`}>{visibleToast.message}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-300/90">
                <span>{visibleToast.source || visibleToast.module || 'System'}</span>
                <span className="text-slate-500">•</span>
                <time>{new Date(visibleToast.timestamp || visibleToast.created_at).toLocaleTimeString()}</time>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

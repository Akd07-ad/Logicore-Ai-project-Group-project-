import React, { useContext, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCheck,
  Filter,
  Inbox,
  RotateCcw,
  Trash2,
  Bell,
  ShieldAlert,
  Info,
  TriangleAlert,
  CircleCheck,
} from 'lucide-react';
import { NotificationContext } from '../context/NotificationContext';
import { getNotificationMeta } from '../utils/notifications';

export default function NotificationsPage() {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAsUnread,
    markAllAsRead,
    clearAllNotifications,
  } = useContext(NotificationContext);
  const navigate = useNavigate();
  const [sourceFilter, setSourceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const sources = useMemo(() => {
    return ['all', ...new Set(notifications.map((notification) => notification.source || notification.module || 'System'))];
  }, [notifications]);

  const filteredNotifications = useMemo(() => {
    const next = notifications.filter((notification) => {
      const notificationSource = notification.source || notification.module || 'System';
      const isUnread = !(notification.isRead ?? notification.is_read);
      const matchesSource = sourceFilter === 'all' || notificationSource === sourceFilter;
      const matchesStatus = statusFilter === 'all' || (statusFilter === 'unread' && isUnread) || (statusFilter === 'read' && !isUnread);
      return matchesSource && matchesStatus;
    });

    return next.sort((left, right) => new Date(right.timestamp || right.created_at).getTime() - new Date(left.timestamp || left.created_at).getTime());
  }, [notifications, sourceFilter, statusFilter]);

  const lastUpdatedLabel = filteredNotifications[0]
    ? new Date(filteredNotifications[0].timestamp || filteredNotifications[0].created_at).toLocaleString()
    : 'No notifications yet';

  const handleClearAll = () => {
    if (window.confirm('Clear all notifications? This action cannot be undone.')) {
      clearAllNotifications();
    }
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate('/dashboard');
  };

  const iconForType = (type) => {
    switch (type) {
      case 'success':
        return CircleCheck;
      case 'warning':
        return TriangleAlert;
      case 'danger':
        return ShieldAlert;
      default:
        return Info;
    }
  };

  const summaryCards = [
    { label: 'Total notifications', value: notifications.length, icon: Bell, accent: 'text-cyan-300' },
    { label: 'Unread', value: unreadCount, icon: Inbox, accent: 'text-amber-300' },
    { label: 'Sources', value: Math.max(0, sources.length - 1), icon: Filter, accent: 'text-emerald-300' },
  ];

  return (
    <div className="min-h-screen bg-linear-to-b from-[#050814] via-[#0c1327] to-[#050814] p-4 text-slate-100 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-slate-700/60 bg-slate-900/75 p-5 shadow-[0_18px_60px_rgba(2,6,23,0.45)] backdrop-blur-xl">
          <div className="mb-5 flex justify-start">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-700/80 bg-slate-950/60 px-4 py-2.5 text-sm font-bold text-slate-200 transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-400/35 hover:bg-slate-900 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
          </div>

          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-cyan-300">Global Activity Feed</p>
              <h1 className="mt-1 text-3xl font-black text-white">Notifications</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">A single live history for Study Planner, Task Tracker, Focus Mode, Reminders, and Predictions.</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={markAllAsRead}
                className="inline-flex items-center gap-2 rounded-2xl bg-cyan-500 px-4 py-2.5 text-sm font-black text-slate-950 transition hover:bg-cyan-400"
              >
                <CheckCheck className="h-4 w-4" />
                Mark all read
              </button>
              <button
                onClick={handleClearAll}
                className="inline-flex items-center gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-sm font-bold text-rose-300 transition hover:bg-rose-500/20"
              >
                <Trash2 className="h-4 w-4" />
                Clear all
              </button>
            </div>
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-3">
          {summaryCards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="rounded-3xl border border-slate-700/60 bg-slate-900/70 p-4 shadow-[0_12px_36px_rgba(2,6,23,0.35)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{card.label}</p>
                    <p className={`mt-2 text-3xl font-black ${card.accent}`}>{card.value}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-800/70 p-3 text-cyan-300">
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <section className="grid gap-4 rounded-3xl border border-slate-700/60 bg-slate-900/70 p-4 shadow-[0_12px_36px_rgba(2,6,23,0.35)] lg:grid-cols-[1fr_auto_auto_auto] lg:items-end">
          <label className="space-y-2 text-sm">
            <span className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Filter source/module</span>
            <select
              value={sourceFilter}
              onChange={(event) => setSourceFilter(event.target.value)}
              className="w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-400"
            >
              {sources.map((source) => (
                <option key={source} value={source}>{source === 'all' ? 'All sources' : source}</option>
              ))}
            </select>
          </label>

          <label className="space-y-2 text-sm">
            <span className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Status</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-400"
            >
              <option value="all">All</option>
              <option value="unread">Unread</option>
              <option value="read">Read</option>
            </select>
          </label>

          <div className="rounded-2xl border border-slate-700 bg-slate-950/50 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Live updated</p>
            <p className="mt-1 text-sm font-bold text-white">{lastUpdatedLabel}</p>
          </div>

          <button
            type="button"
            onClick={() => {
              setSourceFilter('all');
              setStatusFilter('all');
            }}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-sm font-bold text-slate-200 transition hover:bg-slate-800"
          >
            <RotateCcw className="h-4 w-4" />
            Reset filters
          </button>
        </section>

        <section className="rounded-3xl border border-slate-700/60 bg-slate-900/70 p-4 shadow-[0_12px_36px_rgba(2,6,23,0.35)]">
          {filteredNotifications.length === 0 ? (
            <div className="flex min-h-72 flex-col items-center justify-center rounded-3xl border border-dashed border-slate-700 bg-slate-950/40 p-8 text-center">
              <div className="rounded-2xl bg-cyan-500/10 p-4 text-cyan-300">
                <Inbox className="h-8 w-8" />
              </div>
              <h2 className="mt-4 text-xl font-black text-white">No notifications match your filters</h2>
              <p className="mt-2 max-w-md text-sm text-slate-400">New notifications will appear here immediately when actions happen anywhere in the app.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence initial={false} mode="popLayout">
                {filteredNotifications.map((notification) => {
                  const isRead = Boolean(notification.isRead ?? notification.is_read);
                  const notificationMeta = getNotificationMeta(notification);
                  const TypeIcon = iconForType(notification.type);
                  const source = notification.source || notification.module || 'System';
                  const timestamp = notification.timestamp || notification.created_at;
                  const cardClassName = notificationMeta.variant === 'prediction' || !isRead
                    ? `${notificationMeta.borderClass} ${notificationMeta.fillClass}`
                    : 'border-slate-700/70 bg-slate-950/35';

                  return (
                    <motion.article
                      layout
                      key={notification.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.22 }}
                      className={`rounded-3xl border p-4 shadow-[0_10px_30px_rgba(2,6,23,0.22)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(2,6,23,0.35)] ${cardClassName}`}
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="flex min-w-0 gap-3">
                          <div className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${notificationMeta.variant === 'prediction' ? 'bg-cyan-400/10 text-cyan-200' : `bg-slate-950/60 ${notificationMeta.textClass}`}`}>
                            <TypeIcon className="h-5 w-5" />
                          </div>

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className={`text-base font-black ${notificationMeta.titleClass}`}>{notification.title}</h3>
                              {!isRead ? <span className="rounded-full bg-cyan-500/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-cyan-200">Unread</span> : null}
                              <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.24em] ${notificationMeta.badgeClass}`}>
                                {notification.type}
                              </span>
                            </div>

                            <p className={`mt-2 text-sm leading-6 ${notificationMeta.messageClass}`}>{notification.message}</p>

                            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                              <span className="rounded-full border border-slate-700 bg-slate-950/50 px-2.5 py-1 font-semibold text-slate-300">{source}</span>
                              <span className="rounded-full border border-slate-700 bg-slate-950/50 px-2.5 py-1 font-semibold text-slate-300">{new Date(timestamp).toLocaleString()}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                          <button
                            type="button"
                            onClick={() => (isRead ? markAsUnread(notification.id) : markAsRead(notification.id))}
                            className="rounded-2xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-xs font-bold text-slate-200 transition hover:bg-slate-800"
                          >
                            {isRead ? 'Mark unread' : 'Mark read'}
                          </button>
                          {!isRead ? (
                            <button
                              type="button"
                              onClick={() => markAsRead(notification.id)}
                              className="rounded-2xl bg-emerald-500 px-3 py-2 text-xs font-black text-slate-950 transition hover:bg-emerald-400"
                            >
                              Mark read
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </motion.article>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

const NOTIFICATION_TYPE_META = {
  success: {
    label: 'Success',
    icon: 'check-circle',
    borderClass: 'border-emerald-400/30',
    fillClass: 'bg-emerald-500/10',
    textClass: 'text-emerald-300',
  },
  warning: {
    label: 'Warning',
    icon: 'alert-triangle',
    borderClass: 'border-amber-400/30',
    fillClass: 'bg-amber-500/10',
    textClass: 'text-amber-300',
  },
  info: {
    label: 'Info',
    icon: 'info',
    borderClass: 'border-cyan-400/30',
    fillClass: 'bg-cyan-500/10',
    textClass: 'text-cyan-300',
  },
  danger: {
    label: 'Danger',
    icon: 'shield-alert',
    borderClass: 'border-rose-400/30',
    fillClass: 'bg-rose-500/10',
    textClass: 'text-rose-300',
  },
};

const PREDICTION_NOTIFICATION_TITLES = new Set([
  'prediction started',
  'prediction completed',
  'high risk detected',
  'risk level changed',
]);

const PREDICTION_NOTIFICATION_META = {
  label: 'Prediction',
  icon: 'shield-alert',
  borderClass: 'border-slate-500/45',
  fillClass: 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-900',
  textClass: 'text-cyan-200',
  titleClass: 'text-white',
  messageClass: 'text-slate-100/90',
  badgeClass: 'border border-slate-700/70 bg-slate-950/70 text-slate-100',
  containerClass: 'shadow-[0_18px_40px_rgba(2,6,23,0.55)]',
};

function normalizeLookupValue(value) {
  return String(value || '').trim().toLowerCase();
}

function isPredictionNotification(notification = {}) {
  const title = normalizeLookupValue(notification.title);
  const source = normalizeLookupValue(notification.source || notification.module || notification.module_name || notification.data?.source);
  const event = normalizeLookupValue(notification.event || notification.action || notification.kind);

  return (
    PREDICTION_NOTIFICATION_TITLES.has(title) ||
    source.includes('prediction') ||
    event.includes('prediction') ||
    event === 'risk_level_changed'
  );
}

function getNotificationMeta(notification = {}) {
  const type = normalizeNotificationType(notification.type || notification.notification_type || notification.severity);
  const baseMeta = NOTIFICATION_TYPE_META[type] || NOTIFICATION_TYPE_META.info;

  if (isPredictionNotification(notification)) {
    return {
      ...baseMeta,
      ...PREDICTION_NOTIFICATION_META,
    };
  }

  return {
    ...baseMeta,
    titleClass: 'text-white',
    messageClass: 'text-slate-200/90',
    badgeClass: 'bg-slate-950/45 text-inherit',
    containerClass: '',
  };
}

function normalizeNotificationType(type) {
  if (['success', 'warning', 'info', 'danger'].includes(type)) {
    return type;
  }

  const fallbackType = String(type || '').toLowerCase();

  if (fallbackType.includes('danger') || fallbackType.includes('delete') || fallbackType.includes('failed') || fallbackType.includes('error')) {
    return 'danger';
  }

  if (fallbackType.includes('warn') || fallbackType.includes('reminder')) {
    return 'warning';
  }

  if (fallbackType.includes('success') || fallbackType.includes('complete') || fallbackType.includes('created') || fallbackType.includes('applied') || fallbackType.includes('saved')) {
    return 'success';
  }

  return 'info';
}

function generateNotificationId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `notif_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeNotification(notification = {}) {
  const timestamp = notification.timestamp || notification.created_at || new Date().toISOString();
  const source = notification.source || notification.module || notification.module_name || notification.data?.source || 'System';

  return {
    id: notification.id ?? generateNotificationId(),
    title: notification.title || 'Notification',
    message: notification.message || '',
    source,
    module: source,
    timestamp,
    created_at: timestamp,
    type: normalizeNotificationType(notification.type || notification.notification_type || notification.severity),
    isRead: Boolean(notification.isRead ?? notification.is_read),
    is_read: Boolean(notification.isRead ?? notification.is_read),
    data: notification.data || {},
    event: notification.event || notification.action || notification.kind || null,
  };
}

export { NOTIFICATION_TYPE_META, generateNotificationId, getNotificationMeta, isPredictionNotification, normalizeNotification, normalizeNotificationType };
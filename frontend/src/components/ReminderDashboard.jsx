import { useState, useContext, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCountdown } from '../hooks/useCountdown';
import { NotificationContext } from '../context/NotificationContext';
import { fetchReminders, updateReminder } from '../utils/api';

/**
 * ReminderCard - Individual reminder with countdown timer
 */
function ReminderCard({ reminder, onReminderTriggered, onDelete }) {
  const notificationContext = useContext(NotificationContext);
  const [isCompleted, setIsCompleted] = useState(reminder.is_sent || false);

  // Handle countdown completion
  const handleCountdownComplete = useCallback(() => {
    if (!isCompleted && !reminder.is_sent) {
      // Trigger in-app notification
      if (notificationContext?.addNotification) {
        notificationContext.addNotification({
          source: 'Reminders',
          type: 'warning',
          title: `🔔 ${reminder.title}`,
          message: reminder.message,
          event: 'reminder_triggered',
          timestamp: new Date().toISOString(),
          isRead: false,
          data: {
            reminder_id: reminder.id,
            remind_at: reminder.remind_at,
          },
        });
      }

      // Mark as completed locally
      setIsCompleted(true);

      // Call parent callback
      if (onReminderTriggered) {
        onReminderTriggered(reminder);
      }

      // Update backend
      updateReminder(reminder.id, { is_sent: true }).catch((err) => {
        console.error('Failed to mark reminder as sent:', err);
      });
    }
  }, [reminder, notificationContext, isCompleted, onReminderTriggered]);

  // Use countdown hook
  const { timeRemaining, isExpired } = useCountdown(reminder.remind_at, handleCountdownComplete);

  // Determine urgency level based on time remaining
  const getUrgencyClass = () => {
    const seconds = parseInt(timeRemaining.split(':')[0]) * 3600 +
                   parseInt(timeRemaining.split(':')[1]) * 60 +
                   parseInt(timeRemaining.split(':')[2]);

    if (isExpired || isCompleted) return 'border-emerald-500/50 bg-emerald-500/10';
    if (seconds <= 300) return 'border-rose-500/50 bg-rose-500/10'; // Last 5 minutes
    if (seconds <= 1800) return 'border-amber-500/50 bg-amber-500/10'; // Last 30 minutes
    return 'border-cyan-500/50 bg-cyan-500/10'; // Far future
  };

  const getTimerClass = () => {
    const seconds = parseInt(timeRemaining.split(':')[0]) * 3600 +
                   parseInt(timeRemaining.split(':')[1]) * 60 +
                   parseInt(timeRemaining.split(':')[2]);

    if (isExpired || isCompleted) return 'text-emerald-400 font-bold';
    if (seconds <= 300) return 'text-rose-400 font-bold animate-pulse';
    if (seconds <= 1800) return 'text-amber-400 font-bold';
    return 'text-cyan-400';
  };

  return (
    <div className={`rounded-2xl border-2 p-4 transition-all ${getUrgencyClass()}`}>
      {/* Status Badge */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 flex-1">
          {isExpired || isCompleted ? (
            <span className="inline-block px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs font-bold">✓ Completed</span>
          ) : (
            <span className="inline-block px-2 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 text-xs font-bold">⏰ Active</span>
          )}
        </div>
        <button
          onClick={() => onDelete(reminder.id)}
          className="text-rose-400 hover:text-rose-300 text-sm font-bold"
        >
          ✕
        </button>
      </div>

      {/* Title */}
      <h3 className="text-lg font-black text-slate-100 mb-1">{reminder.title}</h3>

      {/* Message */}
      <p className="text-sm text-slate-300 mb-3">{reminder.message}</p>

      {/* Countdown Timer */}
      <div className={`text-center py-3 rounded-lg bg-slate-950/50 mb-3 ${getTimerClass()}`}>
        <p className="text-xs text-slate-400 mb-1">Time Remaining</p>
        <p className="font-mono text-2xl font-bold">{timeRemaining}</p>
      </div>

      {/* Scheduled Time */}
      <div className="grid grid-cols-2 gap-2 text-xs mb-3">
        <div className="bg-slate-950/50 rounded-lg p-2">
          <p className="text-slate-400">Scheduled</p>
          <p className="text-slate-200 font-mono">{new Date(reminder.remind_at).toLocaleString()}</p>
        </div>
        <div className="bg-slate-950/50 rounded-lg p-2">
          <p className="text-slate-400">Status</p>
          <p className="text-slate-200 font-mono">{isCompleted ? 'Sent ✓' : 'Pending'}</p>
        </div>
      </div>

      {/* Task Link */}
      {reminder.task_id && (
        <p className="text-xs text-slate-400">🔗 Linked to task #{reminder.task_id}</p>
      )}
    </div>
  );
}

/**
 * ReminderDashboard - Main dashboard showing all reminders with countdowns
 */
export function ReminderDashboard() {
  const navigate = useNavigate();
  const notificationContext = useContext(NotificationContext);
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState('active'); // 'active' or 'all'

  // Load reminders from API
  const loadReminders = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetchReminders();
      setReminders(response?.data || []);
    } catch (apiError) {
      setError(apiError?.response?.data?.detail || 'Failed to load reminders');
      console.error('Error loading reminders:', apiError);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadReminders();
  }, [loadReminders]);

  // Handle reminder triggered
  const handleReminderTriggered = useCallback(
    (reminder) => {
      // Optionally show browser notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(`Reminder: ${reminder.title}`, {
          body: reminder.message,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: `reminder-${reminder.id}`,
        });
      }
    },
    []
  );

  // Handle delete
  const handleDelete = useCallback((reminderId) => {
    setReminders((prev) => prev.filter((r) => r.id !== reminderId));
  }, []);

  // Filter reminders based on view mode
  const filteredReminders = viewMode === 'active'
    ? reminders.filter((r) => !r.is_sent)
    : reminders;

  // Sort by scheduled time (upcoming first)
  const sortedReminders = [...filteredReminders].sort(
    (a, b) => new Date(a.remind_at) - new Date(b.remind_at)
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-b from-[#10130a] via-[#172114] to-[#10130a] text-slate-100 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-6xl">
          <p className="text-center text-slate-400">Loading reminders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-[#10130a] via-[#172114] to-[#10130a] text-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <header className="rounded-3xl border border-slate-700/60 bg-slate-900/70 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-lime-300">📋 Live Dashboard</p>
              <h1 className="text-3xl font-black">Reminder Dashboard</h1>
              <p className="text-sm text-slate-300 mt-1">Real-time countdown timers for all your reminders</p>
            </div>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-bold text-slate-200 hover:bg-slate-700"
            >
              ← Back
            </button>
          </div>

          {/* View Mode Toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('active')}
              className={`rounded-xl px-4 py-2 font-bold transition-all ${
                viewMode === 'active'
                  ? 'bg-cyan-500 text-slate-950'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              ⏰ Active Only
            </button>
            <button
              onClick={() => setViewMode('all')}
              className={`rounded-xl px-4 py-2 font-bold transition-all ${
                viewMode === 'all'
                  ? 'bg-cyan-500 text-slate-950'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              📋 All Reminders
            </button>
          </div>
        </header>

        {/* Error Message */}
        {error && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-rose-300">
            {error}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-cyan-500/40 bg-cyan-500/10 p-4">
            <p className="text-xs text-slate-400">Total Reminders</p>
            <p className="text-2xl font-black text-cyan-300">{reminders.length}</p>
          </div>
          <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
            <p className="text-xs text-slate-400">Pending</p>
            <p className="text-2xl font-black text-amber-300">
              {reminders.filter((r) => !r.is_sent).length}
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4">
            <p className="text-xs text-slate-400">Completed</p>
            <p className="text-2xl font-black text-emerald-300">
              {reminders.filter((r) => r.is_sent).length}
            </p>
          </div>
        </div>

        {/* Reminders Grid */}
        {sortedReminders.length === 0 ? (
          <div className="rounded-3xl border border-slate-700/60 bg-slate-900/70 p-12 text-center">
            <p className="text-lg font-bold text-slate-400 mb-2">✨ No reminders yet</p>
            <p className="text-sm text-slate-500">Go to <span className="text-lime-300">Reminder Center</span> to create one</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sortedReminders.map((reminder) => (
              <ReminderCard
                key={reminder.id}
                reminder={reminder}
                onReminderTriggered={handleReminderTriggered}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}

      </div>
    </div>
  );
}

export default ReminderDashboard;

import { useEffect, useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  createReminder,
  deleteReminder,
  fetchDueReminders,
  fetchReminders,
  fetchTasks,
  updateReminder,
} from '../utils/api';
import { useReminderPoller } from '../hooks/useReminderPoller';
import { NotificationContext } from '../context/NotificationContext';
import { formatLocalDateTime } from '../utils/helpers';
import { requestNotificationPermission, showNotification } from '../utils/browserNotifications';

export default function ReminderCenter() {
  const navigate = useNavigate();
  const notificationContext = useContext(NotificationContext);
  const [tasks, setTasks] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [dueReminders, setDueReminders] = useState([]);
  const [form, setForm] = useState({
    title: '',
    message: '',
    task_id: '',
    remind_at: formatLocalDateTime(),
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [notificationPermission, setNotificationPermission] = useState('default');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [savedReminder, setSavedReminder] = useState(null);
  
  // Use the reminder poller to check for due reminders
  const { dueReminders: triggeredReminders } = useReminderPoller(15, 60);

  // Load reminders and due alerts for the notification center.
  const loadAll = async () => {
    setLoading(true);
    setError('');
    try {
      const [taskRes, reminderRes, dueRes] = await Promise.all([
        fetchTasks(),
        fetchReminders(),
        fetchDueReminders(180),
      ]);
      setTasks(taskRes?.data || []);
      setReminders(reminderRes?.data || []);
      setDueReminders(dueRes?.data || []);
    } catch (apiError) {
      setError(apiError?.response?.data?.detail || 'Unable to load reminders.');
    } finally {
      setLoading(false);
    }
  };

  // Handle triggered reminders from the poller
  useEffect(() => {
    if (triggeredReminders && triggeredReminders.length > 0) {
      triggeredReminders.forEach((reminder) => {
        // Send in-app notification
        if (notificationContext?.addNotification) {
          notificationContext.addNotification({
            source: 'Reminders',
            type: 'warning',
            title: `Reminder triggered: ${reminder.title}`,
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

        // Send browser notification if permission granted
        showNotification(`🔔 ${reminder.title}`, {
          body: reminder.message,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: `reminder-${reminder.id}`,
        });

        // Mark reminder as sent in backend
        updateReminder(reminder.id, { is_sent: true }).catch((err) => {
          console.error('Failed to mark reminder as sent:', err);
        });
      });
    }
  }, [triggeredReminders, notificationContext]);

  // Request notification permission on mount
  useEffect(() => {
    const checkNotificationPermission = async () => {
      if ('Notification' in window) {
        setNotificationPermission(Notification.permission);
      }
    };
    checkNotificationPermission();
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    loadAll();
  }, [navigate]);

  const handleCreateReminder = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    try {
      const scheduledAt = new Date(form.remind_at);
      await createReminder({
        title: form.title,
        message: form.message,
        task_id: form.task_id ? Number(form.task_id) : null,
        remind_at: scheduledAt.toISOString(),
        is_sent: false,
      });
      setForm({ title: '', message: '', task_id: '', remind_at: formatLocalDateTime() });
      setSavedReminder({
        title: form.title,
        remindAtLabel: scheduledAt.toLocaleString(),
      });
      setShowSaveModal(true);
     
       // Trigger in-app success notification
       if (notificationContext?.addNotification) {
         notificationContext.addNotification({
           source: 'Reminders',
           type: 'success',
           title: 'Reminder saved successfully',
           message: `"${form.title}" scheduled for ${scheduledAt.toLocaleString()}`,
           event: 'reminder_created',
           timestamp: new Date().toISOString(),
           isRead: false,
           data: {
             reminder_title: form.title,
           },
         });
       }
     
      await loadAll();
    } catch (apiError) {
      setError(apiError?.response?.data?.detail || 'Failed to create reminder.');
    }
  };

  const handleRequestNotificationPermission = async () => {
    const permission = await requestNotificationPermission();
    setNotificationPermission(permission);
    if (permission === 'granted') {
      setSuccess('Notification permission granted!');
    } else if (permission === 'denied') {
      setError('Notification permission denied.');
    }
  };

  const markAsSent = async (reminderId) => {
    try {
      await updateReminder(reminderId, { is_sent: true });
      await loadAll();
    } catch (apiError) {
      setError(apiError?.response?.data?.detail || 'Failed to update reminder.');
    }
  };

  const removeReminder = async (reminderId) => {
    try {
      await deleteReminder(reminderId);
      await loadAll();
    } catch (apiError) {
      setError(apiError?.response?.data?.detail || 'Failed to delete reminder.');
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-[#060914] text-slate-200 p-8">Loading reminders...</div>;
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-[#10130a] via-[#172114] to-[#10130a] text-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-3xl border border-slate-700/60 bg-slate-900/70 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-lime-300">Smart Reminder System</p>
              <h1 className="text-2xl font-black">Reminder Notifications</h1>
              <p className="text-sm text-slate-300 mt-1">Create reminders for pending tasks and upcoming study sessions.</p>
            </div>
            <div className="flex gap-2">
              <Link to="/focus-mode" className="rounded-xl bg-slate-800 px-3 py-2 text-sm font-bold hover:bg-slate-700">Focus Mode</Link>
              <Link to="/live-dashboard" className="rounded-xl bg-cyan-500 px-3 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-400">📊 Live Dashboard</Link>
              <Link to="/dashboard" className="rounded-xl bg-lime-500 px-3 py-2 text-sm font-bold text-slate-950 hover:bg-lime-400">Dashboard</Link>
            </div>
          </div>
        </header>

        {error ? <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-300">{error}</p> : null}
        {success ? <p className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-300">{success}</p> : null}

        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <section className="rounded-3xl border border-slate-700/60 bg-slate-900/70 p-5">
            <h2 className="text-lg font-black">Create Reminder</h2>
            <form onSubmit={handleCreateReminder} className="mt-4 grid gap-3">
              <input value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} placeholder="Reminder title" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2" required />
              <textarea value={form.message} onChange={(event) => setForm((prev) => ({ ...prev, message: event.target.value }))} placeholder="Reminder message" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2" rows={3} required />
              <select value={form.task_id} onChange={(event) => setForm((prev) => ({ ...prev, task_id: event.target.value }))} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2">
                <option value="">Optional linked task</option>
                {tasks.map((task) => (
                  <option key={task.id} value={task.id}>{task.title}</option>
                ))}
              </select>
              <input type="datetime-local" value={form.remind_at} onChange={(event) => setForm((prev) => ({ ...prev, remind_at: event.target.value }))} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2" required />
              <button type="submit" className="rounded-xl bg-lime-500 px-4 py-2 font-black text-slate-950 hover:bg-lime-400">Save Reminder</button>
              {notificationPermission !== 'granted' && (
                <button
                  type="button"
                  onClick={handleRequestNotificationPermission}
                  className="rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 font-bold text-cyan-300 hover:bg-cyan-500/20"
                >
                  🔔 Enable Browser Notifications
                </button>
              )}
            </form>
          </section>

          <section className="rounded-3xl border border-slate-700/60 bg-slate-900/70 p-5">
            <h2 className="text-lg font-black">Due in Next 3 Hours</h2>
            <p className="text-xs text-slate-400 mt-1">
              Real-time polling active ✓
            </p>
            <div className="mt-4 space-y-2 text-sm max-h-72 overflow-auto">
              {dueReminders.map((item) => (
                <div key={item.id} className="rounded-xl border border-lime-500/30 bg-lime-500/10 p-3">
                  <p className="font-bold">{item.title}</p>
                  <p className="text-slate-200">{item.message}</p>
                  <p className="text-xs text-slate-300">{new Date(item.remind_at).toLocaleString()}</p>
                </div>
              ))}
              {!dueReminders.length ? <p className="text-slate-400">No imminent reminders right now.</p> : null}
            </div>
          </section>
        </div>

        <section className="rounded-3xl border border-slate-700/60 bg-slate-900/70 p-5">
          <h2 className="text-lg font-black">All Reminders</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-195 text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400">
                  <th className="py-2 text-left">Title</th>
                  <th className="py-2 text-left">Message</th>
                  <th className="py-2 text-left">Time</th>
                  <th className="py-2 text-left">Sent</th>
                  <th className="py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {reminders.map((item) => (
                  <tr key={item.id} className="border-b border-slate-800">
                    <td className="py-2">{item.title}</td>
                    <td className="py-2">{item.message}</td>
                    <td className="py-2">{new Date(item.remind_at).toLocaleString()}</td>
                    <td className="py-2">{item.is_sent ? 'Yes' : 'No'}</td>
                    <td className="py-2 flex gap-2">
                      <button onClick={() => markAsSent(item.id)} className="rounded-lg bg-emerald-500/20 px-2 py-1 text-emerald-300 hover:bg-emerald-500/30">Mark Sent</button>
                      <button onClick={() => removeReminder(item.id)} className="rounded-lg bg-rose-500/20 px-2 py-1 text-rose-300 hover:bg-rose-500/30">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {showSaveModal && savedReminder ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-700/80 bg-slate-900 p-6 shadow-2xl shadow-slate-950/50 animate-in fade-in zoom-in-95 duration-200">
            <div className="space-y-3 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-2xl text-emerald-300">
                ✓
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-100">Reminder saved successfully</h3>
                <p className="mt-2 text-sm text-slate-300">
                  {savedReminder.title} is scheduled for {savedReminder.remindAtLabel}.
                </p>
              </div>
              <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setShowSaveModal(false)}
                  className="flex-1 rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-bold text-slate-200 hover:bg-slate-700"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/live-dashboard')}
                  className="flex-1 rounded-xl bg-cyan-500 px-4 py-3 text-sm font-black text-slate-950 hover:bg-cyan-400"
                >
                  Go to Live Dashboard
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

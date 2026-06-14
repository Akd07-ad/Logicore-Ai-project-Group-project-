import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createActivityLog, createProgressEntry, fetchActivityLogs } from '../utils/api';
import { NotificationContext } from '../context/NotificationContext';

export default function FocusMode() {
  const navigate = useNavigate();
  const { addNotification } = useContext(NotificationContext);
  const [focusMinutes, setFocusMinutes] = useState(25);
  const [breakMinutes, setBreakMinutes] = useState(5);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [mode, setMode] = useState('focus');
  const [notificationBlock, setNotificationBlock] = useState(true);
  const [idleSeconds, setIdleSeconds] = useState(0);
  const [logs, setLogs] = useState([]);

  const startedAtRef = useRef(null);
  const idleTimerRef = useRef(0);

  // Reset timer whenever focus duration changes.
  useEffect(() => {
    setSecondsLeft(focusMinutes * 60);
  }, [focusMinutes]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    const load = async () => {
      const response = await fetchActivityLogs();
      setLogs(response?.data || []);
    };

    load();
  }, [navigate]);

  // Idle tracker uses user interactions to estimate distraction time.
  useEffect(() => {
    const resetIdle = () => {
      idleTimerRef.current = 0;
      setIdleSeconds(0);
    };

    const interval = window.setInterval(() => {
      if (!running) return;
      idleTimerRef.current += 1;
      setIdleSeconds(idleTimerRef.current);
    }, 1000);

    window.addEventListener('mousemove', resetIdle);
    window.addEventListener('keydown', resetIdle);
    window.addEventListener('click', resetIdle);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('mousemove', resetIdle);
      window.removeEventListener('keydown', resetIdle);
      window.removeEventListener('click', resetIdle);
    };
  }, [running]);

  useEffect(() => {
    if (!running) return undefined;

    const interval = window.setInterval(async () => {
      setSecondsLeft((prev) => {
        if (prev > 1) return prev - 1;
        return 0;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [running]);

  // Store activity and progress when a focus session reaches zero.
  useEffect(() => {
    const completeSession = async () => {
      const endedAt = new Date();
      const startedAt = startedAtRef.current || new Date(endedAt.getTime() - focusMinutes * 60000);
      const idleMinutes = Math.floor(idleSeconds / 60);
      const activeMinutes = Math.max(0, focusMinutes - idleMinutes);

      await createActivityLog({
        activity_type: 'focus',
        session_label: 'Pomodoro',
        started_at: startedAt.toISOString(),
        ended_at: endedAt.toISOString(),
        active_minutes: activeMinutes,
        idle_minutes: idleMinutes,
        blocked_notifications: notificationBlock,
        metadata_json: JSON.stringify({ mode }),
      });

      await createProgressEntry({
        active_minutes: activeMinutes,
        idle_minutes: idleMinutes,
        focus_sessions: 1,
        consistency_score: activeMinutes >= focusMinutes * 0.7 ? 85 : 55,
        weekly_performance: activeMinutes >= focusMinutes * 0.7 ? 80 : 50,
      });

      addNotification?.({
        source: 'Focus Mode',
        type: activeMinutes >= focusMinutes * 0.7 ? 'success' : 'warning',
        title: 'Focus session ended',
        message: `Focus session finished with ${activeMinutes} active minutes and ${idleMinutes} idle minutes.`,
        event: 'focus_session_completed',
        timestamp: endedAt.toISOString(),
        isRead: false,
        data: {
          active_minutes: activeMinutes,
          idle_minutes: idleMinutes,
          blocked_notifications: notificationBlock,
        },
      });

      const logsResponse = await fetchActivityLogs();
      setLogs(logsResponse?.data || []);

      setRunning(false);
      setMode('break');
      setSecondsLeft(breakMinutes * 60);
    };

    if (running && mode === 'focus' && secondsLeft === 0) {
      completeSession();
    }
  }, [breakMinutes, focusMinutes, idleSeconds, mode, notificationBlock, running, secondsLeft]);

  const startFocus = async () => {
    // Browser notification permission is requested to improve reminder UX.
    if (notificationBlock && 'Notification' in window && Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch (error) {
        console.error(error);
      }
    }
    startedAtRef.current = new Date();
    setMode('focus');
    setSecondsLeft(focusMinutes * 60);
    setIdleSeconds(0);
    setRunning(true);

    addNotification?.({
      source: 'Focus Mode',
      type: 'info',
      title: 'Focus session started',
      message: `Focus mode started for ${focusMinutes} minutes.`,
      event: 'focus_session_started',
      timestamp: new Date().toISOString(),
      isRead: false,
      data: {
        focus_minutes: focusMinutes,
        break_minutes: breakMinutes,
      },
    });
  };

  const pauseTimer = () => setRunning(false);
  const resumeTimer = () => setRunning(true);

  const formatted = useMemo(() => {
    const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
    const ss = String(secondsLeft % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  }, [secondsLeft]);

  return (
    <div className="min-h-screen bg-linear-to-b from-[#13080f] via-[#1b1122] to-[#0a0814] text-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-3xl border border-slate-700/60 bg-slate-900/70 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-fuchsia-300">Smart Focus Mode</p>
              <h1 className="text-2xl font-black">Distraction Control + Activity Tracking</h1>
              <p className="text-sm text-slate-300 mt-1">Track active and idle study time with Pomodoro focus sessions.</p>
            </div>
            <div className="flex gap-2">
              <Link to="/task-tracker" className="rounded-xl bg-slate-800 px-3 py-2 text-sm font-bold hover:bg-slate-700">Task Tracker</Link>
              <Link to="/reminders" className="rounded-xl bg-fuchsia-500 px-3 py-2 text-sm font-bold text-slate-950 hover:bg-fuchsia-400">Reminders</Link>
            </div>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <section className="rounded-3xl border border-slate-700/60 bg-slate-900/70 p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">Focus minutes
                <input type="number" min="10" max="90" value={focusMinutes} onChange={(event) => setFocusMinutes(Number(event.target.value) || 25)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2" />
              </label>
              <label className="text-sm">Break minutes
                <input type="number" min="3" max="30" value={breakMinutes} onChange={(event) => setBreakMinutes(Number(event.target.value) || 5)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2" />
              </label>
            </div>

            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={notificationBlock} onChange={(event) => setNotificationBlock(event.target.checked)} />
              Enable notification blocking mode
            </label>

            <div className="rounded-2xl border border-fuchsia-500/30 bg-fuchsia-500/10 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-fuchsia-200">{mode.toUpperCase()} SESSION</p>
              <p className="mt-2 text-5xl font-black text-fuchsia-200">{formatted}</p>
              <p className="mt-2 text-sm text-slate-300">Idle time in this session: {Math.floor(idleSeconds / 60)} min {idleSeconds % 60}s</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button onClick={startFocus} className="rounded-xl bg-fuchsia-500 px-4 py-2 font-black text-slate-950 hover:bg-fuchsia-400">Start Focus</button>
              <button onClick={pauseTimer} className="rounded-xl bg-slate-800 px-4 py-2 font-bold hover:bg-slate-700">Pause</button>
              <button onClick={resumeTimer} className="rounded-xl bg-emerald-500 px-4 py-2 font-bold text-slate-950 hover:bg-emerald-400">Resume</button>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-700/60 bg-slate-900/70 p-5">
            <h2 className="text-lg font-black">Recent Activity Logs</h2>
            <div className="mt-4 max-h-96 overflow-auto space-y-2 text-sm">
              {logs.map((log) => (
                <div key={log.id} className="rounded-xl border border-slate-700 bg-slate-950/60 p-3">
                  <p className="font-bold">{log.session_label} | {log.activity_type}</p>
                  <p className="text-slate-300">Active: {log.active_minutes} min | Idle: {log.idle_minutes} min</p>
                  <p className="text-slate-400">{new Date(log.started_at).toLocaleString()} - {new Date(log.ended_at).toLocaleTimeString()}</p>
                </div>
              ))}
              {!logs.length ? <p className="text-slate-400">No focus logs yet. Start a session to begin tracking.</p> : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

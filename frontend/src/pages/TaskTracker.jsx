import { useContext, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  createProgressEntry,
  createTask,
  deleteTask,
  fetchProgressSummary,
  fetchTasks,
  updateTask,
} from '../utils/api';
import { NotificationContext } from '../context/NotificationContext';
import { formatLocalDateTime } from '../utils/helpers';

const statusOptions = ['Completed', 'Partial', 'Not Done'];

export default function TaskTracker() {
  const navigate = useNavigate();
  const { addNotification } = useContext(NotificationContext);
  const [tasks, setTasks] = useState([]);
  const [summary, setSummary] = useState(null);
  const [taskForm, setTaskForm] = useState({
    title: '',
    subject: 'Math',
    estimated_minutes: 60,
    status: 'Not Done',
    due_date: formatLocalDateTime(),
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [createdTask, setCreatedTask] = useState(null);
  const [showTaskModal, setShowTaskModal] = useState(false);

  useEffect(() => {
    setTaskForm((prev) => (prev.due_date ? prev : { ...prev, due_date: formatLocalDateTime() }));
  }, []);

  // Pull tasks and progress summary together for daily tracking visibility.
  const loadAll = async () => {
    setLoading(true);
    setError('');
    try {
      const [tasksResponse, summaryResponse] = await Promise.all([fetchTasks(), fetchProgressSummary()]);
      setTasks(tasksResponse?.data || []);
      setSummary(summaryResponse?.data || null);
    } catch (apiError) {
      setError(apiError?.response?.data?.detail || 'Unable to load task tracker data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    loadAll();
  }, [navigate]);

  const statusCount = useMemo(() => {
    return {
      Completed: tasks.filter((item) => item.status === 'Completed').length,
      Partial: tasks.filter((item) => item.status === 'Partial').length,
      'Not Done': tasks.filter((item) => item.status === 'Not Done').length,
    };
  }, [tasks]);

  const handleCreateTask = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const taskResponse = await createTask({
        title: taskForm.title,
        subject: taskForm.subject,
        status: taskForm.status,
        estimated_minutes: Number(taskForm.estimated_minutes),
        due_date: taskForm.due_date ? new Date(taskForm.due_date).toISOString() : new Date().toISOString(),
      });
      const createdTaskData = taskResponse?.data || null;

      if (createdTaskData) {
        setTasks((prev) => [createdTaskData, ...prev.filter((item) => item.id !== createdTaskData.id)]);
        setCreatedTask(createdTaskData);
        setShowTaskModal(true);

        addNotification?.({
          source: 'Task Tracker',
          type: 'success',
          title: 'Task created successfully',
          message: `${createdTaskData.title} has been added to your tracker.`,
          event: 'task_added',
          timestamp: new Date().toISOString(),
          isRead: false,
          data: {
            task_id: createdTaskData.id,
            task_title: createdTaskData.title,
            due_date: createdTaskData.due_date,
            estimated_minutes: createdTaskData.estimated_minutes,
          },
        });
      }

      // Store a progress event so consistency analytics are always updated.
      await createProgressEntry({
        active_minutes: Number(taskForm.estimated_minutes),
        completed_tasks: taskForm.status === 'Completed' ? 1 : 0,
        partial_tasks: taskForm.status === 'Partial' ? 1 : 0,
        not_done_tasks: taskForm.status === 'Not Done' ? 1 : 0,
        consistency_score: taskForm.status === 'Completed' ? 90 : taskForm.status === 'Partial' ? 60 : 30,
        weekly_performance: taskForm.status === 'Completed' ? 88 : taskForm.status === 'Partial' ? 62 : 38,
      });

      try {
        const summaryResponse = await fetchProgressSummary();
        setSummary(summaryResponse?.data || null);
      } catch {
        // Keep the task flow responsive even if summary refresh fails.
      }

      setTaskForm({ title: '', subject: 'Math', estimated_minutes: 60, status: 'Not Done', due_date: formatLocalDateTime() });
    } catch (apiError) {
      setError(apiError?.response?.data?.detail || 'Failed to create task.');
    } finally {
      setSaving(false);
    }
  };

  const updateTaskStatus = async (task, status) => {
    try {
      await updateTask(task.id, { status });
      await createProgressEntry({
        task_id: task.id,
        active_minutes: status === 'Completed' ? task.estimated_minutes : Math.floor(task.estimated_minutes * 0.5),
        completed_tasks: status === 'Completed' ? 1 : 0,
        partial_tasks: status === 'Partial' ? 1 : 0,
        not_done_tasks: status === 'Not Done' ? 1 : 0,
        consistency_score: status === 'Completed' ? 92 : status === 'Partial' ? 65 : 35,
        weekly_performance: status === 'Completed' ? 90 : status === 'Partial' ? 60 : 30,
      });

      if (status === 'Completed' && task.status !== 'Completed') {
        addNotification?.({
          source: 'Task Tracker',
          type: 'success',
          title: 'Task completed',
          message: `${task.title} was marked complete.`,
          event: 'task_completed',
          timestamp: new Date().toISOString(),
          isRead: false,
          data: {
            task_id: task.id,
            task_title: task.title,
          },
        });
      }

      await loadAll();
    } catch (apiError) {
      setError(apiError?.response?.data?.detail || 'Failed to update task status.');
    }
  };

  const handleDeleteTask = async (taskId) => {
    try {
      const taskToDelete = tasks.find((item) => item.id === taskId);
      await deleteTask(taskId);
      if (taskToDelete) {
        addNotification?.({
          source: 'Task Tracker',
          type: 'danger',
          title: 'Task deleted',
          message: `${taskToDelete.title} was removed from your tracker.`,
          event: 'task_deleted',
          timestamp: new Date().toISOString(),
          isRead: false,
          data: {
            task_id: taskToDelete.id,
            task_title: taskToDelete.title,
          },
        });
      }
      await loadAll();
    } catch (apiError) {
      setError(apiError?.response?.data?.detail || 'Failed to delete task.');
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-[#060914] text-slate-200 p-8">Loading task tracker...</div>;
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-[#071022] via-[#0e1a32] to-[#070f21] text-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-slate-700/60 bg-slate-900/70 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-emerald-300">Progress Tracking</p>
              <h1 className="text-2xl font-black">Daily Task Tracker</h1>
              <p className="text-sm text-slate-300 mt-1">Track task status, consistency streak, and weekly performance.</p>
            </div>
            <div className="flex gap-2">
              <Link to="/study-planner" className="rounded-xl bg-slate-800 px-3 py-2 text-sm font-bold hover:bg-slate-700">Study Planner</Link>
              <Link to="/focus-mode" className="rounded-xl bg-cyan-500 px-3 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-400">Focus Mode</Link>
            </div>
          </div>
        </header>

        {error ? <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-300">{error}</p> : null}

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-3xl border border-slate-700/60 bg-slate-900/70 p-5">
            <h2 className="text-lg font-black">Add Daily Task</h2>
            <form onSubmit={handleCreateTask} className="mt-4 grid gap-3">
              <input value={taskForm.title} onChange={(event) => setTaskForm((prev) => ({ ...prev, title: event.target.value }))} placeholder="Task title" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2" required />
              <div className="grid grid-cols-2 gap-2">
                <input value={taskForm.subject} onChange={(event) => setTaskForm((prev) => ({ ...prev, subject: event.target.value }))} placeholder="Subject" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2" />
                <input type="number" min="10" max="600" value={taskForm.estimated_minutes} onChange={(event) => setTaskForm((prev) => ({ ...prev, estimated_minutes: event.target.value }))} placeholder="Enter minutes (e.g. 30)" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 placeholder:text-slate-500 placeholder:opacity-70" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select value={taskForm.status} onChange={(event) => setTaskForm((prev) => ({ ...prev, status: event.target.value }))} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2">
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
                <input type="datetime-local" value={taskForm.due_date} onChange={(event) => setTaskForm((prev) => ({ ...prev, due_date: event.target.value }))} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2" />
              </div>
              <button type="submit" disabled={saving} className="rounded-xl bg-emerald-500 px-4 py-2 font-black text-slate-950 hover:bg-emerald-400 disabled:opacity-60">
                {saving ? 'Saving...' : 'Create Task'}
              </button>
            </form>
          </section>

          <section className="rounded-3xl border border-slate-700/60 bg-slate-900/70 p-5">
            <h2 className="text-lg font-black">Consistency Analytics</h2>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-slate-950/60 p-3">
                <p className="text-slate-400">Streak</p>
                <p className="text-xl font-black text-emerald-300">{summary?.streak_count ?? 0} days</p>
              </div>
              <div className="rounded-xl bg-slate-950/60 p-3">
                <p className="text-slate-400">Weekly Performance</p>
                <p className="text-xl font-black text-cyan-300">{summary?.weekly_performance ?? 0}%</p>
              </div>
              <div className="rounded-xl bg-slate-950/60 p-3">
                <p className="text-slate-400">Attendance Avg</p>
                <p className="text-xl font-black">{summary?.attendance_average ?? 0}%</p>
              </div>
              <div className="rounded-xl bg-slate-950/60 p-3">
                <p className="text-slate-400">Active Study Time</p>
                <p className="text-xl font-black">{summary?.active_minutes_total ?? 0} min</p>
              </div>
            </div>
            <div className="mt-4 rounded-xl bg-slate-950/60 p-3 text-sm">
              <p>Completed: {statusCount.Completed}</p>
              <p>Partial: {statusCount.Partial}</p>
              <p>Not Done: {statusCount['Not Done']}</p>
            </div>
          </section>
        </div>

        <section className="rounded-3xl border border-slate-700/60 bg-slate-900/70 p-5">
          <h2 className="text-lg font-black">Tasks</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-190 text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400">
                  <th className="py-2 text-left">Title</th>
                  <th className="py-2 text-left">Subject</th>
                  <th className="py-2 text-left">Due</th>
                  <th className="py-2 text-left">Est. Minutes</th>
                  <th className="py-2 text-left">Status</th>
                  <th className="py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <tr key={task.id} className="border-b border-slate-800">
                    <td className="py-2">{task.title}</td>
                    <td className="py-2">{task.subject}</td>
                    <td className="py-2">{task.due_date ? new Date(task.due_date).toLocaleString() : '-'}</td>
                    <td className="py-2">{task.estimated_minutes}</td>
                    <td className="py-2">
                      <select value={task.status} onChange={(event) => updateTaskStatus(task, event.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1">
                        {statusOptions.map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2">
                      <button onClick={() => handleDeleteTask(task.id)} className="rounded-lg bg-rose-500/20 px-2 py-1 text-rose-300 hover:bg-rose-500/30">
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!tasks.length ? <p className="pt-4 text-slate-400">No tasks yet. Add your first study task above.</p> : null}
          </div>
        </section>
      </div>

      {showTaskModal && createdTask ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-3xl border border-slate-700 bg-slate-900 p-6 shadow-2xl shadow-black/40">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-emerald-300">Task created</p>
                <h3 className="mt-1 text-2xl font-black text-white">Task created successfully</h3>
              </div>
              <button
                onClick={() => setShowTaskModal(false)}
                className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-sm font-bold text-slate-200 hover:bg-slate-700"
                aria-label="Close task modal"
              >
                Close
              </button>
            </div>

            <div className="mt-5 space-y-3 rounded-2xl border border-slate-700 bg-slate-950/60 p-4 text-sm text-slate-200">
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-400">Task name</span>
                <span className="font-semibold text-white">{createdTask.title}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-400">Date</span>
                <span className="font-semibold text-white">{createdTask.due_date ? new Date(createdTask.due_date).toLocaleString() : 'Today'}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-400">Minutes</span>
                <span className="font-semibold text-white">{createdTask.estimated_minutes}</span>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setShowTaskModal(false)}
                className="rounded-xl bg-cyan-500 px-4 py-2 font-bold text-slate-950 hover:bg-cyan-400"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

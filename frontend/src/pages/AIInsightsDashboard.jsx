import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import {
  fetchAnalyticsDashboard,
  predictPerformance,
  predictTrend,
  clusterStudent,
} from '../utils/api';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend);

const baseForm = {
  student_id: 'U00001',
  study_hours_per_day: 5,
  attendance_percentage: 85,
  behavior_score: 0.85,
  subjects: 'Data Structures,Algorithms,Machine Learning,Database Systems',
};

export default function AIInsightsDashboard() {
  const [form, setForm] = useState(baseForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [performanceResult, setPerformanceResult] = useState(null);
  const [trendResult, setTrendResult] = useState(null);
  const [clusterResult, setClusterResult] = useState(null);
  const [analytics, setAnalytics] = useState(null);

  const runPredictions = async () => {
    setLoading(true);
    setError('');
    try {
      const subjects = form.subjects
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

      const performancePayload = {
        student_id: form.student_id,
        study_hours_per_day: Number(form.study_hours_per_day),
        attendance_percentage: Number(form.attendance_percentage),
        behavior_score: Number(form.behavior_score),
        subjects,
      };

      const [performance, cluster, dashboard] = await Promise.all([
        predictPerformance(performancePayload),
        clusterStudent(form.student_id),
        fetchAnalyticsDashboard(form.student_id),
      ]);

      setPerformanceResult(performance.data);
      setClusterResult(cluster.data);
      setAnalytics(dashboard.data);

      const history = Array.isArray(dashboard?.data?.performance_over_time) ? dashboard.data.performance_over_time : [];
      const historicalScores = history.length ? history.map((item) => Number(item.score)) : [70, 72, 75, 78];

      const trend = await predictTrend({
        student_id: form.student_id,
        historical_scores: historicalScores,
      });
      setTrendResult(trend.data);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Unable to load AI insights for this university student.');
    } finally {
      setLoading(false);
    }
  };

  const lineChart = useMemo(() => {
    const points = analytics?.performance_over_time || [];
    return {
      labels: points.map((point) => `Test ${point.index}`),
      datasets: [
        {
          label: 'Academic Trend (CGPA Impact)',
          data: points.map((point) => point.score),
          borderColor: '#06b6d4',
          backgroundColor: 'rgba(6, 182, 212, 0.2)',
          tension: 0.35,
          fill: true,
        },
      ],
    };
  }, [analytics]);

  const barChart = useMemo(() => {
    const subjectScores = analytics?.subject_scores || {};
    return {
      labels: Object.keys(subjectScores),
      datasets: [
        {
          label: 'Subject Wise Performance',
          data: Object.values(subjectScores),
          backgroundColor: ['#0891b2', '#f59e0b', '#10b981', '#f43f5e', '#8b5cf6', '#0d9488'],
        },
      ],
    };
  }, [analytics]);

  return (
    <div className="min-h-screen bg-linear-to-b from-[#050814] via-[#0c1327] to-[#050814] text-slate-100 px-4 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-700/60 bg-slate-900/70 p-6">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-cyan-400">University Student Analytics</p>
            <h1 className="text-3xl font-black">AI Insights Platform</h1>
            <p className="text-sm text-slate-400 mt-1">Full ML integration: Random Forest, Linear Regression, and K-Means Clustering.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-bold hover:bg-slate-700 transition" to="/dashboard">Dashboard</Link>
            <Link className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-bold hover:bg-slate-700 transition" to="/risk-panel">Risk Panel</Link>
            <Link className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-bold hover:bg-slate-700 transition" to="/analytics-dashboard">Full Analytics</Link>
          </div>
        </header>

        <section className="rounded-3xl border border-slate-700/60 bg-slate-900/70 p-6">
          <h2 className="text-lg font-black mb-4">Run AI Analysis</h2>
          <div className="grid gap-4 md:grid-cols-5">
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Student ID</label>
              <input
                className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 outline-none focus:border-cyan-500 transition"
                value={form.student_id}
                onChange={(event) => setForm((prev) => ({ ...prev, student_id: event.target.value }))}
                placeholder="U00001"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Study Hours</label>
              <input
                type="number"
                className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 outline-none focus:border-cyan-500 transition"
                value={form.study_hours_per_day}
                onChange={(event) => setForm((prev) => ({ ...prev, study_hours_per_day: event.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Attendance %</label>
              <input
                type="number"
                className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 outline-none focus:border-cyan-500 transition"
                value={form.attendance_percentage}
                onChange={(event) => setForm((prev) => ({ ...prev, attendance_percentage: event.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Behavior Score</label>
              <input
                type="number"
                step="0.01"
                className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 outline-none focus:border-cyan-500 transition"
                value={form.behavior_score}
                onChange={(event) => setForm((prev) => ({ ...prev, behavior_score: event.target.value }))}
              />
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={runPredictions}
                disabled={loading}
                className="w-full h-10 rounded-xl bg-cyan-500 text-slate-950 font-black hover:bg-cyan-400 disabled:opacity-60 transition shadow-lg shadow-cyan-500/20"
              >
                {loading ? 'Processing...' : 'Run Analytics'}
              </button>
            </div>
          </div>
          <div className="mt-4 space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Enrolled Subjects</label>
            <input
              className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 outline-none focus:border-cyan-500 transition"
              value={form.subjects}
              onChange={(event) => setForm((prev) => ({ ...prev, subjects: event.target.value }))}
              placeholder="Subjects (comma separated)"
            />
          </div>
          {error ? <p className="mt-3 text-sm text-rose-400 font-bold">{error}</p> : null}
        </section>

        <section className="grid gap-6 md:grid-cols-4">
          <div className="rounded-3xl border border-slate-700/60 bg-slate-900/70 p-5">
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Performance Forecast</p>
            <p className="text-3xl font-black text-cyan-400">{performanceResult ? `${performanceResult.predicted_exam_score}%` : '-'}</p>
            <p className="text-[10px] text-slate-500 mt-1">Random Forest Prediction</p>
          </div>
          <div className="rounded-3xl border border-slate-700/60 bg-slate-900/70 p-5">
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Next Score Trend</p>
            <p className="text-3xl font-black text-emerald-400">{trendResult ? `${trendResult.next_score_prediction}%` : '-'}</p>
            <p className="text-[10px] text-slate-500 mt-1">Linear Regression Model</p>
          </div>
          <div className="rounded-3xl border border-slate-700/60 bg-slate-900/70 p-5">
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Student Cluster</p>
            <p className="text-2xl font-black text-amber-400">{clusterResult ? clusterResult.cluster_label : '-'}</p>
            <p className="text-[10px] text-slate-500 mt-1">K-Means Classification</p>
          </div>
          <div className="rounded-3xl border border-slate-700/60 bg-slate-900/70 p-5">
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Trend Direction</p>
            <p className="text-2xl font-black text-fuchsia-400">{trendResult ? trendResult.trend_direction : '-'}</p>
            <p className="text-[10px] text-slate-500 mt-1">Gradient Analysis</p>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-3xl border border-slate-700/60 bg-slate-900/70 p-6 h-[400px] shadow-xl">
             <h3 className="text-sm font-black mb-4">Historical Performance Curve</h3>
            <Line data={lineChart} options={{ responsive: true, maintainAspectRatio: false, scales: { y: { grid: { color: '#334155' } } } }} />
          </div>
          <div className="rounded-3xl border border-slate-700/60 bg-slate-900/70 p-6 h-[400px] shadow-xl">
            <h3 className="text-sm font-black mb-4">University Subject Mastery</h3>
            <Bar data={barChart} options={{ responsive: true, maintainAspectRatio: false, scales: { y: { grid: { color: '#334155' } } } }} />
          </div>
        </section>
      </div>
    </div>
  );
}

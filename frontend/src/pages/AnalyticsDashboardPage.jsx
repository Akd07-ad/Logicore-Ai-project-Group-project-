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
import { fetchAnalyticsDashboard } from '../utils/api';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend);

function heatColor(hours) {
  if (hours >= 6) return 'bg-emerald-500';
  if (hours >= 4) return 'bg-cyan-500';
  if (hours >= 2.5) return 'bg-amber-500';
  return 'bg-rose-500';
}

export default function AnalyticsDashboardPage() {
  const [studentId, setStudentId] = useState('BD00001');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  const loadDashboard = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetchAnalyticsDashboard(studentId);
      setData(response.data);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to fetch analytics dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  const performanceChart = useMemo(() => {
    const points = data?.performance_over_time || [];
    return {
      labels: points.map((item) => `Week ${item.index}`),
      datasets: [
        {
          label: 'Performance',
          data: points.map((item) => item.score),
          borderColor: '#22d3ee',
          backgroundColor: 'rgba(34, 211, 238, 0.2)',
          fill: true,
          tension: 0.35,
        },
      ],
    };
  }, [data]);

  const studyVsScoreChart = useMemo(() => {
    const points = data?.study_vs_score || [];
    return {
      labels: points.map((_item, index) => `Point ${index + 1}`),
      datasets: [
        {
          label: 'Study Hours',
          data: points.map((item) => item.study_hours),
          backgroundColor: '#14b8a6',
        },
        {
          label: 'Score',
          data: points.map((item) => item.score),
          backgroundColor: '#f59e0b',
        },
      ],
    };
  }, [data]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-3xl font-black">Analytics Dashboard</h1>
          <Link className="rounded-lg border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800" to="/ai-insights">Back to AI Dashboard</Link>
        </header>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 flex flex-wrap gap-2">
          <input
            className="rounded-lg bg-slate-950 border border-slate-700 px-3 py-2"
            value={studentId}
            onChange={(event) => setStudentId(event.target.value)}
            placeholder="Student ID"
          />
          <button type="button" onClick={loadDashboard} disabled={loading} className="rounded-lg bg-sky-500 px-3 py-2 font-bold text-slate-950 hover:bg-sky-400 disabled:opacity-60">
            {loading ? 'Loading...' : 'Load Analytics'}
          </button>
          {error ? <p className="text-sm text-rose-400">{error}</p> : null}
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 h-[340px]">
            <Line data={performanceChart} options={{ responsive: true, maintainAspectRatio: false }} />
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 h-[340px]">
            <Bar data={studyVsScoreChart} options={{ responsive: true, maintainAspectRatio: false }} />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <h2 className="text-lg font-black">Study Intensity Heatmap</h2>
          <div className="mt-3 grid grid-cols-7 gap-2">
            {(data?.heatmap || []).map((cell) => (
              <div key={cell.day} className={`rounded-lg px-2 py-3 text-center text-xs font-semibold text-slate-950 ${heatColor(Number(cell.hours))}`}>
                <div>{cell.day}</div>
                <div>{cell.hours}h</div>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <h3 className="text-lg font-black">Weekly Report</h3>
            <p className="mt-2 text-sm text-slate-300">{data?.weekly_report || 'Load analytics to generate weekly report.'}</p>
          </article>
          <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <h3 className="text-lg font-black">Monthly Report</h3>
            <p className="mt-2 text-sm text-slate-300">{data?.monthly_report || 'Load analytics to generate monthly report.'}</p>
          </article>
        </section>
      </div>
    </div>
  );
}

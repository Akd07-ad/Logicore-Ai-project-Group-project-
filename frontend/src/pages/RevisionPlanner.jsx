import { useState } from 'react';
import { Link } from 'react-router-dom';
import { createRevisionPlan, submitRevisionFeedback } from '../utils/api';

export default function RevisionPlanner() {
  const [studentId, setStudentId] = useState('U00001');
  const [subject, setSubject] = useState('Data Structures');
  const [latestPerformance, setLatestPerformance] = useState(72);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [plan, setPlan] = useState([]);

  const generatePlan = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await createRevisionPlan({
        student_id: studentId,
        subject,
        latest_performance: Number(latestPerformance),
      });
      setPlan(response.data?.schedule || []);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Could not generate university revision plan.');
    } finally {
      setLoading(false);
    }
  };

  const sendFeedback = async (index, score) => {
    const selected = plan[index];
    if (!selected) return;
    try {
      if (!selected.id) {
        return;
      }
      await submitRevisionFeedback(selected.id, { score });
    } catch {
      // Non-blocking by design for planner UI.
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-[#050814] via-[#0c1327] to-[#050814] text-slate-100 px-4 py-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-700/60 bg-slate-900/70 p-6 shadow-xl">
          <div>
             <p className="text-xs uppercase tracking-[0.24em] text-cyan-400 font-bold">University Revision Engine</p>
             <h1 className="text-3xl font-black">AI Spaced Repetition Planner</h1>
          </div>
          <Link className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-bold hover:bg-slate-700 transition" to="/ai-insights">Back to AI Insights</Link>
        </header>

        <section className="rounded-3xl border border-slate-700/60 bg-slate-900/70 p-6 grid gap-4 md:grid-cols-4 shadow-xl">
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">University ID</label>
            <input className="w-full rounded-xl bg-slate-950 border border-slate-700 px-4 py-2 outline-none focus:border-cyan-500 transition" value={studentId} onChange={(e) => setStudentId(e.target.value)} placeholder="U00001" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Subject</label>
            <input className="w-full rounded-xl bg-slate-950 border border-slate-700 px-4 py-2 outline-none focus:border-cyan-500 transition" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Latest Score %</label>
            <input className="w-full rounded-xl bg-slate-950 border border-slate-700 px-4 py-2 outline-none focus:border-cyan-500 transition" type="number" value={latestPerformance} onChange={(e) => setLatestPerformance(e.target.value)} placeholder="Latest score" />
          </div>
          <div className="flex items-end">
             <button type="button" onClick={generatePlan} disabled={loading} className="w-full h-10 rounded-xl bg-emerald-500 px-3 py-2 font-black text-slate-950 hover:bg-emerald-400 disabled:opacity-60 transition shadow-lg shadow-emerald-500/20">
               {loading ? 'Optimizing...' : 'Generate Plan'}
             </button>
          </div>
        </section>

        {error ? <p className="text-sm text-rose-400 font-bold px-4">{error}</p> : null}

        <section className="rounded-3xl border border-slate-700/60 bg-slate-900/70 p-6 shadow-xl">
          <div className="mb-4">
             <h2 className="text-lg font-black uppercase tracking-widest text-slate-200">Personalized Spaced Repetition Schedule</h2>
             <p className="text-xs text-slate-400 mt-1">Algorithm: Day 1, Day 3, Day 7, Day 14 with adaptive intensity fallback.</p>
          </div>
          <div className="mt-6 grid gap-3">
            {plan.map((item, index) => (
              <div key={`${item.subject}-${item.revision_day_offset}-${index}`} className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4 flex flex-wrap items-center justify-between gap-4 transition-all hover:border-slate-600">
                <div className="flex items-center gap-4">
                   <div className="h-10 w-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 font-black">
                      {item.revision_day_offset}
                   </div>
                   <div>
                      <p className="font-black text-slate-100 uppercase tracking-tight">{item.subject}</p>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Scheduled: {new Date(item.scheduled_date).toLocaleDateString()} • {item.revision_status}</p>
                   </div>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => sendFeedback(index, 85)} className="rounded-xl bg-cyan-500/10 border border-cyan-500/20 px-4 py-2 text-xs font-black text-cyan-300 hover:bg-cyan-500 hover:text-slate-950 transition">Mastered</button>
                  <button type="button" onClick={() => sendFeedback(index, 45)} className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-2 text-xs font-black text-amber-300 hover:bg-amber-500 hover:text-slate-950 transition">Needs Review</button>
                </div>
              </div>
            ))}
            {!(plan.length) && <div className="py-12 text-center text-slate-500 italic text-sm">Input student performance data above to generate a revision cycle.</div>}
          </div>
        </section>
      </div>
    </div>
  );
}

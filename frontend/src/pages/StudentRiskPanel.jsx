import { useState } from 'react';
import { Link } from 'react-router-dom';
import { clusterStudent, fetchBehaviorAnalysis, fetchWeakSubjects, runRiskAnalysis } from '../utils/api';

export default function StudentRiskPanel() {
  const [studentId, setStudentId] = useState('U00001');
  const [predictedScore, setPredictedScore] = useState(65);
  const [attendance, setAttendance] = useState(80);
  const [studyHours, setStudyHours] = useState(4.5);
  const [loading, setLoading] = useState(false);
  const [riskData, setRiskData] = useState(null);
  const [clusterData, setClusterData] = useState(null);
  const [behaviorData, setBehaviorData] = useState(null);
  const [weakSubjects, setWeakSubjects] = useState([]);
  const [error, setError] = useState('');

  const runAnalysis = async () => {
    setLoading(true);
    setError('');
    try {
      const [risk, cluster, behavior, weak] = await Promise.all([
        runRiskAnalysis({
          student_id: studentId,
          predicted_exam_score: Number(predictedScore),
          attendance_percentage: Number(attendance),
          study_hours_per_day: Number(studyHours),
        }),
        clusterStudent(studentId),
        fetchBehaviorAnalysis(studentId),
        fetchWeakSubjects(studentId),
      ]);
      setRiskData(risk.data);
      setClusterData(cluster.data);
      setBehaviorData(behavior.data);
      setWeakSubjects(Array.isArray(weak.data) ? weak.data : []);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to load university risk insights.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-[#050814] via-[#0c1327] to-[#050814] text-slate-100 px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-700/60 bg-slate-900/70 p-6 shadow-xl">
          <div>
             <p className="text-xs uppercase tracking-[0.24em] text-rose-400 font-bold">Academic Intervention System</p>
             <h1 className="text-3xl font-black">Student Risk & Cluster Panel</h1>
          </div>
          <Link className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-bold hover:bg-slate-700 transition" to="/ai-insights">Back to AI Insights</Link>
        </header>

        <section className="rounded-3xl border border-slate-700/60 bg-slate-900/70 p-6 grid gap-4 md:grid-cols-5 shadow-xl">
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Student ID</label>
            <input className="w-full rounded-xl bg-slate-950 border border-slate-700 px-4 py-2 outline-none focus:border-rose-500 transition" value={studentId} onChange={(e) => setStudentId(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Predicted %</label>
            <input className="w-full rounded-xl bg-slate-950 border border-slate-700 px-4 py-2 outline-none focus:border-rose-500 transition" type="number" value={predictedScore} onChange={(e) => setPredictedScore(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Attendance %</label>
            <input className="w-full rounded-xl bg-slate-950 border border-slate-700 px-4 py-2 outline-none focus:border-rose-500 transition" type="number" value={attendance} onChange={(e) => setAttendance(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Study hrs/day</label>
            <input className="w-full rounded-xl bg-slate-950 border border-slate-700 px-4 py-2 outline-none focus:border-rose-500 transition" type="number" step="0.1" value={studyHours} onChange={(e) => setStudyHours(e.target.value)} />
          </div>
          <div className="flex items-end">
            <button type="button" onClick={runAnalysis} disabled={loading} className="w-full h-10 rounded-xl bg-rose-500 px-3 py-2 font-black text-slate-950 hover:bg-rose-400 disabled:opacity-60 transition shadow-lg shadow-rose-500/20">
              {loading ? 'Processing...' : 'Analyze Risk'}
            </button>
          </div>
        </section>

        {error ? <p className="text-sm text-rose-400 font-bold px-4">{error}</p> : null}

        <section className="grid gap-6 md:grid-cols-3">
          <article className="rounded-3xl border border-slate-700/60 bg-slate-900/70 p-6 shadow-xl border-t-4 border-t-rose-500">
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-2">Academic Risk Level</p>
            <p className="text-3xl font-black text-rose-400 uppercase">{riskData?.risk_level || 'Pending'}</p>
          </article>
          <article className="rounded-3xl border border-slate-700/60 bg-slate-900/70 p-6 shadow-xl border-t-4 border-t-amber-500">
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-2">Student Cluster</p>
            <p className="text-2xl font-black text-amber-400 uppercase">{clusterData?.cluster_label || 'Pending'}</p>
          </article>
          <article className="rounded-3xl border border-slate-700/60 bg-slate-900/70 p-6 shadow-xl border-t-4 border-t-cyan-500">
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-2">Device Engagement Impact</p>
            <p className="text-2xl font-black text-cyan-400 uppercase">{behaviorData?.device_impact_level || 'Pending'}</p>
          </article>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-3xl border border-slate-700/60 bg-slate-900/70 p-6 shadow-xl">
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-4">Risk Factor Analysis</h2>
              <ul className="space-y-3">
                {(riskData?.risk_reasons || []).map((reason) => (
                  <li key={reason} className="rounded-2xl bg-slate-950/50 border border-slate-800 p-4 text-sm text-slate-200 flex items-center gap-3">
                    <span className="h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]" />
                    {reason}
                  </li>
                ))}
                {!(riskData?.risk_reasons?.length) && <p className="text-slate-500 italic text-sm">No critical risks identified yet.</p>}
              </ul>
            </section>

            <section className="rounded-3xl border border-slate-700/60 bg-slate-900/70 p-6 shadow-xl">
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-4">Weak Subject Detection</h2>
              <div className="grid gap-3">
                {weakSubjects.map((item) => (
                  <div key={item.subject} className="rounded-2xl bg-slate-950/50 border border-slate-800 p-4">
                    <div className="flex justify-between items-center mb-1">
                       <p className="font-black text-cyan-300 uppercase tracking-tighter">{item.subject}</p>
                       <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.trend === 'Improving' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>{item.trend}</span>
                    </div>
                    <div className="flex gap-4 mt-2">
                       <p className="text-xs text-slate-400">Avg Score: <span className="text-white font-bold">{item.average_score}%</span></p>
                    </div>
                  </div>
                ))}
                {!(weakSubjects.length) && <p className="text-slate-500 italic text-sm">Synchronizing academic records...</p>}
              </div>
            </section>
        </div>
      </div>
    </div>
  );
}

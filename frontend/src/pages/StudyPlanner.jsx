import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  adaptStudyPlan,
  autoGenerateSchedule,
  fetchSchedules,
  fetchStudyPlans,
  generateSmartPlan,
  notifyStudyPlanReady,
} from '../utils/api';
import { useContext } from 'react';
import { NotificationContext } from '../context/NotificationContext';

const defaultPlannerForm = {
  class_level: 'University',
  subjects: 'Data Structures, Algorithms, Machine Learning, Database Systems',
  weak_subjects: 'Algorithms',
  strong_subjects: 'Database Systems',
  language: 'english',
  available_hours_per_day: 3,
  exam_score: 70,
  attendance_percentage: 82,
};

function splitByComma(value) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildYoutubeSearchUrl(subject, language) {
  const query = `${subject} ${language} tutorial`;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

function buildYoutubeSuggestions(subjects, weakSubjects, strongSubjects, language) {
  const allSubjects = [
    ...(Array.isArray(subjects) ? subjects : []),
    ...(Array.isArray(weakSubjects) ? weakSubjects : []),
    ...(Array.isArray(strongSubjects) ? strongSubjects : []),
  ];
  const normalizedSubjects = [...new Set(allSubjects.map((subject) => subject?.trim()).filter(Boolean))];
  return normalizedSubjects.map((subject) => ({
    subject,
    url: buildYoutubeSearchUrl(subject, language),
  }));
}

export default function StudyPlanner() {
  const navigate = useNavigate();
  const [form, setForm] = useState(defaultPlannerForm);
  const [plans, setPlans] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showResultModal, setShowResultModal] = useState(false);
  const [generatedResult, setGeneratedResult] = useState(null);
  const { addNotification } = useContext(NotificationContext);

  const selectedPlan = useMemo(
    () => plans.find((item) => item.id === selectedPlanId) || null,
    [plans, selectedPlanId]
  );

  // Keep planner data synced with backend on first page load.
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const plansResponse = await fetchStudyPlans();
        const planRows = plansResponse?.data || [];
        setPlans(planRows);

        const firstPlanId = planRows[0]?.id || null;
        setSelectedPlanId(firstPlanId);

        if (firstPlanId) {
          const scheduleResponse = await fetchSchedules(firstPlanId);
          setSchedules(scheduleResponse?.data || []);
        }
      } catch (apiError) {
        setError(apiError?.response?.data?.detail || 'Unable to load planner data.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [navigate]);

  const refreshSchedules = async (planId) => {
    if (!planId) {
      setSchedules([]);
      return;
    }
    const response = await fetchSchedules(planId);
    setSchedules(response?.data || []);
  };

  const handleGeneratePlan = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const planPayload = {
        class_level: form.class_level,
        subjects: splitByComma(form.subjects),
        weak_subjects: splitByComma(form.weak_subjects),
        strong_subjects: splitByComma(form.strong_subjects),
        available_hours_per_day: Number(form.available_hours_per_day),
        exam_score: Number(form.exam_score),
        attendance_percentage: Number(form.attendance_percentage),
      };

      // AI planner endpoint creates plan + initial auto-schedule.
      const result = await generateSmartPlan(planPayload);
      const youtubeSuggestions = buildYoutubeSuggestions(
        planPayload.subjects,
        planPayload.weak_subjects,
        planPayload.strong_subjects,
        form.language,
      );
      setGeneratedResult({ ...result?.data, youtube_suggestions: youtubeSuggestions });
      setShowResultModal(true);

      // Trigger notification
      // show immediate toast and store notification history
      const now = new Date().toISOString();
      if (result?.data?.plan?.id) {
        // fire backend notification (best-effort)
        notifyStudyPlanReady(result.data.plan.id).catch(() => {});
        addNotification({
          source: 'Study Planner',
          type: 'success',
          title: 'Study Plan Generated',
          message: `Smart study plan "${result.data.plan.title}" generated successfully.`,
          event: 'study_plan_generated',
          timestamp: now,
          isRead: false,
        });
      }

      const plansResponse = await fetchStudyPlans();
      const nextPlans = plansResponse?.data || [];
      setPlans(nextPlans);
      const newestPlan = nextPlans[0] || null;
      setSelectedPlanId(newestPlan?.id || null);
      await refreshSchedules(newestPlan?.id || null);
      setMessage('Smart study plan generated successfully.');
    } catch (apiError) {
      setError(apiError?.response?.data?.detail || 'Failed to generate smart plan.');
    } finally {
      setSaving(false);
    }
  };

  const handleAdapt = async () => {
    if (!selectedPlanId) return;
    setError('');
    setMessage('');
    try {
      // immediate toast
      addNotification({
        source: 'Study Planner',
        type: 'info',
        title: 'Adaptive Learning',
        message: 'Applying adaptive learning update...',
        event: 'adaptive_learning_started',
        timestamp: new Date().toISOString(),
        isRead: false,
      });
      await adaptStudyPlan(selectedPlanId);
      const plansResponse = await fetchStudyPlans();
      setPlans(plansResponse?.data || []);
      const ts = new Date().toLocaleTimeString();
      addNotification({
        source: 'Study Planner',
        type: 'success',
        title: 'Adaptive Learning Applied',
        message: `Adaptive learning applied successfully at ${ts}.`,
        event: 'adaptive_learning_completed',
        timestamp: new Date().toISOString(),
        isRead: false,
      });
      setMessage('Adaptive learning update applied to this study plan.');
    } catch (apiError) {
      setError(apiError?.response?.data?.detail || 'Failed to adapt the plan.');
    }
  };

  const handleAutoGenerate = async () => {
    if (!selectedPlanId) return;
    setError('');
    setMessage('');
    try {
      // immediate toast
      addNotification({
        source: 'Study Planner',
        type: 'info',
        title: 'Auto Schedule',
        message: 'Regenerating daily and weekly schedules...',
        event: 'auto_schedule_started',
        timestamp: new Date().toISOString(),
        isRead: false,
      });
      await autoGenerateSchedule(selectedPlanId);
      await refreshSchedules(selectedPlanId);
      const ts = new Date().toLocaleTimeString();
      addNotification({
        source: 'Study Planner',
        type: 'success',
        title: 'Schedules Updated',
        message: `Daily and weekly schedules regenerated at ${ts}.`,
        event: 'auto_schedule_completed',
        timestamp: new Date().toISOString(),
        isRead: false,
      });
      setMessage('Daily and weekly schedules regenerated.');
    } catch (apiError) {
      setError(apiError?.response?.data?.detail || 'Failed to auto-generate schedules.');
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-[#060914] text-slate-200 p-8">Loading planner...</div>;
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-[#050814] via-[#0c1327] to-[#050814] text-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-slate-700/60 bg-slate-900/70 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-cyan-300">Smart Study Planning</p>
              <h1 className="text-2xl font-black">AI-Based Study Planner</h1>
              <p className="text-sm text-slate-300 mt-1">Generate and adapt daily and weekly plans from performance and available time.</p>
            </div>
            <div className="flex gap-2">
              <Link to="/dashboard" className="rounded-xl bg-slate-800 px-3 py-2 text-sm font-bold hover:bg-slate-700">
                Back Dashboard
              </Link>
              <Link to="/task-tracker" className="rounded-xl bg-cyan-500 px-3 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-400">
                Open Task Tracker
              </Link>
            </div>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <section className="rounded-3xl border border-slate-700/60 bg-slate-900/70 p-5">
            <h2 className="text-lg font-black">Generate Personalized Plan</h2>
            <form onSubmit={handleGeneratePlan} className="mt-4 grid gap-3">
              <select
                value={form.class_level}
                onChange={(event) => setForm((prev) => ({ ...prev, class_level: event.target.value }))}
                className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2"
              >
                <option value="University">University Only</option>
              </select>
              <input
                value={form.subjects}
                onChange={(event) => setForm((prev) => ({ ...prev, subjects: event.target.value }))}
                placeholder="Subjects (comma separated)"
                className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2"
              />
              <input
                value={form.weak_subjects}
                onChange={(event) => setForm((prev) => ({ ...prev, weak_subjects: event.target.value }))}
                placeholder="Weak subjects"
                className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2"
              />
              <input
                value={form.strong_subjects}
                onChange={(event) => setForm((prev) => ({ ...prev, strong_subjects: event.target.value }))}
                placeholder="Strong subjects"
                className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2"
              />
              <div className="space-y-2">
                <select
                  value={form.language}
                  onChange={(event) => setForm((prev) => ({ ...prev, language: event.target.value }))}
                  className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 w-full"
                >
                  <option value="english">English</option>
                  <option value="hindi">Hindi</option>
                  <option value="bangla">Bangla</option>
                </select>
                <p className="text-xs text-slate-400">
                  Select your preferred tutorial language. The generated YouTube links will search for each subject in this language.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="number"
                  step="0.5"
                  min="1"
                  max="10"
                  value={form.available_hours_per_day}
                  onChange={(event) => setForm((prev) => ({ ...prev, available_hours_per_day: event.target.value }))}
                  placeholder="Hours/day"
                  className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2"
                />
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={form.exam_score}
                  onChange={(event) => setForm((prev) => ({ ...prev, exam_score: event.target.value }))}
                  placeholder="Exam score"
                  className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2"
                />
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={form.attendance_percentage}
                  onChange={(event) => setForm((prev) => ({ ...prev, attendance_percentage: event.target.value }))}
                  placeholder="Attendance %"
                  className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2"
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-cyan-500 px-4 py-2 font-black text-slate-950 hover:bg-cyan-400 disabled:opacity-60"
              >
                {saving ? 'Generating...' : 'Generate Smart Plan'}
              </button>
            </form>
            {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
            {message ? <p className="mt-3 text-sm text-emerald-300">{message}</p> : null}
          </section>

          <section className="rounded-3xl border border-slate-700/60 bg-slate-900/70 p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-black">Existing Study Plans</h2>
              <button onClick={handleAdapt} disabled={!selectedPlanId} className="rounded-xl bg-emerald-500 px-3 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-60">
                Apply Adaptive Learning
              </button>
            </div>
            <div className="mt-3 space-y-2 max-h-56 overflow-auto">
              {plans.map((plan) => (
                <button
                  key={plan.id}
                  onClick={async () => {
                    setSelectedPlanId(plan.id);
                    await refreshSchedules(plan.id);
                  }}
                  className={`w-full rounded-xl border px-3 py-2 text-left ${selectedPlanId === plan.id ? 'border-cyan-400 bg-cyan-500/10' : 'border-slate-700 bg-slate-950/50'}`}
                >
                  <p className="font-bold">{plan.title}</p>
                  <p className="text-xs text-slate-300">
                    {plan.class_level} | {plan.adaptive_difficulty} | {plan.weekly_target_hours} hrs/week
                  </p>
                </button>
              ))}
              {!plans.length ? <p className="text-sm text-slate-400">No plans yet. Generate one from the form.</p> : null}
            </div>
            {selectedPlan ? (
              <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950/50 p-3 text-sm">
                <p>Subjects: {selectedPlan.subjects.join(', ')}</p>
                <p>Weak: {selectedPlan.weak_subjects.join(', ') || 'N/A'}</p>
                <p>Strong: {selectedPlan.strong_subjects.join(', ') || 'N/A'}</p>
              </div>
            ) : null}
            <button
              onClick={handleAutoGenerate}
              disabled={!selectedPlanId}
              className="mt-3 rounded-xl bg-fuchsia-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-fuchsia-400 disabled:opacity-60"
            >
              Auto Generate Daily + Weekly Schedule
            </button>
          </section>
        </div>

        <section className="rounded-3xl border border-slate-700/60 bg-slate-900/70 p-5">
          <h2 className="text-lg font-black">Generated Schedule</h2>
          <p className="text-sm text-slate-300 mt-1">Schedules are personalized by weak subjects and available time.</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm min-w-180">
              <thead>
                <tr className="text-slate-400 border-b border-slate-700">
                  <th className="py-2 text-left">Day</th>
                  <th className="py-2 text-left">Subject</th>
                  <th className="py-2 text-left">Start</th>
                  <th className="py-2 text-left">Minutes</th>
                  <th className="py-2 text-left">Difficulty</th>
                  <th className="py-2 text-left">Scope</th>
                </tr>
              </thead>
              <tbody>
                {schedules.map((row) => (
                  <tr key={row.id} className="border-b border-slate-800">
                    <td className="py-2">{row.day_of_week}</td>
                    <td className="py-2">{row.subject}</td>
                    <td className="py-2">{row.start_time}</td>
                    <td className="py-2">{row.planned_minutes}</td>
                    <td className="py-2">{row.difficulty_level}</td>
                    <td className="py-2">{row.schedule_scope}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Result Modal */}
      {showResultModal && generatedResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-3xl border border-slate-700 bg-slate-900 p-8 max-h-[90vh] overflow-y-auto">
            <div className="mb-6">
              <h2 className="text-2xl font-black text-cyan-300">Study Plan Generated! 🎉</h2>
              <p className="text-sm text-slate-400 mt-2">{generatedResult.adaptive_reason}</p>
            </div>

            <div className="space-y-4">
              {/* Plan Details */}
              <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
                <h3 className="font-bold text-lg mb-3">{generatedResult.plan.title}</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-slate-400">Difficulty</p>
                    <p className="font-semibold text-cyan-300">{generatedResult.plan.adaptive_difficulty}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Weekly Target</p>
                    <p className="font-semibold">{generatedResult.plan.weekly_target_hours} hours</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Exam Score</p>
                    <p className="font-semibold">{generatedResult.plan.exam_score}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Attendance</p>
                    <p className="font-semibold">{generatedResult.plan.attendance_percentage}%</p>
                  </div>
                </div>
              </div>

              {/* Focus Recommendation */}
              <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
                <p className="text-sm text-slate-300">
                  <strong>Recommended Focus Session:</strong> {generatedResult.suggested_focus_minutes} minutes per session
                </p>
              </div>

              {/* Daily Schedule Preview */}
              {generatedResult.daily_schedule && generatedResult.daily_schedule.length > 0 && (
                <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
                  <h4 className="font-bold mb-3">Monday Schedule Preview</h4>
                  <div className="space-y-2 text-sm">
                    {generatedResult.daily_schedule.slice(0, 3).map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center p-2 rounded bg-slate-700/30">
                        <span>{item.subject}</span>
                        <span className="text-cyan-300">{item.planned_minutes} min</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {generatedResult.youtube_suggestions && generatedResult.youtube_suggestions.length > 0 && (
                <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
                  <h4 className="font-bold mb-3">YouTube Study Resources</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-700 text-left text-slate-400">
                          <th className="py-2">Subject</th>
                          <th className="py-2">YouTube Link</th>
                        </tr>
                      </thead>
                      <tbody>
                        {generatedResult.youtube_suggestions.map((item) => (
                          <tr key={item.subject} className="border-b border-slate-700/50">
                            <td className="py-2 pr-4">{item.subject}</td>
                            <td className="py-2">
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-cyan-300 hover:text-cyan-200 wrap-break-word"
                              >
                                Open YouTube Search
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowResultModal(false)}
                  className="flex-1 rounded-xl bg-slate-700 px-4 py-2 font-bold text-slate-100 hover:bg-slate-600 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setShowResultModal(false);
                    navigate(`/task-tracker?plan_id=${generatedResult.plan.id}`);
                  }}
                  className="flex-1 rounded-xl bg-cyan-500 px-4 py-2 font-bold text-slate-950 hover:bg-cyan-400 transition-colors"
                >
                  View Full Plan →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

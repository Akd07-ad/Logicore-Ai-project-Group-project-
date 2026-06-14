import { Suspense, lazy, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Bell,
  BrainCircuit,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  LogOut,
  Moon,
  PlusCircle,
  RefreshCw,
  Sun,
  TriangleAlert,
  UserCircle2,
} from 'lucide-react';
import PageTransition from '../components/PageTransition';
import useSocket from '../hooks/useSocket';
import { useProfileContext } from '../context/ProfileContext';
import { NotificationContext } from '../context/NotificationContext';
import {
  createHabitLog,
  fetchProfile,
  fetchDashboardData,
  fetchStudySuggestions,
  fetchStudyPlans,
  updateProfile,
  WS_BASE_URL,
} from '../utils/api';

const LiveChatWidget = lazy(() => import('../components/LiveChatWidget'));

const sidebarLinks = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'predictions', label: 'My Predictions' },
  { id: 'habits', label: 'Habit Tracker' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'profile', label: 'Profile' },
  { id: 'settings', label: 'Settings' },
];

const riskRank = { Low: 1, Medium: 2, High: 3 };
const riskColor = { Low: '#22c55e', Medium: '#f59e0b', High: '#ef4444' };
const habitStatusOptions = [
  { label: 'Pending', value: 'pending' },
  { label: 'Completed', value: 'completed' },
  { label: 'Skipped', value: 'skipped' },
];
const initialProfileForm = {
  full_name: '',
  student_id: '',
  department: '',
  target_cgpa: '',
  profile_picture: '',
};
const FALLBACK_PROFILE_IMAGE =
  'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22128%22 height=%22128%22 viewBox=%220 0 128 128%22%3E%3Crect width=%22128%22 height=%22128%22 rx=%2224%22 fill=%22%230f172a%22/%3E%3Ccircle cx=%2264%22 cy=%2250%22 r=%2224%22 fill=%22%2322d3ee%22 fill-opacity=%220.3%22/%3E%3Cpath d=%22M24 110c4-19 20-30 40-30s36 11 40 30%22 stroke=%22%2322d3ee%22 stroke-width=%228%22 stroke-linecap=%22round%22 fill=%22none%22/%3E%3C/svg%3E';
const YOUTUBE_API_URL = 'https://www.googleapis.com/youtube/v3/search';
const YOUTUBE_FALLBACK_VIDEOS = [
  { videoId: 'IlU-zDU6aQ0', title: 'How to Study for Exams' },
  { videoId: 'ukLnPbIffxE', title: 'Time Management Tips for Students' },
  { videoId: 'CPxSzxylRCI', title: 'How to Stop Procrastinating' },
];

function getYoutubeQueryByCgpa(cgpa) {
  if (!Number.isFinite(cgpa)) {
    return 'study motivation exam preparation productivity tips';
  }

  if (cgpa >= 3.5) {
    return 'advanced programming system design career skills';
  }

  if (cgpa >= 3.0) {
    return 'study motivation exam preparation productivity tips';
  }

  return 'study basics focus improvement student motivation';
}

function splitCsv(value) {
  if (Array.isArray(value)) {
    return value.map((item) => item?.toString().trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function buildYoutubeSearchUrl(subject, language = 'english') {
  const query = `${subject} ${language} tutorial`.trim();
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

function buildPlanYoutubeSuggestions(plan, language = 'english') {
  const subjects = [
    ...splitCsv(plan.subjects),
    ...splitCsv(plan.weak_subjects),
    ...splitCsv(plan.strong_subjects),
  ];
  const uniqueSubjects = [...new Set(subjects.map((item) => item.trim()).filter(Boolean))];
  return uniqueSubjects.map((subject) => ({
    subject,
    youtube_url: buildYoutubeSearchUrl(subject, language),
  }));
}

function Spinner() {
  return (
    <div className="min-h-screen bg-[#060914] text-slate-200 flex items-center justify-center">
      <div className="flex items-center gap-3 text-sm">
        <span className="h-4 w-4 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
        Loading Dashboard...
      </div>
    </div>
  );
}

function Panel({ title, description, children, action }) {
  return (
    <section className="rounded-3xl border border-slate-700/50 bg-slate-900/70 p-5 shadow-[0_16px_50px_rgba(2,6,23,0.45)]">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-black text-white">{title}</h3>
          {description ? <p className="mt-1 text-sm text-slate-400">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function MetricCard({ label, value, subtext, icon: Icon, accent = 'text-cyan-300' }) {
  return (
    <div className="rounded-3xl border border-slate-700/50 bg-slate-900/70 p-4 shadow-[0_12px_36px_rgba(2,6,23,0.35)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{label}</p>
          <p className={`mt-2 text-2xl font-black ${accent}`}>{value}</p>
          {subtext ? <p className="mt-1 text-sm text-slate-400">{subtext}</p> : null}
        </div>
        {Icon ? (
          <div className="rounded-2xl bg-slate-800/70 p-3 text-cyan-300">
            <Icon className="h-5 w-5" />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CardList({ items, emptyText, renderItem }) {
  if (!items.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/50 px-4 py-8 text-center text-sm text-slate-400">
        {emptyText}
      </div>
    );
  }

  return <div className="space-y-3">{items.map(renderItem)}</div>;
}

function formatDateTime(value) {
  if (!value) return '-';
  const normalizedValue = typeof value === 'string' && !/[zZ]|[+-]\d{2}:\d{2}$/.test(value) ? `${value}Z` : value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(normalizedValue));
}

function normalizeDashboard(payload) {
  return {
    history: Array.isArray(payload.history) ? payload.history : [],
    profile: payload.profile || initialProfileForm,
    habits: Array.isArray(payload.habits) ? payload.habits : [],
    notifications: Array.isArray(payload.notifications) ? payload.notifications : [],
    weekly_schedule: Array.isArray(payload.weekly_schedule) ? payload.weekly_schedule : [],
    study_suggestions: Array.isArray(payload.study_suggestions) ? payload.study_suggestions : [],
    risk: payload.risk || 'Low',
    server_status: payload.server_status || 'unknown',
    summary: {
      latest_confidence: payload.summary?.latest_confidence || 0,
      latest_attendance: payload.summary?.latest_attendance || 0,
      latest_study_hours: payload.summary?.latest_study_hours || 0,
    },
  };
}

function ProfileSummary({ profile, historyCount }) {
  const imageUrl = (profile?.profile_picture || '').trim() || FALLBACK_PROFILE_IMAGE;

  const studentName = profile?.full_name?.trim() || 'Student';

  return (
    <Panel title="Profile Summary" description="What the dashboard currently knows about the student.">
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 overflow-hidden rounded-2xl bg-cyan-500/15">
          <img
            src={imageUrl}
            alt="Profile"
            className="h-full w-full object-cover"
            onError={(event) => {
              event.currentTarget.src = FALLBACK_PROFILE_IMAGE;
            }}
          />
        </div>
        <div>
          <p className="text-xl font-black text-white">{studentName}</p>
          <p className="text-sm text-slate-400">{profile?.student_id || 'Student ID not set'}</p>
          <p className="text-sm text-slate-400">{profile?.department || 'Department not set'}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <MetricCard label="Target CGPA" value={profile?.target_cgpa ?? 'N/A'} subtext="Profile goal" icon={CheckCircle2} />
        <MetricCard label="History Count" value={`${historyCount}`} subtext="Saved predictions" icon={ClipboardList} />
      </div>
    </Panel>
  );
}

export default function StudentDashboard() {
  const navigate = useNavigate();
  const { profile, setProfile: setSharedProfile, refreshProfile } = useProfileContext();
  const { unreadCount } = useContext(NotificationContext);
  const token = localStorage.getItem('token');
  const userId = Number(localStorage.getItem('user_id'));

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [activeSection, setActiveSection] = useState('dashboard');
  const [dashboardData, setDashboardData] = useState(normalizeDashboard({}));
  const [profileForm, setProfileForm] = useState(initialProfileForm);
  const [habitForm, setHabitForm] = useState({ title: '', status: 'pending' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingHabit, setSavingHabit] = useState(false);
  const [autoSavingProfilePicture, setAutoSavingProfilePicture] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [isDarkTheme, setIsDarkTheme] = useState(localStorage.getItem('theme') === 'dark');
  const [youtubeVideos, setYoutubeVideos] = useState(YOUTUBE_FALLBACK_VIDEOS);
  const [youtubeLoading, setYoutubeLoading] = useState(true);
  const [youtubeNotice, setYoutubeNotice] = useState('');
  const [planYoutubeSuggestions, setPlanYoutubeSuggestions] = useState([]);
  const [planYoutubeLoading, setPlanYoutubeLoading] = useState(false);
  const profilePictureSaveTimeoutRef = useRef(null);
  const profileFormRef = useRef(initialProfileForm);
  const youtubeNoticeShownRef = useRef(false);

  const youtubeApiKey = import.meta.env.VITE_YOUTUBE_API_KEY || '';

  const student = useMemo(
    () => ({ cgpa: Number(profile?.target_cgpa ?? dashboardData.profile?.target_cgpa) }),
    [dashboardData.profile?.target_cgpa, profile?.target_cgpa]
  );

  const youtubeSearchQuery = useMemo(() => {
    const cgpa = student.cgpa;
    return getYoutubeQueryByCgpa(cgpa);
  }, [student.cgpa]);

  const fetchYoutubeVideos = useCallback(async () => {
    setYoutubeLoading(true);

    try {
      if (!youtubeApiKey) {
        throw new Error('YouTube API key is missing.');
      }

      const params = new URLSearchParams({
        part: 'snippet',
        type: 'video',
        q: youtubeSearchQuery,
        maxResults: '6',
        key: youtubeApiKey,
      });

      const response = await fetch(`${YOUTUBE_API_URL}?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`YouTube API request failed with status ${response.status}`);
      }

      const data = await response.json();
      if (!Array.isArray(data?.items)) {
        throw new Error('YouTube API response does not include a valid items array.');
      }

      const mappedVideos = data.items
        .map((item) => ({
          videoId: item?.id?.videoId,
          title: item?.snippet?.title || 'YouTube Study Video',
        }))
        .filter((item) => item.videoId);

      setYoutubeVideos(mappedVideos.length ? mappedVideos : YOUTUBE_FALLBACK_VIDEOS);
      setYoutubeNotice('');
    } catch (err) {
      console.error('YouTube API error:', err);
      if (!youtubeNoticeShownRef.current) {
        setYoutubeNotice('Unable to load live YouTube suggestions right now. Showing recommended videos instead.');
        youtubeNoticeShownRef.current = true;
      }
      setYoutubeVideos(YOUTUBE_FALLBACK_VIDEOS);
    } finally {
      setYoutubeLoading(false);
    }
  }, [youtubeApiKey, youtubeSearchQuery]);

  useEffect(() => {
    fetchYoutubeVideos();
  }, [fetchYoutubeVideos]);

  const renderYoutubeSuggestions = () => (
    <Panel
      title="Smart Study Suggestions"
      description="YouTube recommendations based on your study plan or CGPA."
      action={
        <button
          type="button"
          onClick={() => {
            // prefer refreshing plan-based suggestions if available, otherwise refresh generic videos
            if (planYoutubeSuggestions.length) {
              (async () => {
                setPlanYoutubeLoading(true);
                try {
                  const plansResp = await fetchStudyPlans();
                  const plan = (plansResp?.data || [])[0] || null;
                  if (plan) {
                    const language = (plan.language || 'english').toString().toLowerCase();
                    setPlanYoutubeSuggestions(buildPlanYoutubeSuggestions(plan, language));
                  }
                } catch (e) {
                  console.error('Failed to refresh planner suggestions:', e);
                } finally {
                  setPlanYoutubeLoading(false);
                }
              })();
            } else {
              fetchYoutubeVideos();
            }
          }}
          className="rounded-xl bg-cyan-500 px-3 py-2 text-xs font-black text-slate-950 transition hover:bg-cyan-400"
        >
          Refresh Videos
        </button>
      }
    >
      {planYoutubeLoading || youtubeLoading ? (
        <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-6 text-sm text-cyan-200">
          Loading study videos...
        </div>
      ) : null}

      {!youtubeLoading && youtubeNotice ? (
        <div className="mb-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {youtubeNotice}
        </div>
      ) : null}

      {/* If plan-based YouTube suggestions exist, show them as links; otherwise show embedded videos */}
      {planYoutubeSuggestions && planYoutubeSuggestions.length > 0 ? (
        <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
          <h4 className="font-bold mb-3">YouTube Resources from Study Plan</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-left text-slate-400">
                  <th className="py-2">Subject</th>
                  <th className="py-2">YouTube Link</th>
                </tr>
              </thead>
              <tbody>
                {planYoutubeSuggestions.map((item, idx) => (
                  <tr key={idx} className="border-b border-slate-700/50">
                    <td className="py-2 pr-4">{item.subject}</td>
                    <td className="py-2">
                      <a href={item.youtube_url} target="_blank" rel="noopener noreferrer" className="text-cyan-300 hover:text-cyan-200">
                        Open YouTube Search
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        !youtubeLoading ? (
          <div className="space-y-4">
            {youtubeVideos.map((video) => (
              <article key={video.videoId} className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-950/60 p-3">
                <div className="aspect-video w-full overflow-hidden rounded-xl border border-slate-800 bg-black">
                  <iframe
                    className="h-full w-full"
                    src={`https://www.youtube.com/embed/${video.videoId}`}
                    title={video.title}
                    loading="lazy"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                  />
                </div>
                <p className="mt-3 line-clamp-2 text-sm font-semibold text-slate-100">{video.title}</p>
              </article>
            ))}
          </div>
        ) : null
      )}
    </Panel>
  );

  const syncProfileState = useCallback((profilePayload) => {
    const nextProfile = {
      full_name: profilePayload?.full_name || '',
      student_id: profilePayload?.student_id || '',
      department: profilePayload?.department || '',
      target_cgpa: profilePayload?.target_cgpa ?? '',
      profile_picture: profilePayload?.profile_picture || '',
      image_url: profilePayload?.image_url || profilePayload?.profile_picture || '',
    };
    setSharedProfile(nextProfile);
    setProfileForm({
      full_name: nextProfile.full_name,
      student_id: nextProfile.student_id,
      department: nextProfile.department,
      target_cgpa: nextProfile.target_cgpa,
      profile_picture: nextProfile.profile_picture,
    });
    setDashboardData((current) => ({
      ...current,
      profile: {
        ...current.profile,
        full_name: nextProfile.full_name,
        student_id: nextProfile.student_id,
        department: nextProfile.department,
        target_cgpa: nextProfile.target_cgpa,
        profile_picture: nextProfile.profile_picture,
      },
    }));
  }, [setSharedProfile]);

  const fetchProfileData = useCallback(async () => {
    const response = await fetchProfile();
    const latestProfile = response?.data || {};
    syncProfileState(latestProfile);
    await refreshProfile();
    return latestProfile;
  }, [refreshProfile, syncProfileState]);

  const loadDashboard = useCallback(
    async (silent = false) => {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const [response, suggestionsResponse] = await Promise.all([
          fetchDashboardData(),
          fetchStudySuggestions(),
        ]);
        const payload = response?.data || {};
        const normalized = normalizeDashboard(payload);
        normalized.study_suggestions = Array.isArray(suggestionsResponse?.data)
          ? suggestionsResponse.data
          : normalized.study_suggestions;
        setDashboardData(normalized);
        syncProfileState(normalized.profile);
        setPlanYoutubeLoading(true);
        setPlanYoutubeSuggestions([]);
        try {
          const plansResp = await fetchStudyPlans();
          const plans = plansResp?.data || [];
          const plan = plans[0] || null;
          if (plan) {
            const language = (plan.language || 'english').toString().toLowerCase();
            setPlanYoutubeSuggestions(buildPlanYoutubeSuggestions(plan, language));
          }
        } catch (planErr) {
          console.error('Failed to build planner YouTube suggestions:', planErr);
          setPlanYoutubeSuggestions([]);
        } finally {
          setPlanYoutubeLoading(false);
        }
        setLastSyncedAt(new Date().toISOString());
      } catch (err) {
        console.error(err);
        if (err?.response?.status === 401) {
          navigate('/login');
          return;
        }
        setError(err);
      } finally {
        if (silent) {
          setRefreshing(false);
        } else {
          setLoading(false);
        }
      }
    },
    [navigate, syncProfileState]
  );

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    loadDashboard();
  }, [loadDashboard, navigate, token]);

  useEffect(() => {
    profileFormRef.current = profileForm;
  }, [profileForm]);

  useEffect(() => {
    if (!token) return undefined;

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadDashboard(true);
      }
    }, 30000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadDashboard(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadDashboard, token]);

  const { isConnected } = useSocket(`${WS_BASE_URL}/ws/dashboard`, {
    enabled: Boolean(token && userId),
    onMessage: (message) => {
      if (['prediction_created', 'profile_updated', 'habit_created'].includes(message?.type)) {
        loadDashboard(true);
      }
    },
  });

  const chartData = useMemo(
    () =>
      dashboardData.history
        .slice()
        .reverse()
        .map((row) => ({
          ...row,
          dateLabel: row.date ? new Date(row.date).toLocaleDateString() : '-',
          riskValue: riskRank[row.risk_result] || 0,
        })),
    [dashboardData.history]
  );

  const donutData = useMemo(() => {
    const low = dashboardData.history.filter((entry) => entry.risk_result === 'Low').length;
    const medium = dashboardData.history.filter((entry) => entry.risk_result === 'Medium').length;
    const high = dashboardData.history.filter((entry) => entry.risk_result === 'High').length;

    return [
      { name: 'Low', value: low, color: '#22c55e' },
      { name: 'Medium', value: medium, color: '#f59e0b' },
      { name: 'High', value: high, color: '#ef4444' },
    ];
  }, [dashboardData.history]);

  const confidencePercent = ((dashboardData.summary.latest_confidence || 0) * 100).toFixed(1);
  const studentName = profile.full_name || 'Student';
  const profilePictureDirty =
    (profileForm.profile_picture || '').trim() !== (profile.profile_picture || '').trim();

  const toProfilePayload = useCallback((source) => ({
    ...source,
    target_cgpa: source.target_cgpa === '' ? null : Number(source.target_cgpa),
  }), []);

  const handleThemeToggle = () => {
    const nextTheme = !isDarkTheme;
    setIsDarkTheme(nextTheme);
    if (nextTheme) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user_id');
    navigate('/login');
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    setSavingProfile(true);
    try {
      await updateProfile(toProfilePayload(profileForm));
      await fetchProfileData();
      await loadDashboard(true);
      setActiveSection('profile');
    } catch (err) {
      console.error(err);
      setError(err);
    } finally {
      setSavingProfile(false);
    }
  };

  useEffect(() => {
    if (profilePictureSaveTimeoutRef.current) {
      window.clearTimeout(profilePictureSaveTimeoutRef.current);
      profilePictureSaveTimeoutRef.current = null;
    }

    if (!token || !profilePictureDirty) {
      return undefined;
    }

    profilePictureSaveTimeoutRef.current = window.setTimeout(async () => {
      const snapshot = profileFormRef.current;
      setAutoSavingProfilePicture(true);
      try {
        await updateProfile(toProfilePayload(snapshot));
        await fetchProfileData();
        setLastSyncedAt(new Date().toISOString());
      } catch (err) {
        console.error(err);
        setError(err);
      } finally {
        setAutoSavingProfilePicture(false);
      }
    }, 650);

    return () => {
      if (profilePictureSaveTimeoutRef.current) {
        window.clearTimeout(profilePictureSaveTimeoutRef.current);
      }
    };
  }, [fetchProfileData, profilePictureDirty, profileForm.profile_picture, token, toProfilePayload]);

  const handleHabitSave = async (event) => {
    event.preventDefault();
    if (!habitForm.title.trim()) {
      return;
    }

    setSavingHabit(true);
    try {
      await createHabitLog(habitForm);
      setHabitForm({ title: '', status: 'pending' });
      await loadDashboard(true);
      setActiveSection('habits');
    } catch (err) {
      console.error(err);
      setError(err);
    } finally {
      setSavingHabit(false);
    }
  };

  if (loading) return <Spinner />;

  if (error) {
    return (
      <div className="min-h-screen bg-[#060914] text-slate-200 flex items-center justify-center px-4">
        <div className="max-w-md w-full rounded-3xl border border-rose-500/30 bg-rose-500/10 p-6 shadow-[0_18px_60px_rgba(127,29,29,0.35)]">
          <h2 className="text-2xl font-black text-rose-300">Connection Lost</h2>
          <p className="mt-2 text-sm text-slate-200">Unable to fetch dashboard data. Check the backend service and retry.</p>
          <button
            type="button"
            onClick={() => loadDashboard()}
            className="mt-4 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-400"
          >
            Reconnect
          </button>
        </div>
      </div>
    );
  }

  const renderOverview = () => (
    <div className="grid gap-5 xl:grid-cols-[1.45fr_0.9fr]">
      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <MetricCard label="Current Risk" value={dashboardData.risk} subtext="Latest prediction status" icon={TriangleAlert} accent="text-white" />
          <MetricCard label="Confidence" value={`${confidencePercent}%`} subtext="Model confidence" icon={CheckCircle2} />
          <MetricCard label="Attendance" value={`${dashboardData.summary.latest_attendance}%`} subtext="Latest submitted attendance" icon={CalendarDays} />
          <MetricCard label="Study Hours" value={`${dashboardData.summary.latest_study_hours}h`} subtext="Average daily study time" icon={ClipboardList} />
          <MetricCard label="Student" value={studentName} subtext={dashboardData.profile.department || 'Profile not completed'} icon={UserCircle2} />
        </div>

        <Panel
          title="Real-time Study Suggestions"
          description="Suggestions update automatically when your prediction data changes."
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {(dashboardData.study_suggestions || []).map((item, index) => (
              <div key={`${item.title}-${index}`} className="rounded-2xl border border-cyan-500/25 bg-cyan-500/10 p-4 overflow-hidden">
                <p className="text-sm font-black text-cyan-200">{item.title}</p>
                <p
                  className="mt-1 text-sm text-slate-200"
                  style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}
                >
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </Panel>

        <div className="grid gap-4 xl:grid-cols-[1.35fr_0.85fr]">
          <Panel
            title="Risk Level Over Time"
            description="The dashboard updates automatically when new predictions, habits, or profile edits are saved."
            action={
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${isConnected ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'}`}>
                {isConnected ? 'Live sync on' : 'Sync reconnecting'}
              </span>
            }
          >
            <div className="h-84">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="4 4" stroke="#334155" />
                  <XAxis dataKey="dateLabel" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis
                    domain={[1, 3]}
                    ticks={[1, 2, 3]}
                    tickFormatter={(value) => (value === 1 ? 'Low' : value === 2 ? 'Med' : 'High')}
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{ background: '#020617', border: '1px solid #334155', color: '#e2e8f0' }}
                    labelStyle={{ color: '#e2e8f0' }}
                  />
                  <Area type="monotone" dataKey="riskValue" stroke="#22d3ee" fill="#22d3ee55" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel title="Performance vs Risk Share" description="Distribution of your latest prediction history.">
            <div className="h-84">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={donutData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={95} paddingAngle={4}>
                    {donutData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: '#020617', border: '1px solid #334155', color: '#e2e8f0' }}
                    labelStyle={{ color: '#e2e8f0' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </div>

        <Panel title="Recent Predictions" description="The latest entries from the prediction history table.">
          <div className="overflow-x-auto">
            <table className="w-full min-w-176 text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400">
                  <th className="py-2 text-left">Date & Time</th>
                  <th className="py-2 text-left">Risk</th>
                  <th className="py-2 text-left">Attendance</th>
                  <th className="py-2 text-left">Study</th>
                  <th className="py-2 text-left">Stress</th>
                  <th className="py-2 text-left">Assignment</th>
                </tr>
              </thead>
              <tbody>
                {dashboardData.history.map((row) => (
                  <tr key={row.id} className="border-b border-slate-800 text-slate-200">
                    <td className="py-2">{formatDateTime(row.date)}</td>
                    <td className="py-2 font-bold" style={{ color: riskColor[row.risk_result] || '#e2e8f0' }}>
                      {row.risk_result}
                    </td>
                    <td className="py-2">{row.attendance}</td>
                    <td className="py-2">{row.study_hours}</td>
                    <td className="py-2">{row.stress}</td>
                    <td className="py-2">{row.assignment_status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <div className="space-y-5">
        <ProfileSummary profile={profile} historyCount={dashboardData.history.length} />
        {renderYoutubeSuggestions()}
      </div>
    </div>
  );

  const renderPredictions = () => (
    <div className="space-y-5">
      <Panel
        title="Prediction History"
        description="Review your academic risk records and sync status."
        action={
          <Link to="/predict" className="rounded-full bg-cyan-500 px-4 py-2 text-sm font-black text-slate-950 hover:bg-cyan-400">
            Start Prediction
          </Link>
        }
      >
        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard label="Latest Risk" value={dashboardData.risk} subtext="Current classification" icon={TriangleAlert} accent="text-white" />
          <MetricCard label="Records" value={`${dashboardData.history.length}`} subtext="Saved predictions" icon={ClipboardList} />
          <MetricCard label="Sync" value={isConnected ? 'Connected' : 'Offline'} subtext={lastSyncedAt ? new Date(lastSyncedAt).toLocaleTimeString() : 'Not synced yet'} icon={RefreshCw} accent={isConnected ? 'text-emerald-300' : 'text-amber-300'} />
        </div>
      </Panel>

      <Panel title="History Table" description="This table is driven by the shared dashboard snapshot so it updates with every backend write.">
        <div className="overflow-x-auto">
          <table className="w-full min-w-176 text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400">
                <th className="py-2 text-left">Date & Time</th>
                <th className="py-2 text-left">Risk</th>
                <th className="py-2 text-left">Attendance</th>
                <th className="py-2 text-left">Study</th>
                <th className="py-2 text-left">Sleep</th>
                <th className="py-2 text-left">Stress</th>
              </tr>
            </thead>
            <tbody>
              {dashboardData.history.map((row) => (
                <tr key={row.id} className="border-b border-slate-800 text-slate-200">
                  <td className="py-2">{formatDateTime(row.date)}</td>
                  <td className="py-2 font-bold" style={{ color: riskColor[row.risk_result] || '#e2e8f0' }}>
                    {row.risk_result}
                  </td>
                  <td className="py-2">{row.attendance}</td>
                  <td className="py-2">{row.study_hours}</td>
                  <td className="py-2">{row.sleep}</td>
                  <td className="py-2">{row.stress}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );

  const renderHabits = () => (
    <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
      <Panel title="Habit Tracker" description="Create and review the habits that feed the dashboard analytics.">
        <form onSubmit={handleHabitSave} className="space-y-4">
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Habit title</label>
            <input
              value={habitForm.title}
              onChange={(event) => setHabitForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="Example: 2-hour study block"
              className="w-full rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-cyan-400"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Status</label>
            <select
              value={habitForm.status}
              onChange={(event) => setHabitForm((current) => ({ ...current, status: event.target.value }))}
              className="w-full rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-400"
            >
              {habitStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={savingHabit}
            className="inline-flex items-center gap-2 rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <PlusCircle className="h-4 w-4" />
            {savingHabit ? 'Saving...' : 'Add Habit'}
          </button>
        </form>

        <div className="mt-6">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Recent habits</p>
          <CardList
            items={dashboardData.habits}
            emptyText="No habits logged yet. Add one to start syncing study patterns."
            renderItem={(habit) => (
              <div key={habit.id} className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-white">{habit.title}</p>
                    <p className="text-xs text-slate-400">{formatDateTime(habit.date)}</p>
                  </div>
                  <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-cyan-200">
                    {habit.status}
                  </span>
                </div>
              </div>
            )}
          />
        </div>
      </Panel>

      <div className="space-y-5">
        <Panel title="Weekly Schedule" description="Suggested study hours are based on the latest risk state.">
          <div className="space-y-3">
            {dashboardData.weekly_schedule.map((item) => (
              <div key={item.day_of_week} className="flex items-center justify-between rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-sm">
                <span className="font-semibold text-white">{item.day_of_week}</span>
                <span className="text-cyan-300">{item.suggested_study_hours} hours</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );

  const renderNotifications = () => (
    <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
      <Panel title="Notifications" description="Warnings and reminders derived from the latest prediction state.">
        <CardList
          items={dashboardData.notifications}
          emptyText="No alerts right now. Your latest prediction does not require an intervention."
          renderItem={(notification, index) => (
            <div
              key={`${notification.title}-${index}`}
              className={`rounded-2xl border p-4 ${
                notification.severity === 'high'
                  ? 'border-rose-500/30 bg-rose-500/10'
                  : 'border-amber-500/30 bg-amber-500/10'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-white">{notification.title}</p>
                  <p className="mt-1 text-sm text-slate-200">{notification.detail}</p>
                </div>
                <Bell className={`h-5 w-5 ${notification.severity === 'high' ? 'text-rose-300' : 'text-amber-300'}`} />
              </div>
            </div>
          )}
        />

        <div className="mt-6">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Recent activity</p>
          <CardList
            items={dashboardData.history.slice(0, 3)}
            emptyText="No prediction history yet."
            renderItem={(row) => (
              <div key={row.id} className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-white">{row.risk_result} risk</p>
                    <p className="text-xs text-slate-400">{formatDateTime(row.date)}</p>
                  </div>
                  <span className="text-xs font-bold text-cyan-200">{row.attendance}% attendance</span>
                </div>
              </div>
            )}
          />
        </div>
      </Panel>

      <div className="space-y-5">
        <Panel title="Notification Health" description="A quick snapshot of the data that powers your alerts.">
          <div className="grid gap-3 sm:grid-cols-2">
            <MetricCard label="Alerts" value={`${dashboardData.notifications.length}`} subtext="Active alerts" icon={Bell} />
            <MetricCard label="Latest Risk" value={dashboardData.risk} subtext="Current dashboard risk" icon={TriangleAlert} accent="text-white" />
          </div>
        </Panel>
      </div>
    </div>
  );

  const renderProfile = () => (
    <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
      <Panel title="Student Profile" description="Keep the student record accurate so the dashboard can display it correctly.">
        <form onSubmit={saveProfile} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Full name</label>
              <input
                value={profileForm.full_name}
                onChange={(event) => setProfileForm((current) => ({ ...current, full_name: event.target.value }))}
                className="w-full rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-400"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Student ID</label>
              <input
                value={profileForm.student_id}
                onChange={(event) => setProfileForm((current) => ({ ...current, student_id: event.target.value }))}
                className="w-full rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-400"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Department</label>
              <input
                value={profileForm.department}
                onChange={(event) => setProfileForm((current) => ({ ...current, department: event.target.value }))}
                className="w-full rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-400"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Target CGPA</label>
              <input
                value={profileForm.target_cgpa}
                onChange={(event) => setProfileForm((current) => ({ ...current, target_cgpa: event.target.value }))}
                type="number"
                step="0.01"
                min="0"
                max="4"
                className="w-full rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-400"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Profile picture URL</label>
            <input
              value={profileForm.profile_picture}
              onChange={(event) => setProfileForm((current) => ({ ...current, profile_picture: event.target.value }))}
              placeholder="Optional image URL"
              className="w-full rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-400"
            />
            <p className="mt-2 text-xs text-slate-400">
              {autoSavingProfilePicture ? 'Saving profile picture...' : profilePictureDirty ? 'Profile picture will auto-save...' : 'Profile picture is synced.'}
            </p>
          </div>

          <button
            type="submit"
            disabled={savingProfile}
            className="inline-flex items-center gap-2 rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <UserCircle2 className="h-4 w-4" />
            {savingProfile ? 'Saving...' : 'Save Profile'}
          </button>
        </form>
      </Panel>

      <div className="space-y-5">
        <ProfileSummary profile={profile} historyCount={dashboardData.history.length} />
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
      <Panel title="Settings" description="Control the dashboard theme, refresh behavior, and data sync status.">
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-4">
            <div>
              <p className="font-bold text-white">Theme</p>
              <p className="text-sm text-slate-400">Switch between dark and light presentation</p>
            </div>
            <button
              type="button"
              onClick={handleThemeToggle}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-sm font-bold text-slate-100 transition hover:bg-slate-700"
            >
              {isDarkTheme ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {isDarkTheme ? 'Light mode' : 'Dark mode'}
            </button>
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-4">
            <div>
              <p className="font-bold text-white">Auto sync</p>
              <p className="text-sm text-slate-400">Refreshes while the tab is active and when websocket events arrive</p>
            </div>
            <button
              type="button"
              onClick={() => loadDashboard(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-cyan-400"
            >
              <RefreshCw className="h-4 w-4" />
              Sync now
            </button>
          </div>

          <div className="rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-4">
            <p className="font-bold text-white">Last sync</p>
            <p className="mt-1 text-sm text-slate-400">{lastSyncedAt ? new Date(lastSyncedAt).toLocaleString() : 'Not synced yet'}</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link to="/predict" className="rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-400">
              Open Prediction Form
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm font-black text-rose-300 transition hover:bg-rose-500/20"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </div>
      </Panel>

      <div className="space-y-5">
        <Panel title="System Snapshot" description="A compact look at the live backend state.">
          <div className="grid gap-3 sm:grid-cols-2">
            <MetricCard label="Server" value={dashboardData.server_status} subtext="Backend API state" icon={BrainCircuit} accent="text-emerald-300" />
            <MetricCard label="Notifications" value={`${dashboardData.notifications.length}`} subtext="Current alerts" icon={Bell} />
          </div>
        </Panel>
      </div>
    </div>
  );

  const renderSection = () => {
    switch (activeSection) {
      case 'predictions':
        return renderPredictions();
      case 'habits':
        return renderHabits();
      case 'notifications':
        return renderNotifications();
      case 'profile':
        return renderProfile();
      case 'settings':
        return renderSettings();
      case 'dashboard':
      default:
        return renderOverview();
    }
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-linear-to-b from-[#050814] via-[#0a1020] to-[#050814] text-slate-200">
        <div className="grid lg:grid-cols-[17rem_1fr]">
          <aside className="hidden min-h-screen flex-col border-r border-slate-800 bg-slate-950/70 p-4 lg:flex lg:sticky lg:top-0">
            <div className="flex items-center gap-2 px-2 py-3">
              <BrainCircuit className="h-7 w-7 text-cyan-400" />
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">EduPredict</p>
                <p className="font-black text-white">Student view</p>
              </div>
            </div>

            <nav className="mt-4 space-y-1">
              {sidebarLinks.map((link) => (
                link.id === 'notifications' ? (
                  <Link
                    key={link.id}
                    to="/notifications"
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-bold text-slate-300 transition-colors hover:bg-slate-800"
                  >
                    <span>{link.label}</span>
                    {unreadCount > 0 ? <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 text-[10px] font-black text-cyan-200">{unreadCount}</span> : null}
                  </Link>
                ) : (
                  <button
                    key={link.id}
                    type="button"
                    onClick={() => setActiveSection(link.id)}
                    className={`w-full rounded-xl px-3 py-2.5 text-left text-sm font-bold transition-colors ${
                      activeSection === link.id ? 'bg-cyan-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {link.label}
                  </button>
                )
              ))}
            </nav>

            <button
              type="button"
              onClick={handleLogout}
              className="mt-auto flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm font-bold text-rose-300 hover:bg-rose-500/20"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </aside>

          <main className="min-w-0 p-4 sm:p-6 lg:p-7 space-y-5">
            <header className="rounded-3xl border border-slate-700/50 bg-slate-900/75 p-4 backdrop-blur-xl shadow-[0_18px_60px_rgba(2,6,23,0.45)]">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-300">
                    <BrainCircuit className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Student Dashboard</p>
                    <h1 className="text-xl font-black text-white sm:text-2xl">{studentName}</h1>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      refreshing
                        ? 'bg-amber-500/15 text-amber-300'
                        : isConnected
                        ? 'bg-emerald-500/15 text-emerald-300'
                        : 'bg-slate-700/50 text-slate-300'
                    }`}
                  >
                    {refreshing ? 'Syncing...' : isConnected ? 'Live sync on' : 'Live sync offline'}
                  </span>
                  <button
                    type="button"
                    onClick={() => loadDashboard(true)}
                    className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-slate-200 transition hover:bg-slate-700"
                    aria-label="Refresh dashboard"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                  <Link
                    to="/study-planner"
                    className="rounded-xl border border-fuchsia-500/40 bg-fuchsia-500/10 px-3 py-2 text-xs font-black text-fuchsia-200 transition hover:bg-fuchsia-500/20"
                  >
                    Study Planner
                  </Link>
                  <Link
                    to="/task-tracker"
                    className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-black text-emerald-200 transition hover:bg-emerald-500/20"
                  >
                    Task Tracker
                  </Link>
                  <Link
                    to="/focus-mode"
                    className="rounded-xl border border-violet-500/40 bg-violet-500/10 px-3 py-2 text-xs font-black text-violet-200 transition hover:bg-violet-500/20"
                  >
                    Focus Mode
                  </Link>
                  <Link
                    to="/reminders"
                    className="rounded-xl border border-lime-500/40 bg-lime-500/10 px-3 py-2 text-xs font-black text-lime-200 transition hover:bg-lime-500/20"
                  >
                    Reminders
                  </Link>
                  <Link
                    to="/predict"
                    className="rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-black text-slate-950 transition hover:bg-cyan-400"
                  >
                    Start Prediction
                  </Link>
                </div>
              </div>
            </header>

            {renderSection()}
          </main>
        </div>

        <Suspense fallback={null}>
          <LiveChatWidget userId={userId} />
        </Suspense>
      </div>
    </PageTransition>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
} from 'recharts';
import {
  AlertTriangle,
  Users,
  TrendingUp,
  Activity,
  LogOut,
  Search,
  Filter,
  Download,
  Eye,
  MessageSquare,
  BarChart3,
  PieChart as PieChartIcon,
} from 'lucide-react';
import useSocket from '../hooks/useSocket';
import { WS_BASE_URL, fetchAdminStudents, fetchAdminStudentDashboard } from '../utils/api';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [authError, setAuthError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const adminEmails = (import.meta.env.VITE_ADMIN_EMAILS || 'admin@edupredict.ai')
    .split(',')
    .map((email) => email.trim())
    .filter(Boolean);
  const [studentDetailsLoading, setStudentDetailsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRisk, setFilterRisk] = useState('All');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedStudentDashboard, setSelectedStudentDashboard] = useState(null);
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [modalTab, setModalTab] = useState('overview');

  const parseDate = useCallback((value) => {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed : null;
  }, []);

  const mapAssignmentStatusScore = useCallback((status) => {
    if (!status || typeof status !== 'string') return 0;
    switch (status.toLowerCase()) {
      case 'completed':
        return 100;
      case 'on_track':
        return 85;
      case 'pending':
        return 65;
      case 'at_risk':
        return 40;
      case 'behind':
        return 20;
      default:
        return 0;
    }
  }, []);

  const asNumber = useCallback((value) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  }, []);

  const dashboardAnalytics = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const activeThreshold = new Date(todayStart);
    activeThreshold.setDate(activeThreshold.getDate() - 7);

    const statusCounts = {
      completed: 0,
      on_track: 0,
      pending: 0,
      at_risk: 0,
      behind: 0,
      unknown: 0,
    };

    const riskDistribution = { Low: 0, Medium: 0, High: 0 };
    let totalStudyHours = 0;
    let totalSleepHours = 0;
    let totalStress = 0;
    let totalLoggedInStudents = 0;
    let completionScoreSum = 0;
    let statusScoreCount = 0;
    const recentActivity = [];

    let loggedInToday = 0;
    let previouslyLoggedInStudents = 0;
    let activeStudents = 0;

    students.forEach((student) => {
      const latest = student.latestPrediction;
      const latestDate = parseDate(latest?.created_at);

      if (latest && latestDate) {
        totalLoggedInStudents += 1;
        totalStudyHours += latest.study_hours || 0;
        totalSleepHours += latest.sleep || 0;
        totalStress += latest.stress || 0;

        if (latestDate >= todayStart) {
          loggedInToday += 1;
        } else {
          previouslyLoggedInStudents += 1;
        }

        if (latestDate >= activeThreshold) {
          activeStudents += 1;
        }
      }

      if (latest?.risk_result) {
        riskDistribution[latest.risk_result] = (riskDistribution[latest.risk_result] || 0) + 1;
      }

      const latestPrediction = student.predictions?.[0];
      const status = latestPrediction?.assignment_status || 'unknown';
      const normalizedStatus = statusCounts[status] !== undefined ? status : 'unknown';
      statusCounts[normalizedStatus] += 1;

      const statusScore = mapAssignmentStatusScore(status);
      if (statusScore > 0) {
        completionScoreSum += statusScore;
        statusScoreCount += 1;
      }

      const studentActivities = Array.isArray(student.predictions) ? student.predictions : [];
      studentActivities.slice(0, 5).forEach((activity) => {
        recentActivity.push({
          ...activity,
          studentName: student.full_name,
          date: parseDate(activity.created_at),
        });
      });
    });

    const recentActivitySorted = recentActivity
      .filter((item) => item.date)
      .sort((a, b) => b.date - a.date)
      .slice(0, 10);

    const performanceData = students
      .filter((student) => student.latestPrediction)
      .map((student) => ({
        name: student.full_name.split(' ')[0],
        studyHours: Number(asNumber(student.latestPrediction.study_hours).toFixed(1)),
        sleep: Number(asNumber(student.latestPrediction.sleep).toFixed(1)),
        stress: Number(asNumber(student.latestPrediction.stress).toFixed(1)),
      }));

    const stressData = performanceData.map((item) => ({
      name: item.name,
      studyHours: item.studyHours,
      stress: item.stress,
    }));

    const completionPercent = statusScoreCount ? Math.round((completionScoreSum / statusScoreCount) * 10) / 10 : 0;

    return {
      totalStudents: students.length,
      totalLoggedInStudents,
      studentsLoggedInToday: loggedInToday,
      previouslyLoggedInStudents,
      activeStudents,
      inactiveStudents: Math.max(0, students.length - activeStudents),
      averageStudyHours: totalLoggedInStudents ? Math.round((totalStudyHours / totalLoggedInStudents) * 10) / 10 : 0,
      averageSleepHours: totalLoggedInStudents ? Math.round((totalSleepHours / totalLoggedInStudents) * 10) / 10 : 0,
      averageStress: totalLoggedInStudents ? Math.round((totalStress / totalLoggedInStudents) * 10) / 10 : 0,
      completionPercent,
      statusCounts,
      riskDistribution,
      performanceData,
      stressData,
      recentActivity: recentActivitySorted,
      workCompletionData: Object.entries(statusCounts).map(([key, value]) => ({
        label:
          key === 'completed'
            ? 'Completed'
            : key === 'on_track'
            ? 'On Track'
            : key === 'pending'
            ? 'Pending'
            : key === 'at_risk'
            ? 'At Risk'
            : key === 'behind'
            ? 'Behind'
            : 'Unknown',
        value,
      })),
    };
  }, [students, mapAssignmentStatusScore, parseDate]);

  const fetchAdminData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setAuthError(null);

    try {
      const studentsRes = await fetchAdminStudents();
      const studentsList = Array.isArray(studentsRes?.data) ? studentsRes.data : [];
      setStudents(studentsList);
      setLastUpdated(new Date());
    } catch (fetchError) {
      console.error('Error fetching admin students:', fetchError);
      setStudents([]);
      const status = fetchError?.response?.status;
      if (status === 401) {
        setAuthError('Unauthorized. Please log in again with a valid admin account.');
        setError(new Error('Unauthorized access.'));
      } else if (status === 403) {
        setAuthError('Admin privileges required. Please use an admin account.');
        setError(new Error('Admin access forbidden.'));
      } else {
        setError(fetchError);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdminData();
  }, [fetchAdminData]);

  const handleWebSocketMessage = useCallback((message) => {
    console.log('Admin received websocket message:', message?.type);
    if (message?.type && message.type !== 'pong') {
      console.log('Triggering admin data refresh from websocket event:', message.type);
      fetchAdminData();
    }
  }, [fetchAdminData]);

  const { isConnected: adminWsConnected } = useSocket(`${WS_BASE_URL}/ws/dashboard`, {
    enabled: true,
    onMessage: handleWebSocketMessage,
  });

  useEffect(() => {
    if (adminWsConnected) return undefined;
    const intervalId = window.setInterval(fetchAdminData, 30000);
    return () => window.clearInterval(intervalId);
  }, [adminWsConnected, fetchAdminData]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/');
  };

  const handleViewStudent = async (student) => {
    setSelectedStudent(student);
    setSelectedStudentDashboard(null);
    setShowStudentModal(true);
    setStudentDetailsLoading(true);

    try {
      const dashboardRes = await fetchAdminStudentDashboard(student.user_id);
      setSelectedStudentDashboard(dashboardRes.data);
    } catch (error) {
      console.error('Error fetching student dashboard:', error);
      setSelectedStudentDashboard(null);
    } finally {
      setStudentDetailsLoading(false);
    }
  };

  const filteredStudents = students.filter((student) => {
    const matchSearch =
      student.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchRisk = filterRisk === 'All' || student.latestPrediction?.risk_result === filterRisk;
    return matchSearch && matchRisk;
  });

  const riskChartData = [
    { name: 'Low Risk', value: dashboardAnalytics.riskDistribution.Low || 0, color: '#22c55e' },
    { name: 'Medium Risk', value: dashboardAnalytics.riskDistribution.Medium || 0, color: '#f59e0b' },
    { name: 'High Risk', value: dashboardAnalytics.riskDistribution.High || 0, color: '#ef4444' },
  ];

  const performanceChartData = dashboardAnalytics.performanceData || [];
  const stressChartData = dashboardAnalytics.stressData || [];
  const workCompletionChartData = dashboardAnalytics.workCompletionData || [];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060914] flex items-center justify-center">
        <div className="text-cyan-400 flex items-center gap-3">
          <span className="h-4 w-4 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
          Loading Admin Dashboard...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060914] text-slate-200">
      {/* Header */}
      <header className="border-b border-slate-700 bg-slate-900/40 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-8 h-8 text-cyan-400" />
              <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
            </div>
            <div
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                adminWsConnected ? 'bg-emerald-500/10 text-emerald-300' : 'bg-orange-500/10 text-orange-300'
              }`}
            >
              Realtime {adminWsConnected ? 'connected' : 'offline'}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 rounded-3xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
            Unable to load student analytics. {error?.message || 'Please refresh or try again later.'}
          </div>
        )}

        {authError && (
          <div className="mb-6 rounded-3xl border border-orange-400/20 bg-orange-400/10 p-4 text-sm text-orange-200">
            <div className="mb-3 font-semibold">Admin access error</div>
            <p>{authError}</p>
            <div className="text-slate-300 text-sm">
              Use an admin login such as: <span className="font-mono text-slate-100">{adminEmails.join(', ')}</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={() => {
                  localStorage.removeItem('token');
                  navigate('/login');
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-orange-500/20 px-4 py-2 text-sm text-orange-200 hover:bg-orange-500/30 transition-colors"
              >
                Re-login as admin
              </button>
              <button
                onClick={fetchAdminData}
                className="inline-flex items-center gap-2 rounded-lg bg-cyan-500/20 px-4 py-2 text-sm text-cyan-300 hover:bg-cyan-500/30 transition-colors"
              >
                Retry fetch
              </button>
            </div>
          </div>
        )}

        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-slate-400">
            Last refreshed: {lastUpdated ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(lastUpdated) : 'Loading...'}
          </div>
          <button
            onClick={fetchAdminData}
            className="inline-flex items-center justify-center rounded-lg bg-cyan-500/20 px-4 py-2 text-sm text-cyan-300 hover:bg-cyan-500/30 transition-colors"
          >
            Refresh analytics
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Total Students</p>
                <p className="text-3xl font-bold text-white mt-2">{dashboardAnalytics.totalStudents}</p>
              </div>
              <Users className="w-12 h-12 text-blue-400/50" />
            </div>
          </div>

          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Total Logged In Students</p>
                <p className="text-3xl font-bold text-white mt-2">{dashboardAnalytics.totalLoggedInStudents}</p>
              </div>
              <Activity className="w-12 h-12 text-green-400/50" />
            </div>
          </div>

          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Students Logged In Today</p>
                <p className="text-3xl font-bold text-white mt-2">{dashboardAnalytics.studentsLoggedInToday}</p>
              </div>
              <TrendingUp className="w-12 h-12 text-cyan-400/50" />
            </div>
          </div>

          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Previously Logged In</p>
                <p className="text-3xl font-bold text-white mt-2">{dashboardAnalytics.previouslyLoggedInStudents}</p>
              </div>
              <AlertTriangle className="w-12 h-12 text-orange-400/50" />
            </div>
          </div>

          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Active Students</p>
                <p className="text-3xl font-bold text-white mt-2">{dashboardAnalytics.activeStudents}</p>
              </div>
              <BarChart3 className="w-12 h-12 text-teal-400/50" />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-8 border-b border-slate-700">
          {['overview', 'students', 'analytics'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 font-medium transition-colors capitalize ${
                activeTab === tab
                  ? 'text-cyan-400 border-b-2 border-cyan-400'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
                <h2 className="text-xl font-bold text-white mb-4">Login Analytics</h2>
                <div className="grid gap-3">
                  <div className="rounded-2xl bg-slate-900/60 p-4">
                    <p className="text-sm text-slate-400">Active students in last 7 days</p>
                    <p className="mt-2 text-2xl font-bold text-white">{dashboardAnalytics.activeStudents}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-900/60 p-4">
                    <p className="text-sm text-slate-400">Logged in today</p>
                    <p className="mt-2 text-2xl font-bold text-white">{dashboardAnalytics.studentsLoggedInToday}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-900/60 p-4">
                    <p className="text-sm text-slate-400">Previously logged in</p>
                    <p className="mt-2 text-2xl font-bold text-white">{dashboardAnalytics.previouslyLoggedInStudents}</p>
                  </div>
                </div>
              </div>

              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
                <h2 className="text-xl font-bold text-white mb-4">Student Project Progress</h2>
                <div className="mb-4 rounded-full bg-slate-700/70 h-3 overflow-hidden">
                  <div
                    className="h-full bg-cyan-400"
                    style={{ width: `${dashboardAnalytics.completionPercent}%` }}
                  />
                </div>
                <p className="text-sm text-slate-400">Average completion</p>
                <p className="text-3xl font-bold text-white mt-2">{dashboardAnalytics.completionPercent}%</p>
                <div className="mt-6 space-y-3">
                  {dashboardAnalytics.workCompletionData.map((entry) => (
                    <div key={entry.label} className="flex items-center justify-between text-sm text-slate-300">
                      <span>{entry.label}</span>
                      <span className="font-semibold text-white">{entry.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
                <h2 className="text-xl font-bold text-white mb-4">Performance Summary</h2>
                <div className="grid gap-4">
                  <div className="rounded-2xl bg-slate-900/60 p-4">
                    <p className="text-sm text-slate-400">Average Study Hours</p>
                    <p className="mt-2 text-2xl font-bold text-white">{dashboardAnalytics.averageStudyHours}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-900/60 p-4">
                    <p className="text-sm text-slate-400">Average Sleep Hours</p>
                    <p className="mt-2 text-2xl font-bold text-white">{dashboardAnalytics.averageSleepHours}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-900/60 p-4">
                    <p className="text-sm text-slate-400">Average Stress Level</p>
                    <p className="mt-2 text-2xl font-bold text-white">{dashboardAnalytics.averageStress}/10</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <PieChartIcon className="w-5 h-5 text-cyan-400" />
                  Risk Distribution
                </h2>
                {riskChartData.some((d) => d.value > 0) ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={riskChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={(entry) => `${entry.name}: ${entry.value}`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {riskChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-slate-400 text-center py-8">No risk data available</p>
                )}
              </div>

              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
                <h2 className="text-xl font-bold text-white mb-4">Study Hours vs Stress</h2>
                {stressChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="studyHours" stroke="#9ca3af" />
                      <YAxis dataKey="stress" stroke="#9ca3af" />
                      <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} />
                      <Scatter name="Students" data={stressChartData} fill="#06b6d4" />
                    </ScatterChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-slate-400 text-center py-8">No study/stress data available</p>
                )}
              </div>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-white">Recent Student Activity</h2>
                  <p className="text-sm text-slate-400">Latest work and prediction updates across students.</p>
                </div>
                <span className="rounded-full bg-slate-900/60 px-3 py-1 text-xs uppercase tracking-[0.3em] text-slate-400">
                  {dashboardAnalytics.recentActivity.length}
                </span>
              </div>
              {dashboardAnalytics.recentActivity.length > 0 ? (
                <div className="space-y-3">
                  {dashboardAnalytics.recentActivity.slice(0, 8).map((activity, index) => (
                    <div key={`${activity.studentName}-${index}`} className="rounded-2xl bg-slate-900/60 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm text-slate-300">{activity.studentName}</p>
                          <p className="mt-1 text-sm text-slate-400">{activity.assignment_status || activity.risk_result || 'Activity update'}</p>
                        </div>
                        <p className="text-xs text-slate-500">{activity.date ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(activity.date) : 'Unknown'}</p>
                      </div>
                      <p className="mt-2 text-sm text-slate-300">
                        Study: {asNumber(activity.study_hours).toFixed(1)}h · Sleep: {asNumber(activity.sleep).toFixed(1)}h · Stress: {asNumber(activity.stress).toFixed(1)}/10
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400 text-center py-8">No recent student activity available.</p>
              )}
            </div>
          </div>
        )}

        {/* Students Tab */}
        {activeTab === 'students' && (
          <div>
            {/* Search and Filter */}
            <div className="flex gap-4 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search students by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                />
              </div>
              <div className="flex gap-2 items-center">
                <div className="flex items-center gap-2 rounded-lg bg-slate-800 border border-slate-700 px-3">
                  <Filter className="w-4 h-4 text-slate-500" />
                  <select
                    value={filterRisk}
                    onChange={(e) => setFilterRisk(e.target.value)}
                    className="min-w-40 bg-transparent py-2 text-white focus:outline-none"
                  >
                    <option value="All">All Risk Levels</option>
                    <option value="Low">Low Risk</option>
                    <option value="Medium">Medium Risk</option>
                    <option value="High">High Risk</option>
                  </select>
                </div>
                <button className="px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 rounded-lg flex items-center gap-2 transition-colors">
                  <Download className="w-4 h-4" />
                  Export
                </button>
              </div>
            </div>

            {/* Students Table */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-900/50 border-b border-slate-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-300">Student Name</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-300">Email</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-300">Risk Level</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-300">Study Hours</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-300">Sleep Hours</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-300">Stress</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-300">Target CGPA</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-300">Last Updated</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-300">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.length > 0 ? (
                      filteredStudents.map((student) => {
                        const latest = student.latestPrediction;
                        const riskColor = {
                          Low: 'bg-green-500/20 text-green-300',
                          Medium: 'bg-yellow-500/20 text-yellow-300',
                          High: 'bg-red-500/20 text-red-300',
                        };
                        return (
                          <tr key={student.user_id} className="border-b border-slate-700 hover:bg-slate-700/30 transition-colors">
                            <td className="px-6 py-4 text-sm text-white font-medium">{student.full_name}</td>
                            <td className="px-6 py-4 text-sm text-slate-400">{student.email}</td>
                            <td className="px-6 py-4 text-sm">
                              <span className={`px-3 py-1 rounded-full text-xs font-medium ${riskColor[latest?.risk_result] || 'bg-slate-600 text-slate-300'}`}>
                                {latest?.risk_result || 'N/A'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-300">{asNumber(latest?.study_hours).toFixed(1)}h</td>
                            <td className="px-6 py-4 text-sm text-slate-300">{asNumber(latest?.sleep).toFixed(1)}h</td>
                            <td className="px-6 py-4 text-sm text-slate-300">{asNumber(latest?.stress).toFixed(1)}/10</td>
                            <td className="px-6 py-4 text-sm text-slate-300">{student.target_cgpa || 'N/A'}</td>
                            <td className="px-6 py-4 text-sm text-slate-400">
                              {latest ? new Date(latest.created_at).toLocaleDateString() : 'N/A'}
                            </td>
                            <td className="px-6 py-4 text-sm flex gap-2">
                              <button
                                onClick={() => handleViewStudent(student)}
                                className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-cyan-400"
                                title="View Details"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-blue-400"
                                title="Send Message"
                              >
                                <MessageSquare className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="9" className="px-6 py-8 text-center text-slate-400">
                          No students found matching your filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="grid grid-cols-1 gap-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
                <h2 className="text-xl font-bold text-white mb-4">Student Stress Levels</h2>
                {stressChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={stressChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="name" stroke="#9ca3af" />
                      <YAxis stroke="#9ca3af" />
                      <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} />
                      <Legend />
                      <Line type="monotone" dataKey="stress" stroke="#f59e0b" name="Stress Level" isAnimationActive={true} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-slate-400 text-center py-8">No data available</p>
                )}
              </div>

              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
                <h2 className="text-xl font-bold text-white mb-4">Sleep vs Study Hours</h2>
                {performanceChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={performanceChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="name" stroke="#9ca3af" />
                      <YAxis stroke="#9ca3af" />
                      <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} />
                      <Legend />
                      <Line type="monotone" dataKey="sleep" stroke="#10b981" name="Sleep Hours" />
                      <Line type="monotone" dataKey="studyHours" stroke="#06b6d4" name="Study Hours" />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-slate-400 text-center py-8">No data available</p>
                )}
              </div>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
              <h2 className="text-xl font-bold text-white mb-4">Work Completion by Status</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {workCompletionChartData.map((entry) => (
                  <div key={entry.label} className="rounded-2xl bg-slate-900/60 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-sm text-slate-400">{entry.label}</p>
                      <p className="text-lg font-semibold text-white">{entry.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Student Detail Modal */}
      {showStudentModal && selectedStudent && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-slate-900 border-b border-slate-700 px-6 py-4 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-white">{selectedStudent.full_name}</h2>
              <button
                onClick={() => setShowStudentModal(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="flex gap-4 border-b border-slate-700">
                {['overview', 'predictions', 'activities'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setModalTab(tab)}
                    className={`px-4 py-2 font-medium transition-colors capitalize ${
                      modalTab === tab
                        ? 'text-cyan-400 border-b-2 border-cyan-400'
                        : 'text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {modalTab === 'overview' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-slate-400 text-sm">Email</p>
                      <p className="text-white font-medium">{selectedStudent.email}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-sm">User ID</p>
                      <p className="text-white font-medium">{selectedStudent.user_id}</p>
                    </div>
                  </div>

                  {studentDetailsLoading && (
                    <div className="rounded-lg border border-slate-700 bg-slate-900/80 p-6 text-center text-slate-400">
                      Loading student dashboard details...
                    </div>
                  )}

                  {selectedStudentDashboard && !studentDetailsLoading && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-slate-400 text-sm">Target CGPA</p>
                          <p className="text-white font-medium">{selectedStudentDashboard.profile?.target_cgpa ?? 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 text-sm">Current Risk</p>
                          <p className="text-white font-medium">{selectedStudentDashboard.risk || 'N/A'}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-slate-400 text-sm">Study Suggestions</p>
                          <ul className="mt-2 space-y-1 text-sm text-slate-300">
                            {(Array.isArray(selectedStudentDashboard.study_suggestions)
                            ? selectedStudentDashboard.study_suggestions.slice(0, 3)
                            : []).map((item, index) => (
                              <li key={index} className="list-disc list-inside">
                                {item.title}
                              </li>
                            ))}
                            {!selectedStudentDashboard.study_suggestions?.length && <li>No suggestions yet</li>}
                          </ul>
                        </div>
                        <div>
                          <p className="text-slate-400 text-sm">Weekly Schedule</p>
                          <ul className="mt-2 space-y-1 text-sm text-slate-300">
                            {(Array.isArray(selectedStudentDashboard.weekly_schedule)
                            ? selectedStudentDashboard.weekly_schedule.slice(0, 4)
                            : []).map((item, index) => (
                              <li key={index} className="list-disc list-inside">
                                {item.day_of_week}: {item.suggested_study_hours}h
                              </li>
                            ))}
                            {!selectedStudentDashboard.weekly_schedule?.length && <li>No schedule data</li>}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedStudent.latestPrediction && (
                    <div className="bg-slate-700/50 rounded-lg p-4 space-y-3">
                      <h3 className="text-lg font-bold text-white">Latest Prediction</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-slate-400 text-sm">Risk Level</p>
                          <p className="text-white font-medium">{selectedStudent.latestPrediction.risk_result || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 text-sm">Study Hours</p>
                          <p className="text-white font-medium">{asNumber(selectedStudent.latestPrediction?.study_hours).toFixed(1)}h</p>
                        </div>
                        <div>
                          <p className="text-slate-400 text-sm">Sleep</p>
                          <p className="text-white font-medium">{asNumber(selectedStudent.latestPrediction?.sleep).toFixed(1)}h</p>
                        </div>
                        <div>
                          <p className="text-slate-400 text-sm">Stress Level</p>
                          <p className="text-white font-medium">{asNumber(selectedStudent.latestPrediction?.stress).toFixed(1)}/10</p>
                        </div>
                      </div>
                      <p className="text-slate-400 text-sm pt-2">
                        Updated: {new Date(selectedStudent.latestPrediction.created_at).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {modalTab === 'predictions' && (
                <div>
                  <h3 className="text-lg font-bold text-white mb-3">Prediction History</h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {selectedStudent.predictions && selectedStudent.predictions.length > 0 ? (
                      selectedStudent.predictions.map((pred, idx) => (
                        <div
                          key={idx}
                          className="bg-slate-700/50 p-3 rounded text-sm flex justify-between items-center"
                        >
                          <div>
                            <span className="text-cyan-400 font-medium">{new Date(pred.created_at).toLocaleDateString()}</span>
                            <span className="text-slate-400 ml-3">Risk: {pred.risk_result}</span>
                          </div>
                          <span className="text-slate-300">{asNumber(pred.study_hours).toFixed(1)}h study</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-slate-400">No prediction history</p>
                    )}
                  </div>
                </div>
              )}

              {modalTab === 'activities' && (
                <div>
                  <h3 className="text-lg font-bold text-white mb-3">Recent Activities</h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {selectedStudent.predictions && selectedStudent.predictions.length > 0 ? (
                      selectedStudent.predictions.slice(0, 10).map((pred, idx) => (
                        <div
                          key={idx}
                          className="bg-slate-700/50 p-3 rounded text-sm"
                        >
                          <p className="text-cyan-400 font-medium">Prediction Submitted</p>
                          <p className="text-slate-300">Risk: {pred.risk_result} | Study: {asNumber(pred.study_hours).toFixed(1)}h | Sleep: {asNumber(pred.sleep).toFixed(1)}h | Stress: {asNumber(pred.stress).toFixed(1)}/10</p>
                          <p className="text-slate-400 text-xs">{new Date(pred.created_at).toLocaleString()}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-slate-400">No recent activities</p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-slate-700">
                <button className="flex-1 px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 rounded-lg transition-colors">
                  Send Message
                </button>
                <button className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors">
                  Export Report
                </button>
                <button
                  onClick={() => setShowStudentModal(false)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

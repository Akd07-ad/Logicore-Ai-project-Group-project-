import React, { Suspense, lazy, useMemo } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ProfileProvider } from './context/ProfileContext';
import { NotificationProvider } from './context/NotificationContext';
import ToastContainer from './components/ToastContainer';
import ProtectedRoute from './components/ProtectedRoute';

const LandingPage = lazy(() => import('./pages/LandingPage'));
const AuthPage = lazy(() => import('./pages/AuthPage'));
const AdminAuthPage = lazy(() => import('./pages/AdminAuthPage'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const PredictionForm = lazy(() => import('./pages/PredictionForm'));
const StudyPlanner = lazy(() => import('./pages/StudyPlanner'));
const TaskTracker = lazy(() => import('./pages/TaskTracker'));
const FocusMode = lazy(() => import('./pages/FocusMode'));
const ReminderCenter = lazy(() => import('./pages/ReminderCenter'));
const ReminderDashboardPage = lazy(() => import('./pages/ReminderDashboardPage'));
const AIInsightsDashboard = lazy(() => import('./pages/AIInsightsDashboard'));
const StudentRiskPanel = lazy(() => import('./pages/StudentRiskPanel'));
const RevisionPlanner = lazy(() => import('./pages/RevisionPlanner'));
const AnalyticsDashboardPage = lazy(() => import('./pages/AnalyticsDashboardPage'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const Notifications = lazy(() => import('./pages/Notifications'));

// Init dark mode from localStorage on first load
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'dark') {
  document.documentElement.classList.add('dark');
} else {
  document.documentElement.classList.remove('dark');
}

function App() {
  const userId = useMemo(() => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return null;
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.sub || payload.user_id;
    } catch {
      return null;
    }
  }, []);

  return (
    <BrowserRouter>
      <ProfileProvider>
        <NotificationProvider userId={userId}>
          <ToastContainer />
          <Suspense fallback={<div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center">Loading...</div>}>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<AuthPage />} />
              <Route path="/admin-auth" element={<AdminAuthPage />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/predict" element={<PredictionForm />} />
              <Route path="/study-planner" element={<StudyPlanner />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/task-tracker" element={<TaskTracker />} />
              <Route path="/focus-mode" element={<FocusMode />} />
              <Route path="/reminders" element={<ReminderCenter />} />
              <Route path="/live-dashboard" element={<ReminderDashboardPage />} />
              <Route path="/reminder-dashboard" element={<ReminderDashboardPage />} />
              <Route path="/ai-insights" element={<AIInsightsDashboard />} />
              <Route path="/risk-panel" element={<StudentRiskPanel />} />
              <Route path="/revision-planner" element={<RevisionPlanner />} />
              <Route path="/analytics-dashboard" element={<AnalyticsDashboardPage />} />
              <Route path="/admin" element={<ProtectedRoute element={<AdminDashboard />} requiredRole="admin" />} />
              <Route path="*" element={<LandingPage />} />
            </Routes>
          </Suspense>
        </NotificationProvider>
      </ProfileProvider>
    </BrowserRouter>
  );
}

export default App;

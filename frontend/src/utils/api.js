import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
export const WS_BASE_URL = API_URL.replace('http://', 'ws://').replace('https://', 'wss://');

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  try {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  } catch (error) {
    return Promise.reject(error);
  }
});

const withApiSafety = async (requestFn) => {
  try {
    return await requestFn();
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
};

export const registerUser = (payload) => withApiSafety(() => api.post('/auth/register', payload));
export const loginUser = (payload) => withApiSafety(() => api.post('/auth/login', payload));
export const submitPrediction = (payload) => withApiSafety(() => api.post('/save-prediction', payload));
export const fetchHistory = () => withApiSafety(() => api.get('/get-history'));
export const fetchHistoryByUser = (userId) => withApiSafety(() => api.get(`/history/${userId}`));
export const fetchAdminStudents = () => withApiSafety(() => api.get('/admin/students'));
export const fetchAdminStudentDashboard = (userId) => withApiSafety(() => api.get(`/admin/student-dashboard/${encodeURIComponent(userId)}`));
export const fetchProfile = () => withApiSafety(() => api.get('/get-profile'));
export const updateProfile = (payload) => withApiSafety(() => api.put('/update-profile', payload));
export const fetchSuggestions = () => withApiSafety(() => api.get('/ai-suggestions'));
export const fetchStudySuggestions = () => withApiSafety(() => api.get('/study-suggestions'));
export const fetchHabits = () => withApiSafety(() => api.get('/habits'));
export const createHabitLog = (payload) => withApiSafety(() => api.post('/habits/log', payload));
export const fetchChatLogs = () => withApiSafety(() => api.get('/chat/logs'));
export const fetchAdvancedAnalytics = () => withApiSafety(() => api.get('/analytics/advanced'));
export const fetchResources = () => withApiSafety(() => api.get('/resources'));
export const fetchNotifications = () => withApiSafety(() => api.get('/notifications'));
export const fetchWeeklySchedule = (persist = false) => withApiSafety(() => api.get(`/schedule/weekly?persist=${persist}`));
export const fetchMoodLogs = () => withApiSafety(() => api.get('/mood/logs'));
export const createMoodLog = (payload) => withApiSafety(() => api.post('/mood/log', payload));
export const fetchModelAccuracy = () => withApiSafety(() => api.get('/model/accuracy'));
export const fetchHealth = () => withApiSafety(() => api.get('/health'));
export const importStudentDataset = (filePath = 'ml_logic/bd_students_5000.csv') =>
  withApiSafety(() => api.post(`/dataset/import?file_path=${encodeURIComponent(filePath)}`));
export const fetchDashboardData = () =>
  withApiSafety(async () => {
    return api.get('/get-dashboard-data', {
      timeout: 10000,
    });
  });

// New ML and analytics APIs.
export const predictPerformance = (payload) => withApiSafety(() => api.post('/predict/performance', payload));
export const predictTrend = (payload) => withApiSafety(() => api.post('/predict/trend', payload));
export const clusterStudent = (studentId) => withApiSafety(() => api.post(`/cluster?student_id=${encodeURIComponent(studentId)}`));
export const runRiskAnalysis = (payload) => withApiSafety(() => api.post('/risk-analysis', payload));
export const fetchWeakSubjects = (studentId) => withApiSafety(() => api.get(`/analysis/weak-subjects/${encodeURIComponent(studentId)}`));
export const fetchBehaviorAnalysis = (studentId) => withApiSafety(() => api.get(`/analysis/behavior/${encodeURIComponent(studentId)}`));
export const fetchPerformanceTrend = (studentId) => withApiSafety(() => api.get(`/analysis/performance-trend/${encodeURIComponent(studentId)}`));
export const createRevisionPlan = (payload) => withApiSafety(() => api.post('/revision/plan', payload));
export const submitRevisionFeedback = (revisionId, payload) =>
  withApiSafety(() => api.post(`/revision/feedback/${revisionId}`, payload));
export const fetchAnalyticsDashboard = (studentId) =>
  withApiSafety(() => api.get(`/analytics/dashboard/${encodeURIComponent(studentId)}`));

// Study planner and adaptive learning APIs.
export const generateSmartPlan = (payload) => withApiSafety(() => api.post('/planner/generate', payload));
export const adaptStudyPlan = (planId) => withApiSafety(() => api.post(`/planner/adapt/${planId}`));
export const createStudyPlan = (payload) => withApiSafety(() => api.post('/study-plans', payload));
export const fetchStudyPlans = () => withApiSafety(() => api.get('/study-plans'));
export const updateStudyPlan = (planId, payload) => withApiSafety(() => api.put(`/study-plans/${planId}`, payload));
export const deleteStudyPlan = (planId) => withApiSafety(() => api.delete(`/study-plans/${planId}`));
export const autoGenerateSchedule = (planId) => withApiSafety(() => api.post(`/schedules/auto-generate?plan_id=${planId}`));

// Schedule and task tracking APIs.
export const fetchSchedules = (planId) =>
  withApiSafety(() => (planId ? api.get(`/schedules?plan_id=${planId}`) : api.get('/schedules')));
export const createSchedule = (payload) => withApiSafety(() => api.post('/schedules', payload));
export const updateSchedule = (scheduleId, payload) => withApiSafety(() => api.put(`/schedules/${scheduleId}`, payload));
export const deleteSchedule = (scheduleId) => withApiSafety(() => api.delete(`/schedules/${scheduleId}`));

export const fetchTasks = (status) =>
  withApiSafety(() => (status ? api.get(`/tasks?status=${encodeURIComponent(status)}`) : api.get('/tasks')));
export const createTask = (payload) => withApiSafety(() => api.post('/tasks', payload));
export const updateTask = (taskId, payload) => withApiSafety(() => api.put(`/tasks/${taskId}`, payload));
export const deleteTask = (taskId) => withApiSafety(() => api.delete(`/tasks/${taskId}`));

// Progress and focus activity APIs.
export const fetchProgressEntries = () => withApiSafety(() => api.get('/progress-tracking'));
export const createProgressEntry = (payload) => withApiSafety(() => api.post('/progress-tracking', payload));
export const fetchProgressSummary = () => withApiSafety(() => api.get('/progress/summary'));
export const createActivityLog = (payload) => withApiSafety(() => api.post('/activity-logs', payload));
export const fetchActivityLogs = () => withApiSafety(() => api.get('/activity-logs'));

// Reminder APIs.
export const createReminder = (payload) => withApiSafety(() => api.post('/reminders', payload));
export const fetchReminders = () => withApiSafety(() => api.get('/reminders'));
export const fetchDueReminders = (withinMinutes = 60) =>
  withApiSafety(() => api.get(`/reminders/due?within_minutes=${withinMinutes}`));
export const updateReminder = (reminderId, payload) => withApiSafety(() => api.put(`/reminders/${reminderId}`, payload));
export const deleteReminder = (reminderId) => withApiSafety(() => api.delete(`/reminders/${reminderId}`));

// Notification APIs.

export const markNotificationRead = (notificationId) => withApiSafety(() => api.post(`/notifications/${notificationId}/read`));
export const markAllNotificationsRead = () => withApiSafety(() => api.post('/notifications/read-all'));
export const getUnreadNotificationCount = () => withApiSafety(() => api.get('/notifications/unread-count'));
export const notifyStudyPlanReady = (planId) => withApiSafety(() => api.post(`/notifications/study-plan-ready/${planId}`));

export const exportHistoryCsv = () => withApiSafety(() => api.get('/history/export/csv', { responseType: 'blob' }));
export const exportHistoryPdf = () => withApiSafety(() => api.get('/history/export/pdf', { responseType: 'blob' }));

export default api;

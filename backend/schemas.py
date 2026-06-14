from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from typing import Literal


class UserBase(BaseModel):
    email: str


class UserCreate(UserBase):
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class User(UserBase):
    id: int

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str
    user_id: int


class TokenData(BaseModel):
    user_id: Optional[int] = None


class PredictionRequest(BaseModel):
    attendance: float
    study_hours: float
    sleep: float
    stress: int
    social_media_usage: Optional[float] = 0.0
    assignment_status: str = "on_track"


class PredictionResponse(BaseModel):
    risk_result: str
    confidence_score: Optional[float] = None
    prediction_id: Optional[int] = None
    cgpa_forecast: Optional[float] = None
    dropout_risk: Optional[str] = None
    weak_subjects: list[str] = []


class PredictionHistory(BaseModel):
    id: int
    user_id: int
    attendance: float
    study_hours: float
    sleep: float
    social_media_usage: float
    stress: int
    assignment_status: str
    risk_result: str
    confidence_score: Optional[float] = None
    cgpa_forecast: Optional[float] = None
    dropout_risk: Optional[str] = None
    weak_subjects: Optional[str] = None
    date: datetime

    class Config:
        from_attributes = True


class UserProfileBase(BaseModel):
    full_name: str = ""
    student_id: str = ""
    department: str = ""
    target_cgpa: Optional[float] = None
    profile_picture: str = ""


class UserProfileUpdate(UserProfileBase):
    pass


class UserProfileResponse(UserProfileBase):
    user_id: int

    class Config:
        from_attributes = True


class HabitCreate(BaseModel):
    title: str
    status: str = "pending"


class HabitResponse(BaseModel):
    id: int
    user_id: int
    title: str
    status: str
    date: datetime

    class Config:
        from_attributes = True


class SuggestionItem(BaseModel):
    title: str
    description: str


class ChatLogResponse(BaseModel):
    id: int
    user_id: int
    role: str
    message: str
    created_at: datetime

    class Config:
        from_attributes = True


class PeerMetric(BaseModel):
    metric: str
    student_value: float
    class_average: float


class AdvancedAnalyticsResponse(BaseModel):
    cgpa_forecast: float
    dropout_risk: str
    weak_subjects: list[str]
    peer_benchmark: list[PeerMetric]
    model_accuracy: float


class MoodCreate(BaseModel):
    mood_score: int
    mood_emoji: str
    note: str = ""


class MoodResponse(BaseModel):
    id: int
    user_id: int
    mood_score: int
    mood_emoji: str
    note: str
    date: datetime

    class Config:
        from_attributes = True


class PomodoroSessionCreate(BaseModel):
    focus_minutes: int = 25
    break_minutes: int = 5
    completed: int = 1


class PomodoroSessionResponse(BaseModel):
    id: int
    user_id: int
    focus_minutes: int
    break_minutes: int
    completed: int
    created_at: datetime

    class Config:
        from_attributes = True


class StudyScheduleItem(BaseModel):
    day_of_week: str
    suggested_study_hours: float


class NotificationItem(BaseModel):
    title: str
    detail: str
    severity: str


class ResourceItem(BaseModel):
    subject: str
    youtube_url: str
    pdf_url: str


class StudyPlanBase(BaseModel):
    title: str
    class_level: Literal["University"] = "University"
    subjects: list[str] = []
    weak_subjects: list[str] = []
    strong_subjects: list[str] = []
    available_hours_per_day: float = 2.0
    exam_score: float = 70.0
    attendance_percentage: float = 80.0


class StudyPlanCreate(StudyPlanBase):
    pass


class StudyPlanUpdate(BaseModel):
    title: Optional[str] = None
    class_level: Optional[Literal["University"]] = None
    subjects: Optional[list[str]] = None
    weak_subjects: Optional[list[str]] = None
    strong_subjects: Optional[list[str]] = None
    available_hours_per_day: Optional[float] = None
    exam_score: Optional[float] = None
    attendance_percentage: Optional[float] = None
    adaptive_difficulty: Optional[str] = None
    weekly_target_hours: Optional[float] = None
    is_active: Optional[bool] = None


class StudyPlanResponse(StudyPlanBase):
    id: int
    user_id: int
    adaptive_difficulty: str
    weekly_target_hours: float
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ScheduleBase(BaseModel):
    study_plan_id: Optional[int] = None
    schedule_scope: Literal["daily", "weekly"] = "daily"
    day_of_week: str
    subject: str
    start_time: str = "18:00"
    planned_minutes: int = 60
    difficulty_level: str = "Medium"
    is_completed: bool = False


class ScheduleCreate(ScheduleBase):
    pass


class ScheduleUpdate(BaseModel):
    schedule_scope: Optional[Literal["daily", "weekly"]] = None
    day_of_week: Optional[str] = None
    subject: Optional[str] = None
    start_time: Optional[str] = None
    planned_minutes: Optional[int] = None
    difficulty_level: Optional[str] = None
    is_completed: Optional[bool] = None


class ScheduleResponse(ScheduleBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TaskBase(BaseModel):
    schedule_id: Optional[int] = None
    title: str
    subject: str = "General"
    status: Literal["Completed", "Partial", "Not Done"] = "Not Done"
    due_date: Optional[datetime] = None
    estimated_minutes: int = 60
    actual_minutes: int = 0
    adaptive_difficulty: str = "Medium"


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    subject: Optional[str] = None
    status: Optional[Literal["Completed", "Partial", "Not Done"]] = None
    due_date: Optional[datetime] = None
    estimated_minutes: Optional[int] = None
    actual_minutes: Optional[int] = None
    adaptive_difficulty: Optional[str] = None


class TaskResponse(TaskBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ProgressTrackingBase(BaseModel):
    study_plan_id: Optional[int] = None
    task_id: Optional[int] = None
    attendance_percentage: float = 0.0
    active_minutes: int = 0
    idle_minutes: int = 0
    focus_sessions: int = 0
    completed_tasks: int = 0
    partial_tasks: int = 0
    not_done_tasks: int = 0
    consistency_score: float = 0.0
    weekly_performance: float = 0.0
    streak_count: int = 0
    notes: str = ""


class ProgressTrackingCreate(ProgressTrackingBase):
    track_date: Optional[datetime] = None


class ProgressTrackingUpdate(BaseModel):
    attendance_percentage: Optional[float] = None
    active_minutes: Optional[int] = None
    idle_minutes: Optional[int] = None
    focus_sessions: Optional[int] = None
    completed_tasks: Optional[int] = None
    partial_tasks: Optional[int] = None
    not_done_tasks: Optional[int] = None
    consistency_score: Optional[float] = None
    weekly_performance: Optional[float] = None
    streak_count: Optional[int] = None
    notes: Optional[str] = None


class ProgressTrackingResponse(ProgressTrackingBase):
    id: int
    user_id: int
    track_date: datetime
    created_at: datetime

    class Config:
        from_attributes = True


class ReminderBase(BaseModel):
    task_id: Optional[int] = None
    title: str
    message: str
    remind_at: datetime
    is_sent: bool = False


class ReminderCreate(ReminderBase):
    pass


class ReminderUpdate(BaseModel):
    title: Optional[str] = None
    message: Optional[str] = None
    remind_at: Optional[datetime] = None
    is_sent: Optional[bool] = None


class ReminderResponse(ReminderBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ActivityLogBase(BaseModel):
    activity_type: str = "focus"
    session_label: str = "Pomodoro"
    started_at: datetime
    ended_at: datetime
    active_minutes: int = 0
    idle_minutes: int = 0
    blocked_notifications: bool = False
    metadata_json: str = "{}"


class ActivityLogCreate(ActivityLogBase):
    pass


class ActivityLogUpdate(BaseModel):
    ended_at: Optional[datetime] = None
    active_minutes: Optional[int] = None
    idle_minutes: Optional[int] = None
    blocked_notifications: Optional[bool] = None
    metadata_json: Optional[str] = None


class ActivityLogResponse(ActivityLogBase):
    id: int
    user_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class SmartPlannerRequest(BaseModel):
    class_level: Literal["University"]
    subjects: list[str]
    weak_subjects: list[str] = []
    strong_subjects: list[str] = []
    available_hours_per_day: float
    exam_score: float
    attendance_percentage: float


class SmartPlannerResponse(BaseModel):
    plan: StudyPlanResponse
    daily_schedule: list[ScheduleResponse]
    weekly_schedule: list[ScheduleResponse]
    suggested_focus_minutes: int
    adaptive_reason: str


class ProgressSummaryResponse(BaseModel):
    streak_count: int
    weekly_performance: float
    attendance_average: float
    active_minutes_total: int
    idle_minutes_total: int
    completed_tasks: int
    partial_tasks: int
    not_done_tasks: int


class StudentDatasetImportSummary(BaseModel):
    imported_count: int
    skipped_count: int
    source_file: str


class PerformancePredictionRequest(BaseModel):
    student_id: str
    study_hours_per_day: float
    attendance_percentage: float
    behavior_score: float
    subjects: list[str]


class PerformancePredictionResponse(BaseModel):
    student_id: str
    predicted_exam_score: float
    confidence_score: Optional[float] = None


class TrendPredictionRequest(BaseModel):
    student_id: str
    historical_scores: list[float]


class TrendPredictionResponse(BaseModel):
    student_id: str
    next_score_prediction: float
    slope: float
    trend_direction: str


class ClusterResponse(BaseModel):
    student_id: str
    cluster_id: int
    cluster_label: str


class RiskAnalysisRequest(BaseModel):
    student_id: str
    predicted_exam_score: float
    attendance_percentage: float
    study_hours_per_day: float


class RiskAnalysisResponse(BaseModel):
    student_id: str
    risk_level: str
    risk_reasons: list[str]


class WeakSubjectItem(BaseModel):
    subject: str
    trend: str
    average_score: float


class BehaviorAnalysisResponse(BaseModel):
    student_id: str
    study_consistency: float
    behavior_summary: str
    device_impact_level: str


class PerformanceTrendPoint(BaseModel):
    index: int
    score: float


class PerformanceTrendResponse(BaseModel):
    student_id: str
    trend_direction: str
    points: list[PerformanceTrendPoint]


class RevisionPlanRequest(BaseModel):
    student_id: str
    subject: str
    base_date: Optional[datetime] = None
    latest_performance: Optional[float] = None


class RevisionScheduleItem(BaseModel):
    id: Optional[int] = None
    subject: str
    revision_day_offset: int
    scheduled_date: datetime
    revision_status: str


class RevisionPlanResponse(BaseModel):
    student_id: str
    schedule: list[RevisionScheduleItem]


class RevisionFeedbackRequest(BaseModel):
    score: Optional[float] = None
    performance_feedback: Optional[float] = None


class AnalyticsDashboardResponse(BaseModel):
    student_id: str
    performance_over_time: list[PerformanceTrendPoint]
    subject_scores: dict[str, float]
    study_vs_score: list[dict[str, float]]
    heatmap: list[dict[str, float | str]]
    weekly_report: str
    monthly_report: str


class NotificationRequest(BaseModel):
    type: str
    title: str
    message: str
    data: Optional[dict] = None


class NotificationResponse(BaseModel):
    id: int
    user_id: int
    type: str
    title: str
    message: str
    data: Optional[dict] = None
    is_read: bool
    created_at: datetime
    read_at: Optional[datetime] = None

    class Config:
        from_attributes = True

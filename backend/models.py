from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=False)

    predictions = relationship("PredictionHistory", back_populates="user", cascade="all, delete-orphan")
    profile = relationship("UserProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    habits = relationship("HabitLog", back_populates="user", cascade="all, delete-orphan")
    chat_logs = relationship("ChatLog", back_populates="user", cascade="all, delete-orphan")
    mood_logs = relationship("MoodLog", back_populates="user", cascade="all, delete-orphan")
    pomodoro_sessions = relationship("PomodoroSession", back_populates="user", cascade="all, delete-orphan")
    study_schedules = relationship("StudySchedule", back_populates="user", cascade="all, delete-orphan")
    study_plans = relationship("StudyPlan", back_populates="user", cascade="all, delete-orphan")
    schedules = relationship("Schedule", back_populates="user", cascade="all, delete-orphan")
    tasks = relationship("Task", back_populates="user", cascade="all, delete-orphan")
    progress_tracking = relationship("ProgressTracking", back_populates="user", cascade="all, delete-orphan")
    reminders = relationship("Reminder", back_populates="user", cascade="all, delete-orphan")
    activity_logs = relationship("ActivityLog", back_populates="user", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")


class PredictionHistory(Base):
    __tablename__ = "prediction_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    attendance = Column(Float, nullable=False)
    study_hours = Column(Float, nullable=False)
    sleep = Column(Float, nullable=False)
    social_media_usage = Column(Float, nullable=False, default=0.0)
    stress = Column(Integer, nullable=False)
    assignment_status = Column(String, nullable=False, default="on_track")
    risk_result = Column(String, nullable=False)
    confidence_score = Column(Float, nullable=True)
    cgpa_forecast = Column(Float, nullable=True)
    dropout_risk = Column(String, nullable=True)
    weak_subjects = Column(String, nullable=True)
    date = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="predictions")


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False, index=True)
    full_name = Column(String, default="")
    student_id = Column(String, default="")
    department = Column(String, default="")
    target_cgpa = Column(Float, nullable=True)
    profile_picture = Column(String, default="")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="profile")


class HabitLog(Base):
    __tablename__ = "habit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String, nullable=False)
    status = Column(String, default="pending")
    date = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="habits")


class ChatLog(Base):
    __tablename__ = "chat_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    role = Column(String, nullable=False)
    message = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="chat_logs")


class MoodLog(Base):
    __tablename__ = "mood_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    mood_score = Column(Integer, nullable=False)
    mood_emoji = Column(String, nullable=False)
    note = Column(String, default="")
    date = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="mood_logs")


class PomodoroSession(Base):
    __tablename__ = "pomodoro_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    focus_minutes = Column(Integer, nullable=False, default=25)
    break_minutes = Column(Integer, nullable=False, default=5)
    completed = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="pomodoro_sessions")


class StudySchedule(Base):
    __tablename__ = "study_schedules"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    day_of_week = Column(String, nullable=False)
    suggested_study_hours = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="study_schedules")


class StudyPlan(Base):
    __tablename__ = "study_plans"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String, nullable=False)
    class_level = Column(String, nullable=False, default="University")
    subjects = Column(String, nullable=False, default="")
    weak_subjects = Column(String, nullable=False, default="")
    strong_subjects = Column(String, nullable=False, default="")
    available_hours_per_day = Column(Float, nullable=False, default=2.0)
    exam_score = Column(Float, nullable=False, default=70.0)
    attendance_percentage = Column(Float, nullable=False, default=80.0)
    adaptive_difficulty = Column(String, nullable=False, default="Medium")
    weekly_target_hours = Column(Float, nullable=False, default=14.0)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="study_plans")
    schedules = relationship("Schedule", back_populates="study_plan", cascade="all, delete-orphan")
    progress_entries = relationship("ProgressTracking", back_populates="study_plan", cascade="all, delete-orphan")


class Schedule(Base):
    __tablename__ = "schedules"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    study_plan_id = Column(Integer, ForeignKey("study_plans.id"), nullable=True, index=True)
    schedule_scope = Column(String, nullable=False, default="daily")
    day_of_week = Column(String, nullable=False)
    subject = Column(String, nullable=False)
    start_time = Column(String, nullable=False, default="18:00")
    planned_minutes = Column(Integer, nullable=False, default=60)
    difficulty_level = Column(String, nullable=False, default="Medium")
    is_completed = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="schedules")
    study_plan = relationship("StudyPlan", back_populates="schedules")
    tasks = relationship("Task", back_populates="schedule", cascade="all, delete-orphan")


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    schedule_id = Column(Integer, ForeignKey("schedules.id"), nullable=True, index=True)
    title = Column(String, nullable=False)
    subject = Column(String, nullable=False, default="General")
    status = Column(String, nullable=False, default="Not Done")
    due_date = Column(DateTime, nullable=True)
    estimated_minutes = Column(Integer, nullable=False, default=60)
    actual_minutes = Column(Integer, nullable=False, default=0)
    adaptive_difficulty = Column(String, nullable=False, default="Medium")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="tasks")
    schedule = relationship("Schedule", back_populates="tasks")
    progress_entries = relationship("ProgressTracking", back_populates="task", cascade="all, delete-orphan")
    reminders = relationship("Reminder", back_populates="task", cascade="all, delete-orphan")


class ProgressTracking(Base):
    __tablename__ = "progress_tracking"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    study_plan_id = Column(Integer, ForeignKey("study_plans.id"), nullable=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=True, index=True)
    track_date = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    attendance_percentage = Column(Float, nullable=False, default=0.0)
    active_minutes = Column(Integer, nullable=False, default=0)
    idle_minutes = Column(Integer, nullable=False, default=0)
    focus_sessions = Column(Integer, nullable=False, default=0)
    completed_tasks = Column(Integer, nullable=False, default=0)
    partial_tasks = Column(Integer, nullable=False, default=0)
    not_done_tasks = Column(Integer, nullable=False, default=0)
    consistency_score = Column(Float, nullable=False, default=0.0)
    weekly_performance = Column(Float, nullable=False, default=0.0)
    streak_count = Column(Integer, nullable=False, default=0)
    notes = Column(Text, nullable=False, default="")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="progress_tracking")
    study_plan = relationship("StudyPlan", back_populates="progress_entries")
    task = relationship("Task", back_populates="progress_entries")


class Reminder(Base):
    __tablename__ = "reminders"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=True, index=True)
    title = Column(String, nullable=False)
    message = Column(String, nullable=False)
    remind_at = Column(DateTime, nullable=False, index=True)
    is_sent = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="reminders")
    task = relationship("Task", back_populates="reminders")


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    activity_type = Column(String, nullable=False, default="focus")
    session_label = Column(String, nullable=False, default="Pomodoro")
    started_at = Column(DateTime, nullable=False)
    ended_at = Column(DateTime, nullable=False)
    active_minutes = Column(Integer, nullable=False, default=0)
    idle_minutes = Column(Integer, nullable=False, default=0)
    blocked_notifications = Column(Boolean, nullable=False, default=False)
    metadata_json = Column(Text, nullable=False, default="{}")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="activity_logs")


class StudentDatasetRecord(Base):
    __tablename__ = "student_dataset_records"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=False)
    gender = Column(String, nullable=False)
    class_level = Column(String, nullable=False, default="University")
    institution_name = Column(String, nullable=False, default="")
    university_name = Column(String, nullable=False)
    university_type = Column(String, nullable=False)
    department = Column(String, nullable=False)
    subjects = Column(String, nullable=False)
    semester_year = Column(String, nullable=False)
    cgpa = Column(Float, nullable=False)
    study_hours_per_day = Column(Float, nullable=False)
    weak_subjects = Column(String, nullable=False)
    strong_subjects = Column(String, nullable=False)
    exam_score = Column(Float, nullable=False)
    attendance_percentage = Column(Float, nullable=False)
    district = Column(String, nullable=False)
    device_usage_time = Column(Float, nullable=False)
    preferred_study_time = Column(String, nullable=False)
    historical_scores = Column(String, nullable=False, default="")
    risk_level = Column(String, nullable=False, default="Medium")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    ml_predictions = relationship("MlPrediction", back_populates="student", cascade="all, delete-orphan")
    clusters = relationship("StudentCluster", back_populates="student", cascade="all, delete-orphan")
    risks = relationship("RiskAnalysis", back_populates="student", cascade="all, delete-orphan")
    revisions = relationship("RevisionSchedule", back_populates="student", cascade="all, delete-orphan")
    performance_logs = relationship("PerformanceLog", back_populates="student", cascade="all, delete-orphan")
    analytics_reports = relationship("AnalyticsReport", back_populates="student", cascade="all, delete-orphan")


class MlPrediction(Base):
    __tablename__ = "ml_predictions"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(String, ForeignKey("student_dataset_records.student_id"), nullable=False, index=True)
    model_name = Column(String, nullable=False)
    predicted_exam_score = Column(Float, nullable=False)
    confidence_score = Column(Float, nullable=True)
    input_snapshot = Column(Text, nullable=False, default="{}")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    student = relationship("StudentDatasetRecord", back_populates="ml_predictions")


class StudentCluster(Base):
    __tablename__ = "student_clusters"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(String, ForeignKey("student_dataset_records.student_id"), nullable=False, index=True)
    cluster_id = Column(Integer, nullable=False, index=True)
    cluster_label = Column(String, nullable=False)
    distance_to_centroid = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    student = relationship("StudentDatasetRecord", back_populates="clusters")


class RiskAnalysis(Base):
    __tablename__ = "risk_analysis"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(String, ForeignKey("student_dataset_records.student_id"), nullable=False, index=True)
    predicted_exam_score = Column(Float, nullable=False)
    risk_level = Column(String, nullable=False, index=True)
    risk_reasons = Column(Text, nullable=False, default="")
    threshold_used = Column(Float, nullable=False, default=50.0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    student = relationship("StudentDatasetRecord", back_populates="risks")


class RevisionSchedule(Base):
    __tablename__ = "revision_schedule"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(String, ForeignKey("student_dataset_records.student_id"), nullable=False, index=True)
    subject = Column(String, nullable=False, index=True)
    revision_day_offset = Column(Integer, nullable=False)
    scheduled_date = Column(DateTime, nullable=False, index=True)
    performance_feedback = Column(Float, nullable=True)
    revision_status = Column(String, nullable=False, default="pending")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    student = relationship("StudentDatasetRecord", back_populates="revisions")


class PerformanceLog(Base):
    __tablename__ = "performance_logs"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(String, ForeignKey("student_dataset_records.student_id"), nullable=False, index=True)
    subject = Column(String, nullable=False, index=True)
    score = Column(Float, nullable=False)
    study_hours = Column(Float, nullable=False)
    attendance_percentage = Column(Float, nullable=False)
    device_usage_time = Column(Float, nullable=False)
    consistency_score = Column(Float, nullable=False, default=0.0)
    logged_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    student = relationship("StudentDatasetRecord", back_populates="performance_logs")


class AnalyticsReport(Base):
    __tablename__ = "analytics_reports"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(String, ForeignKey("student_dataset_records.student_id"), nullable=False, index=True)
    report_type = Column(String, nullable=False, index=True)
    report_period = Column(String, nullable=False)
    report_payload = Column(Text, nullable=False, default="{}")
    generated_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    student = relationship("StudentDatasetRecord", back_populates="analytics_reports")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    type = Column(String, nullable=False, index=True)  # 'prediction_complete', 'study_plan_ready', etc.
    title = Column(String, nullable=False)
    message = Column(String, nullable=False)
    data = Column(Text, nullable=False, default="{}")  # JSON payload
    is_read = Column(Boolean, nullable=False, default=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    read_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="notifications")

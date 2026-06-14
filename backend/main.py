import csv
import io
import json
import os
import pickle
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
import pandas as pd
from fastapi import Depends, FastAPI, HTTPException, Query, Response, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.concurrency import run_in_threadpool
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

import auth
import models
import schemas
from import_student_dataset import import_dataset
from ml_logic.academic_ml import ensure_models, label_clusters, load_models, predict_trend, to_json
from study_features import router as study_features_router
from database import SessionLocal, engine, get_db

MODEL_ACCURACY = 0.95
ADMIN_EMAILS = [email.strip().lower() for email in os.getenv("ADMIN_EMAILS", "admin@edupredict.ai").split(",") if email.strip()]


def get_allowed_origins() -> list[str]:
    configured = os.getenv("FRONTEND_ORIGINS", "")
    if configured.strip():
        return [origin.strip() for origin in configured.split(",") if origin.strip()]
    return [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ]


class DashboardConnectionManager:
    def __init__(self):
        self.active_connections: set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)

    async def broadcast(self, message: dict):
        stale = []
        for conn in list(self.active_connections):
            try:
                await conn.send_json(message)
            except Exception:
                stale.append(conn)
        for conn in stale:
            self.disconnect(conn)


def is_admin_user(user: models.User) -> bool:
    # For development: make user_id=1 (first registered user) an admin
    if user.id == 1:
        return True
    return user.email.lower() in ADMIN_EMAILS



class ChatConnectionManager:
    def __init__(self):
        self.connections_by_user: dict[int, set[WebSocket]] = {}

    async def connect(self, user_id: int, websocket: WebSocket):
        await websocket.accept()
        self.connections_by_user.setdefault(user_id, set()).add(websocket)

    def disconnect(self, user_id: int, websocket: WebSocket):
        if user_id not in self.connections_by_user:
            return
        self.connections_by_user[user_id].discard(websocket)
        if not self.connections_by_user[user_id]:
            del self.connections_by_user[user_id]

    async def send_to_user(self, user_id: int, message: dict):
        if user_id not in self.connections_by_user:
            return

        stale = []
        for conn in list(self.connections_by_user[user_id]):
            try:
                await conn.send_json(message)
            except Exception:
                stale.append(conn)

        for conn in stale:
            self.disconnect(user_id, conn)


class NotificationConnectionManager:
    def __init__(self):
        self.connections_by_user: dict[int, set[WebSocket]] = {}

    async def connect(self, user_id: int, websocket: WebSocket):
        await websocket.accept()
        self.connections_by_user.setdefault(user_id, set()).add(websocket)

    def disconnect(self, user_id: int, websocket: WebSocket):
        if user_id not in self.connections_by_user:
            return
        self.connections_by_user[user_id].discard(websocket)
        if not self.connections_by_user[user_id]:
            del self.connections_by_user[user_id]

    async def send_to_user(self, user_id: int, message: dict):
        if user_id not in self.connections_by_user:
            return

        stale = []
        for conn in list(self.connections_by_user[user_id]):
            try:
                await conn.send_json(message)
            except Exception:
                stale.append(conn)

        for conn in stale:
            self.disconnect(user_id, conn)


def ensure_schema_compatibility():
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())
    if "prediction_history" not in table_names:
        return

    existing_cols = {col["name"] for col in inspector.get_columns("prediction_history")}
    column_map = {
        "confidence_score": "FLOAT",
        "social_media_usage": "FLOAT DEFAULT 0.0",
        "assignment_status": "VARCHAR DEFAULT 'on_track'",
        "cgpa_forecast": "FLOAT",
        "dropout_risk": "VARCHAR",
        "weak_subjects": "VARCHAR",
    }
    with engine.begin() as conn:
        for col, ddl in column_map.items():
            if col not in existing_cols:
                conn.execute(text(f"ALTER TABLE prediction_history ADD COLUMN {col} {ddl}"))

        if "student_dataset_records" in table_names:
            dataset_cols = {col["name"] for col in inspector.get_columns("student_dataset_records")}
            dataset_column_map = {
                "university_name": "VARCHAR DEFAULT ''",
                "university_type": "VARCHAR DEFAULT 'Private'",
                "department": "VARCHAR DEFAULT 'General'",
                "semester_year": "VARCHAR DEFAULT 'Year 1, Spring'",
                "cgpa": "FLOAT DEFAULT 3.0",
                "risk_level": "VARCHAR DEFAULT 'Medium'",
            }
            for col, ddl in dataset_column_map.items():
                if col not in dataset_cols:
                    conn.execute(text(f"ALTER TABLE student_dataset_records ADD COLUMN {col} {ddl}"))
            if "historical_scores" not in dataset_cols:
                conn.execute(text("ALTER TABLE student_dataset_records ADD COLUMN historical_scores VARCHAR DEFAULT ''"))

            conn.execute(
                text(
                    """
                    UPDATE student_dataset_records
                    SET university_name = COALESCE(NULLIF(university_name, ''), institution_name, 'Unknown Institution')
                    """
                )
            )
            conn.execute(
                text(
                    """
                    UPDATE student_dataset_records
                    SET university_type = COALESCE(NULLIF(university_type, ''), 'Private')
                    """
                )
            )
            conn.execute(
                text(
                    """
                    UPDATE student_dataset_records
                    SET department = COALESCE(NULLIF(department, ''), class_level, 'General')
                    """
                )
            )
            conn.execute(
                text(
                    """
                    UPDATE student_dataset_records
                    SET semester_year = COALESCE(NULLIF(semester_year, ''), 'Year 1, Spring')
                    """
                )
            )
            conn.execute(
                text(
                    """
                    UPDATE student_dataset_records
                    SET cgpa = COALESCE(cgpa, MIN(4.0, MAX(0.0, exam_score / 25.0)), 3.0)
                    """
                )
            )
            conn.execute(
                text(
                    """
                    UPDATE student_dataset_records
                    SET risk_level = COALESCE(NULLIF(risk_level, ''), 'Medium')
                    """
                )
            )

        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_ml_predictions_student_id ON ml_predictions(student_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_student_clusters_student_id ON student_clusters(student_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_risk_analysis_student_id ON risk_analysis(student_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_revision_schedule_student_id ON revision_schedule(student_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_performance_logs_student_id ON performance_logs(student_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_analytics_reports_student_id ON analytics_reports(student_id)"))


def calculate_advanced_outputs(request: schemas.PredictionRequest):
    score = (
        0.35 * request.attendance
        + 0.20 * (request.study_hours * 10)
        + 0.15 * max(0, 100 - abs(request.sleep - 8) * 12)
        + 0.15 * max(0, 100 - request.social_media_usage * 12)
        + 0.15 * max(0, 100 - request.stress * 8)
    )
    cgpa_forecast = round(min(4.0, max(1.8, 2.0 + score / 50.0)), 2)

    dropout_points = 0
    if request.attendance < 65:
        dropout_points += 2
    if request.study_hours < 2:
        dropout_points += 2
    if request.sleep < 5:
        dropout_points += 1
    if request.social_media_usage > 6:
        dropout_points += 1
    if request.stress > 7:
        dropout_points += 2
    if request.assignment_status in {"delayed", "overdue"}:
        dropout_points += 2

    if dropout_points >= 6:
        dropout_risk = "High"
    elif dropout_points >= 3:
        dropout_risk = "Medium"
    else:
        dropout_risk = "Low"

    weak_subjects = []
    if request.attendance < 70:
        weak_subjects.extend(["Mathematics", "Core Engineering"])
    if request.study_hours < 3:
        weak_subjects.append("Theory Subjects")
    if request.stress > 7:
        weak_subjects.append("Lab Performance")
    if request.assignment_status in {"delayed", "overdue"}:
        weak_subjects.append("Project Work")
    if not weak_subjects:
        weak_subjects = ["No major weak area detected"]

    return cgpa_forecast, dropout_risk, weak_subjects


def build_schedule(risk_result: str):
    if risk_result == "High":
        base_hours = [3.5, 3.5, 4.0, 3.0, 4.0, 2.5, 2.5]
    elif risk_result == "Medium":
        base_hours = [2.5, 2.5, 3.0, 2.0, 3.0, 2.0, 1.5]
    else:
        base_hours = [2.0, 2.0, 2.5, 1.5, 2.5, 1.5, 1.0]

    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    return [schemas.StudyScheduleItem(day_of_week=d, suggested_study_hours=h) for d, h in zip(days, base_hours)]


def resource_map(weak_subjects: list[str]):
    resources = {
        "Mathematics": schemas.ResourceItem(
            subject="Mathematics",
            youtube_url="https://www.youtube.com/watch?v=7cM4R0t6Y8w",
            pdf_url="https://tutorial.math.lamar.edu/pdf/Calculus_Cheat_Sheet_All.pdf",
        ),
        "Core Engineering": schemas.ResourceItem(
            subject="Core Engineering",
            youtube_url="https://www.youtube.com/watch?v=mx8Vf_20W6Q",
            pdf_url="https://ocw.mit.edu/courses/engineering/",
        ),
        "Theory Subjects": schemas.ResourceItem(
            subject="Theory Subjects",
            youtube_url="https://www.youtube.com/watch?v=IlU-zDU6aQ0",
            pdf_url="https://learningcenter.unc.edu/tips-and-tools/reading-textbooks-effectively/",
        ),
        "Lab Performance": schemas.ResourceItem(
            subject="Lab Performance",
            youtube_url="https://www.youtube.com/watch?v=lFhU7n6j9qQ",
            pdf_url="https://www.chem.purdue.edu/academic_programs/safety/labsafety.pdf",
        ),
        "Project Work": schemas.ResourceItem(
            subject="Project Work",
            youtube_url="https://www.youtube.com/watch?v=H14bBuluwB8",
            pdf_url="https://www.pmi.org/learning/library/project-management-plan-template-11127",
        ),
    }

    items = []
    for subject in weak_subjects:
        if subject in resources:
            items.append(resources[subject])
    if not items:
        items.append(
            schemas.ResourceItem(
                subject="General",
                youtube_url="https://www.youtube.com/watch?v=ukLnPbIffxE",
                pdf_url="https://www.studygs.net/",
            )
        )
    return items


def risk_tip_from_latest_prediction(question: str, latest_prediction: models.PredictionHistory | None) -> str:
    normalized = question.lower().strip()
    if latest_prediction is None:
        return "I do not see prediction history yet. Submit your data and I will provide personalized tips instantly."

    risk = latest_prediction.risk_result
    if "stress" in normalized:
        return "Try a 10-minute breathing break and split your next task into a short 25-minute focus block."

    if "sleep" in normalized:
        return "Aim for 7 to 8 hours sleep and avoid social media during the last hour before bed."

    if "risk" in normalized or "tip" in normalized or "help" in normalized:
        if risk == "High":
            return "Risk is High. Prioritize attendance recovery, assignment completion, and shorter Pomodoro cycles."
        if risk == "Medium":
            return "Risk is Medium. Increase study consistency this week and reduce stress triggers."
        return "Risk is Low. Keep consistent routines and weekly review sessions."

    return f"Latest risk status is {risk}. Ask for study plans, stress tips, or weak-subject resources."


def build_suggestions(latest_prediction: models.PredictionHistory | None) -> list[schemas.SuggestionItem]:
    if latest_prediction is None:
        return [
            schemas.SuggestionItem(
                title="No Prediction Yet",
                description="Submit a prediction to unlock AI suggestions tailored to your habits.",
            )
        ]

    if latest_prediction.risk_result == "High":
        return [
            schemas.SuggestionItem(title="Attendance Recovery", description="Target +10% attendance in the next two weeks."),
            schemas.SuggestionItem(title="Assignment Rescue", description="Finish overdue assignments before starting new tasks."),
            schemas.SuggestionItem(title="Stress Reset", description="Use 25/5 Pomodoro and include short breathing breaks."),
        ]
    if latest_prediction.risk_result == "Medium":
        return [
            schemas.SuggestionItem(title="Consistency Boost", description="Add one extra 30-minute focus block daily."),
            schemas.SuggestionItem(title="Sleep Balance", description="Maintain 7+ hours sleep for the next five days."),
            schemas.SuggestionItem(title="Review Routine", description="Schedule two weekly revision checkpoints."),
        ]

    return [
        schemas.SuggestionItem(title="Maintain Momentum", description="Current habits are working. Keep your routine steady."),
        schemas.SuggestionItem(title="Stretch Goal", description="Add one high-difficulty practice session each week."),
        schemas.SuggestionItem(title="Peer Leader", description="Help peers in weaker subjects to strengthen your own mastery."),
    ]


def _normalize_language(language: str | None) -> str:
    if not language:
        return "english"
    normalized = language.strip().lower()
    if normalized in {"english", "en"}:
        return "english"
    if normalized in {"hindi", "hindhi", "hind"}:
        return "hindi"
    if normalized in {"bangla", "bengali", "bn"}:
        return "bangla"
    return "english"


def _youtube_search_url(subject: str, language: str) -> str:
    query = f"{subject} {language} tutorials"
    return f"https://www.youtube.com/results?search_query={query.replace(' ', '+')}"


def _youtube_channel_suggestion(subject: str, language: str) -> str:
    key = subject.strip().lower()
    if "math" in key or "algebra" in key or "calculus" in key:
        return {
            "english": "Khan Academy Math",
            "hindi": "Physics Wallah Math Hindi",
            "bangla": "Bangla Math Tutorial",
        }[language]
    if "physics" in key:
        return {
            "english": "CrashCourse Physics",
            "hindi": "Physics Wallah Physics Hindi",
            "bangla": "Bangla Physics Tutorial",
        }[language]
    if "chemistry" in key:
        return {
            "english": "Khan Academy Chemistry",
            "hindi": "Physics Wallah Chemistry Hindi",
            "bangla": "Bangla Chemistry Tutorial",
        }[language]
    if "biology" in key or "bio" in key:
        return {
            "english": "Amoeba Sisters Biology",
            "hindi": "Biology Tutorial Hindi",
            "bangla": "Bangla Biology Tutorial",
        }[language]
    if "program" in key or "computer" in key or "cs" in key:
        return {
            "english": "freeCodeCamp Programming",
            "hindi": "CodeWithHarry Hindi",
            "bangla": "Bangla Programming Tutorial",
        }[language]
    return {
        "english": "Khan Academy",
        "hindi": "Study IQ Education Hindi",
        "bangla": "Bangla Study Tutorials",
    }[language]


def build_study_suggestions(
    latest_prediction: models.PredictionHistory | None,
    history: list[models.PredictionHistory] | None = None,
    language: str = "english",
) -> list[schemas.SuggestionItem]:
    language = _normalize_language(language)
    if latest_prediction is None:
        return [
            schemas.SuggestionItem(
                title="No Study Data Yet",
                description="Submit prediction data to receive personalized real-time study suggestions.",
            )
        ]

    records = history or []

    def avg(values: list[float]) -> float:
        return float(sum(values) / len(values)) if values else 0.0

    recent = records[:5]
    avg_study = avg([r.study_hours for r in recent]) if recent else latest_prediction.study_hours
    avg_sleep = avg([r.sleep for r in recent]) if recent else latest_prediction.sleep
    avg_stress = avg([float(r.stress) for r in recent]) if recent else float(latest_prediction.stress)

    suggestions: list[schemas.SuggestionItem] = []

    if latest_prediction.study_hours < 3 or avg_study < 3:
        suggestions.append(
            schemas.SuggestionItem(
                title="Increase Study Time",
                description="Increase your daily study time by adding at least one focused 30-minute session.",
            )
        )

    if latest_prediction.stress >= 7 or avg_stress >= 7:
        suggestions.append(
            schemas.SuggestionItem(
                title="Manage Stress",
                description="Take short breaks, use breathing exercises, and split tasks into smaller sessions.",
            )
        )

    if latest_prediction.sleep < 6.5 or avg_sleep < 6.5:
        suggestions.append(
            schemas.SuggestionItem(
                title="Improve Sleep Schedule",
                description="Aim for consistent 7 to 8 hours of sleep to improve concentration and retention.",
            )
        )

    if latest_prediction.attendance < 75:
        suggestions.append(
            schemas.SuggestionItem(
                title="Boost Attendance",
                description="Improve attendance to reduce academic risk and keep up with course progression.",
            )
        )

    weak_subjects = [item.strip() for item in (latest_prediction.weak_subjects or "").split(",") if item.strip()]
    if weak_subjects:
        for subject in weak_subjects[:2]:
            channel = _youtube_channel_suggestion(subject, language)
            url = _youtube_search_url(subject, language)
            suggestions.append(
                schemas.SuggestionItem(
                    title=f"Watch {channel} for {subject}",
                    description=(
                        f"Strengthen your {subject} skills with {channel} videos in {language.title()}. "
                        f"Search YouTube: {url}"
                    ),
                )
            )
    elif latest_prediction.risk_result == "High":
        channel = _youtube_channel_suggestion("general", language)
        url = _youtube_search_url("study skills", language)
        suggestions.append(
            schemas.SuggestionItem(
                title="Watch YouTube tutorials for recovery",
                description=(
                    f"High-risk performance needs a focused review. Watch {channel} videos in {language.title()} and follow a steady study routine. "
                    f"Search YouTube: {url}"
                ),
            )
        )

    if latest_prediction.risk_result == "High":
        weak_hint = f" Prioritize: {', '.join(weak_subjects)}." if weak_subjects else " Focus more on weak subjects."
        suggestions.append(
            schemas.SuggestionItem(
                title="High-Risk Recovery Plan",
                description=f"Performance risk is high.{weak_hint}",
            )
        )
    elif latest_prediction.risk_result == "Medium":
        suggestions.append(
            schemas.SuggestionItem(
                title="Stabilize Performance",
                description="Your risk is medium. Keep a weekly revision plan and track progress every 2 days.",
            )
        )

    if not suggestions:
        suggestions.append(
            schemas.SuggestionItem(
                title="Keep Your Routine",
                description="Your current habits look balanced. Maintain consistency and review weak topics weekly.",
            )
        )

    deduped: list[schemas.SuggestionItem] = []
    seen_titles: set[str] = set()
    for item in suggestions:
        if item.title in seen_titles:
            continue
        seen_titles.add(item.title)
        deduped.append(item)

    return deduped[:6]


def parse_scores(value: str | None) -> list[float]:
    if not value:
        return []
    parsed = []
    for item in value.split(","):
        token = item.strip()
        if not token:
            continue
        try:
            parsed.append(float(token))
        except ValueError:
            continue
    return parsed


def student_behavior_score(record: models.StudentDatasetRecord) -> float:
    score = (
        0.45 * record.attendance_percentage
        + 0.35 * min(10.0, record.study_hours_per_day) * 10
        + 0.20 * max(0.0, 100.0 - record.device_usage_time * 8.0)
    )
    return round(score / 100.0, 4)


def analyze_weak_subjects(record: models.StudentDatasetRecord) -> list[schemas.WeakSubjectItem]:
    subjects = [item.strip() for item in record.subjects.split(",") if item.strip()]
    weak_set = {item.strip() for item in (record.weak_subjects or "").split(",") if item.strip()}
    scores = parse_scores(record.historical_scores)
    if not subjects:
        return []

    avg_score = float(sum(scores) / len(scores)) if scores else record.exam_score
    trend = "Declining"
    if len(scores) >= 2:
        trend = "Improving" if scores[-1] >= scores[0] else "Declining"

    output = []
    for subject in subjects:
        subject_score = avg_score - 7.0 if subject in weak_set else avg_score + 4.0
        output.append(
            schemas.WeakSubjectItem(
                subject=subject,
                trend=trend if subject in weak_set else "Stable",
                average_score=round(max(0.0, min(100.0, subject_score)), 2),
            )
        )

    output.sort(key=lambda item: item.average_score)
    return output[: min(4, len(output))]


def build_heatmap(record: models.StudentDatasetRecord) -> list[dict[str, float | str]]:
    days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    base = record.study_hours_per_day
    intensity = []
    for idx, day in enumerate(days):
        factor = 0.82 + (idx % 4) * 0.08
        intensity.append({"day": day, "hours": round(max(0.5, min(10.0, base * factor)), 2)})
    return intensity


def build_reports(record: models.StudentDatasetRecord) -> tuple[str, str]:
    weekly = (
        f"Weekly report: Average study {record.study_hours_per_day:.1f}h/day, attendance {record.attendance_percentage:.1f}%, "
        f"latest score {record.exam_score:.1f}."
    )
    monthly = (
        f"Monthly report: Strong subjects {record.strong_subjects}. Focus improvement on {record.weak_subjects}. "
        f"Device usage {record.device_usage_time:.1f}h/day with {record.preferred_study_time.lower()} routine."
    )
    return weekly, monthly


async def run_db(callable_obj, *args, **kwargs):
    return await run_in_threadpool(callable_obj, *args, **kwargs)


async def get_or_create_profile(db: Session, user_id: int) -> models.UserProfile:
    def _operation():
        profile = db.query(models.UserProfile).filter(models.UserProfile.user_id == user_id).first()
        if profile:
            return profile

        profile = models.UserProfile(user_id=user_id)
        db.add(profile)
        db.commit()
        db.refresh(profile)
        return profile

    return await run_db(_operation)


async def persist_chat_message(db: Session, user_id: int, role: str, message: str):
    def _operation():
        log = models.ChatLog(user_id=user_id, role=role, message=message)
        db.add(log)
        db.commit()

    await run_db(_operation)


async def create_and_send_notification(
    db: Session,
    user_id: int,
    notification_type: str,
    title: str,
    message: str,
    data: dict | None = None,
):
    """Create a notification, save to DB, and broadcast to user via WebSocket."""
    import json

    notification = models.Notification(
        user_id=user_id,
        type=notification_type,
        title=title,
        message=message,
        data=json.dumps(data or {}),
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)

    # Broadcast to user's WebSocket connections
    await notification_ws_manager.send_to_user(
        user_id,
        {
            "type": "notification",
            "id": notification.id,
            "notification_type": notification_type,
            "title": title,
            "message": message,
            "data": data or {},
            "created_at": notification.created_at.isoformat(),
        },
    )

    return notification


async def broadcast_dashboard_event(event_type: str, user_id: int, payload: dict | None = None):
    await dashboard_ws_manager.broadcast(
        {
            "type": event_type,
            "payload": {
                "user_id": user_id,
                **(payload or {}),
            },
        }
    )


models.Base.metadata.create_all(bind=engine)
ensure_schema_compatibility()

app = FastAPI(title="EduPredict AI API")
dashboard_ws_manager = DashboardConnectionManager()
chat_ws_manager = ChatConnectionManager()
notification_ws_manager = NotificationConnectionManager()
app.include_router(study_features_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_origin_regex=r"https?://(localhost|127\\.0\\.0\\.1)(:\\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

script_dir = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(script_dir, "ml_logic", "model.pkl")
SCALER_PATH = os.path.join(script_dir, "ml_logic", "scaler.pkl")
DATASET_PATH = Path(script_dir) / "ml_logic" / "bd_students_5000.csv"

try:
    with open(MODEL_PATH, "rb") as f:
        rf_model = pickle.load(f)
    with open(SCALER_PATH, "rb") as f:
        scaler = pickle.load(f)
except Exception as e:
    print(f"Error loading model or scaler: {e}")
    rf_model, scaler = None, None

academic_models = None
try:
    ensure_models(DATASET_PATH)
    academic_models = load_models()
except Exception as e:
    print(f"Error loading academic ML models: {e}")


@app.post("/auth/register", response_model=schemas.User)
async def register_auth(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = await run_db(auth.get_user_by_email, db, user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_password = auth.get_password_hash(user.password)
    db_user = models.User(email=user.email, password=hashed_password)
    db.add(db_user)
    await run_db(db.commit)
    await run_db(db.refresh, db_user)
    await get_or_create_profile(db, db_user.id)
    return db_user


@app.post("/auth/login", response_model=schemas.Token)
async def login_for_access_token(payload: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = await run_db(auth.authenticate_user, db, payload.email, payload.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    is_admin = auth.is_admin_user(user)
    access_token = auth.create_access_token(data={"sub": str(user.id)}, expires_delta=access_token_expires, is_admin=is_admin)
    return {"access_token": access_token, "token_type": "bearer", "user_id": user.id, "is_admin": is_admin}


@app.post("/register", response_model=schemas.User)
async def register_legacy(user: schemas.UserCreate, db: Session = Depends(get_db)):
    return await register_auth(user, db)


@app.post("/login", response_model=schemas.Token)
async def login_legacy(payload: schemas.LoginRequest, db: Session = Depends(get_db)):
    return await login_for_access_token(payload, db)


@app.get("/users/me", response_model=schemas.User)
def read_users_me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user


async def save_prediction_internal(request: schemas.PredictionRequest, db: Session, current_user: models.User):
    if rf_model is None or scaler is None:
        raise HTTPException(status_code=500, detail="ML model not loaded correctly.")

    input_data = pd.DataFrame([
        {
            "attendance": request.attendance,
            "study_hours": request.study_hours,
            "sleep_hours": request.sleep,
            "social_media_usage": request.social_media_usage or 0.0,
            "stress_level": request.stress,
        }
    ])

    scaled_data = scaler.transform(input_data)
    prediction = rf_model.predict(scaled_data)[0]
    probabilities = rf_model.predict_proba(scaled_data)[0]
    confidence = float(np.max(probabilities))

    cgpa_forecast, dropout_risk, weak_subjects = calculate_advanced_outputs(request)

    db_prediction = models.PredictionHistory(
        user_id=current_user.id,
        attendance=request.attendance,
        study_hours=request.study_hours,
        sleep=request.sleep,
        social_media_usage=request.social_media_usage or 0.0,
        stress=request.stress,
        assignment_status=request.assignment_status,
        risk_result=prediction,
        confidence_score=confidence,
        cgpa_forecast=cgpa_forecast,
        dropout_risk=dropout_risk,
        weak_subjects=",".join(weak_subjects),
    )
    db.add(db_prediction)
    await run_db(db.commit)
    await run_db(db.refresh, db_prediction)

    low_attendance_alert = db_prediction.attendance < 70
    assignment_alert = db_prediction.assignment_status in {"delayed", "overdue"}

    await dashboard_ws_manager.broadcast(
        {
            "type": "prediction_created",
            "payload": {
                "id": db_prediction.id,
                "user_id": db_prediction.user_id,
                "attendance": db_prediction.attendance,
                "study_hours": db_prediction.study_hours,
                "sleep": db_prediction.sleep,
                "social_media_usage": db_prediction.social_media_usage,
                "stress": db_prediction.stress,
                "assignment_status": db_prediction.assignment_status,
                "risk_result": db_prediction.risk_result,
                "confidence_score": db_prediction.confidence_score,
                "cgpa_forecast": db_prediction.cgpa_forecast,
                "dropout_risk": db_prediction.dropout_risk,
                "weak_subjects": weak_subjects,
                "date": db_prediction.date.isoformat(),
                "alerts": {
                    "low_attendance": low_attendance_alert,
                    "upcoming_assignments": assignment_alert,
                },
            },
        }
    )

    # Send notification
    title = f"Prediction Complete - Risk: {prediction}"
    message = f"Your prediction shows {prediction} risk with {confidence * 100:.1f}% confidence. CGPA forecast: {cgpa_forecast}"
    await create_and_send_notification(
        db,
        current_user.id,
        "prediction_complete",
        title,
        message,
        {
            "prediction_id": db_prediction.id,
            "risk_result": prediction,
            "confidence_score": float(confidence),
            "cgpa_forecast": float(cgpa_forecast),
            "dropout_risk": dropout_risk,
        },
    )

    return schemas.PredictionResponse(
        risk_result=prediction,
        confidence_score=confidence,
        prediction_id=db_prediction.id,
        cgpa_forecast=cgpa_forecast,
        dropout_risk=dropout_risk,
        weak_subjects=weak_subjects,
    )


@app.post("/save-prediction", response_model=schemas.PredictionResponse)
async def save_prediction(
    request: schemas.PredictionRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    return await save_prediction_internal(request, db, current_user)


@app.post("/predict", response_model=schemas.PredictionResponse)
async def predict_alias(
    request: schemas.PredictionRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    return await save_prediction_internal(request, db, current_user)


@app.get("/get-history", response_model=list[schemas.PredictionHistory])
async def get_history(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if is_admin_user(current_user):
        return await run_db(
            lambda: db.query(models.PredictionHistory)
            .order_by(models.PredictionHistory.date.desc())
            .all()
        )
    return await run_db(
        lambda: db.query(models.PredictionHistory)
        .filter(models.PredictionHistory.user_id == current_user.id)
        .order_by(models.PredictionHistory.date.desc())
        .all()
    )


@app.get("/history/{user_id}", response_model=list[schemas.PredictionHistory])
async def get_history_by_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    if current_user.id != user_id and not is_admin_user(current_user):
        raise HTTPException(status_code=403, detail="Not authorized to access this history")
    return await run_db(
        lambda: db.query(models.PredictionHistory)
        .filter(models.PredictionHistory.user_id == user_id)
        .order_by(models.PredictionHistory.date.desc())
        .all()
    )


@app.get("/admin/students")
async def get_admin_students(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if not is_admin_user(current_user):
        raise HTTPException(status_code=403, detail="Admin privileges required")

    users = await run_db(lambda: db.query(models.User).all())
    summaries = []
    for user in users:
        profile = await get_or_create_profile(db, user.id)
        latest = await run_db(
            lambda: db.query(models.PredictionHistory)
            .filter(models.PredictionHistory.user_id == user.id)
            .order_by(models.PredictionHistory.date.desc())
            .first()
        )
        history = await run_db(
            lambda: db.query(models.PredictionHistory)
            .filter(models.PredictionHistory.user_id == user.id)
            .order_by(models.PredictionHistory.date.desc())
            .limit(10)
            .all()
        )
        summaries.append(
            {
                "user_id": user.id,
                "email": user.email,
                "full_name": profile.full_name or "Unknown Student",
                "student_id": profile.student_id or "",
                "department": profile.department or "",
                "target_cgpa": profile.target_cgpa,
                "latestPrediction": {
                    "risk_result": latest.risk_result if latest else None,
                    "study_hours": latest.study_hours if latest else None,
                    "sleep": latest.sleep if latest else None,
                    "stress": latest.stress if latest else None,
                    "created_at": latest.date.isoformat() if latest and latest.date else None,
                } if latest else None,
                "predictions": [
                    {
                        "id": row.id,
                        "attendance": row.attendance,
                        "study_hours": row.study_hours,
                        "sleep": row.sleep,
                        "social_media_usage": row.social_media_usage,
                        "stress": row.stress,
                        "assignment_status": row.assignment_status,
                        "risk_result": row.risk_result,
                        "confidence_score": row.confidence_score,
                        "cgpa_forecast": row.cgpa_forecast,
                        "dropout_risk": row.dropout_risk,
                        "weak_subjects": row.weak_subjects,
                        "created_at": row.date.isoformat() if row.date else None,
                    }
                    for row in history
                ],
            }
        )
    return summaries


@app.get("/admin/student-dashboard/{user_id}")
async def get_admin_student_dashboard(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    if not is_admin_user(current_user):
        raise HTTPException(status_code=403, detail="Admin privileges required")

    user = await run_db(lambda: db.query(models.User).filter(models.User.id == user_id).first())
    if not user:
        raise HTTPException(status_code=404, detail="Student not found")

    return await dashboard_v1(db, user)


@app.get("/history/export/csv")
async def export_history_csv(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    rows = await run_db(
        lambda: db.query(models.PredictionHistory)
        .filter(models.PredictionHistory.user_id == current_user.id)
        .order_by(models.PredictionHistory.date.desc())
        .all()
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Date",
        "Attendance",
        "Study Hours",
        "Sleep",
        "Social Media",
        "Stress",
        "Assignment Status",
        "Risk",
        "Confidence",
        "CGPA Forecast",
        "Dropout Risk",
        "Weak Subjects",
    ])
    for r in rows:
        writer.writerow([
            r.date.isoformat(),
            r.attendance,
            r.study_hours,
            r.sleep,
            r.social_media_usage,
            r.stress,
            r.assignment_status,
            r.risk_result,
            r.confidence_score,
            r.cgpa_forecast,
            r.dropout_risk,
            r.weak_subjects,
        ])

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=prediction_history.csv"},
    )


@app.get("/history/export/pdf")
async def export_history_pdf(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    rows = await run_db(
        lambda: db.query(models.PredictionHistory)
        .filter(models.PredictionHistory.user_id == current_user.id)
        .order_by(models.PredictionHistory.date.desc())
        .all()
    )

    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    y = height - 40
    pdf.setFont("Helvetica-Bold", 14)
    pdf.drawString(40, y, "EduPredict AI - Prediction History")
    y -= 24
    pdf.setFont("Helvetica", 9)

    for r in rows[:50]:
        line = (
            f"{r.date.strftime('%Y-%m-%d %H:%M')} | Risk: {r.risk_result} | "
            f"Conf: {round((r.confidence_score or 0) * 100, 1)}% | "
            f"CGPA: {r.cgpa_forecast or 'N/A'} | Dropout: {r.dropout_risk or 'N/A'}"
        )
        pdf.drawString(40, y, line)
        y -= 14
        if y < 40:
            pdf.showPage()
            y = height - 40
            pdf.setFont("Helvetica", 9)

    pdf.save()
    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=prediction_history.pdf"},
    )


@app.get("/analytics/advanced", response_model=schemas.AdvancedAnalyticsResponse)
async def advanced_analytics(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    latest = await run_db(
        lambda: db.query(models.PredictionHistory)
        .filter(models.PredictionHistory.user_id == current_user.id)
        .order_by(models.PredictionHistory.date.desc())
        .first()
    )
    if not latest:
        return schemas.AdvancedAnalyticsResponse(
            cgpa_forecast=0.0,
            dropout_risk="Low",
            weak_subjects=["No data yet"],
            peer_benchmark=[],
            model_accuracy=MODEL_ACCURACY,
        )

    student_hist = await run_db(
        lambda: db.query(models.PredictionHistory).filter(models.PredictionHistory.user_id == current_user.id).all()
    )
    class_hist = await run_db(lambda: db.query(models.PredictionHistory).all())

    def avg(values):
        return float(sum(values) / len(values)) if values else 0.0

    peer = [
        schemas.PeerMetric(
            metric="Attendance",
            student_value=avg([x.attendance for x in student_hist]),
            class_average=avg([x.attendance for x in class_hist]),
        ),
        schemas.PeerMetric(
            metric="Study Hours",
            student_value=avg([x.study_hours for x in student_hist]),
            class_average=avg([x.study_hours for x in class_hist]),
        ),
        schemas.PeerMetric(
            metric="Sleep Hours",
            student_value=avg([x.sleep for x in student_hist]),
            class_average=avg([x.sleep for x in class_hist]),
        ),
        schemas.PeerMetric(
            metric="Stress",
            student_value=avg([x.stress for x in student_hist]),
            class_average=avg([x.stress for x in class_hist]),
        ),
    ]

    return schemas.AdvancedAnalyticsResponse(
        cgpa_forecast=latest.cgpa_forecast or 0.0,
        dropout_risk=latest.dropout_risk or "Low",
        weak_subjects=(latest.weak_subjects or "").split(",") if latest.weak_subjects else ["No data yet"],
        peer_benchmark=peer,
        model_accuracy=MODEL_ACCURACY,
    )


@app.get("/resources", response_model=list[schemas.ResourceItem])
async def get_resources(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    latest = await run_db(
        lambda: db.query(models.PredictionHistory)
        .filter(models.PredictionHistory.user_id == current_user.id)
        .order_by(models.PredictionHistory.date.desc())
        .first()
    )
    subjects = (latest.weak_subjects or "").split(",") if latest and latest.weak_subjects else []
    return resource_map(subjects)


@app.get("/notifications", response_model=list[schemas.NotificationItem])
async def get_notifications(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    latest = await run_db(
        lambda: db.query(models.PredictionHistory)
        .filter(models.PredictionHistory.user_id == current_user.id)
        .order_by(models.PredictionHistory.date.desc())
        .first()
    )
    if not latest:
        return []

    items = []
    if latest.attendance < 70:
        items.append(schemas.NotificationItem(title="Low Attendance", detail="Attendance is below 70%.", severity="high"))
    if latest.assignment_status in {"delayed", "overdue"}:
        items.append(
            schemas.NotificationItem(
                title="Upcoming Assignments",
                detail=f"Assignment status is {latest.assignment_status}.",
                severity="medium",
            )
        )
    return items


@app.get("/schedule/weekly", response_model=list[schemas.StudyScheduleItem])
async def get_weekly_schedule(
    persist: bool = Query(default=False),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    latest = await run_db(
        lambda: db.query(models.PredictionHistory)
        .filter(models.PredictionHistory.user_id == current_user.id)
        .order_by(models.PredictionHistory.date.desc())
        .first()
    )
    risk = latest.risk_result if latest else "Medium"
    schedule = build_schedule(risk)

    if persist:
        await run_db(lambda: db.query(models.StudySchedule).filter(models.StudySchedule.user_id == current_user.id).delete())
        for item in schedule:
            db.add(models.StudySchedule(user_id=current_user.id, day_of_week=item.day_of_week, suggested_study_hours=item.suggested_study_hours))
        await run_db(db.commit)

    return schedule


@app.get("/get-profile", response_model=schemas.UserProfileResponse)
async def get_profile(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return await get_or_create_profile(db, current_user.id)


@app.put("/update-profile", response_model=schemas.UserProfileResponse)
async def update_profile(payload: schemas.UserProfileUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    profile = await get_or_create_profile(db, current_user.id)
    profile.full_name = payload.full_name
    profile.student_id = payload.student_id
    profile.department = payload.department
    profile.target_cgpa = payload.target_cgpa
    profile.profile_picture = payload.profile_picture
    await run_db(db.commit)
    await run_db(db.refresh, profile)
    await broadcast_dashboard_event("profile_updated", current_user.id)
    return profile


@app.get("/ai-suggestions", response_model=list[schemas.SuggestionItem])
async def get_ai_suggestions(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    history = await run_db(
        lambda: db.query(models.PredictionHistory)
        .filter(models.PredictionHistory.user_id == current_user.id)
        .order_by(models.PredictionHistory.date.desc())
        .limit(20)
        .all()
    )
    latest = history[0] if history else None
    return build_study_suggestions(latest, history)


@app.get("/study-suggestions", response_model=list[schemas.SuggestionItem])
async def get_study_suggestions(
    language: str = Query("english", description="Preferred language for YouTube suggestions: english, hindi, or bangla"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    history = await run_db(
        lambda: db.query(models.PredictionHistory)
        .filter(models.PredictionHistory.user_id == current_user.id)
        .order_by(models.PredictionHistory.date.desc())
        .limit(20)
        .all()
    )
    latest = history[0] if history else None
    return build_study_suggestions(latest, history, language)


@app.post("/habits/log", response_model=schemas.HabitResponse)
async def save_habit_log(payload: schemas.HabitCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    habit = models.HabitLog(user_id=current_user.id, title=payload.title, status=payload.status)
    db.add(habit)
    await run_db(db.commit)
    await run_db(db.refresh, habit)
    await broadcast_dashboard_event("habit_created", current_user.id, {"habit_id": habit.id})
    return habit


@app.get("/habits", response_model=list[schemas.HabitResponse])
async def get_habits(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return await run_db(
        lambda: db.query(models.HabitLog)
        .filter(models.HabitLog.user_id == current_user.id)
        .order_by(models.HabitLog.date.desc())
        .all()
    )


@app.post("/mood/log", response_model=schemas.MoodResponse)
async def save_mood_log(payload: schemas.MoodCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    mood = models.MoodLog(
        user_id=current_user.id,
        mood_score=payload.mood_score,
        mood_emoji=payload.mood_emoji,
        note=payload.note,
    )
    db.add(mood)
    await run_db(db.commit)
    await run_db(db.refresh, mood)
    return mood


@app.get("/mood/logs", response_model=list[schemas.MoodResponse])
async def get_mood_logs(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return await run_db(
        lambda: db.query(models.MoodLog)
        .filter(models.MoodLog.user_id == current_user.id)
        .order_by(models.MoodLog.date.asc())
        .all()
    )


@app.post("/pomodoro/log", response_model=schemas.PomodoroSessionResponse)
async def save_pomodoro_log(
    payload: schemas.PomodoroSessionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    session = models.PomodoroSession(
        user_id=current_user.id,
        focus_minutes=payload.focus_minutes,
        break_minutes=payload.break_minutes,
        completed=payload.completed,
    )
    db.add(session)
    await run_db(db.commit)
    await run_db(db.refresh, session)
    await broadcast_dashboard_event("pomodoro_logged", current_user.id, {"session_id": session.id})
    return session


@app.get("/pomodoro/logs", response_model=list[schemas.PomodoroSessionResponse])
async def get_pomodoro_logs(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return await run_db(
        lambda: db.query(models.PomodoroSession)
        .filter(models.PomodoroSession.user_id == current_user.id)
        .order_by(models.PomodoroSession.created_at.desc())
        .all()
    )


@app.get("/chat/logs", response_model=list[schemas.ChatLogResponse])
async def get_chat_logs(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return await run_db(
        lambda: db.query(models.ChatLog)
        .filter(models.ChatLog.user_id == current_user.id)
        .order_by(models.ChatLog.created_at.asc())
        .all()
    )


@app.post("/dataset/import", response_model=schemas.StudentDatasetImportSummary)
async def import_dataset_endpoint(
    file_path: str = Query(default="ml_logic/bd_students_5000.csv"),
):
    csv_path = Path(file_path)
    if not csv_path.is_absolute():
        csv_path = Path(script_dir) / csv_path

    if not csv_path.exists():
        raise HTTPException(status_code=404, detail=f"CSV file not found: {csv_path}")

    imported, skipped = await run_db(import_dataset, csv_path)
    return schemas.StudentDatasetImportSummary(
        imported_count=imported,
        skipped_count=skipped,
        source_file=str(csv_path),
    )


@app.post("/predict/performance", response_model=schemas.PerformancePredictionResponse)
async def predict_performance(
    payload: schemas.PerformancePredictionRequest,
    db: Session = Depends(get_db),
):
    if not academic_models:
        raise HTTPException(status_code=503, detail="Academic models are not ready")

    student = (
        db.query(models.StudentDatasetRecord)
        .filter(models.StudentDatasetRecord.student_id == payload.student_id)
        .first()
    )
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    behavior_score = float(payload.behavior_score)
    input_frame = pd.DataFrame(
        [
            {
                "study_hours_per_day": payload.study_hours_per_day,
                "attendance_percentage": payload.attendance_percentage,
                "behavior_score": behavior_score,
                "subjects_count": len(payload.subjects),
                "cgpa": student.cgpa,
                "university_type": student.university_type,
                "preferred_study_time": student.preferred_study_time,
            }
        ]
    )

    predicted = float(academic_models["performance"].predict(input_frame)[0])
    predicted = round(max(0.0, min(100.0, predicted)), 2)

    prediction_row = models.MlPrediction(
        student_id=student.student_id,
        model_name="RandomForestRegressor",
        predicted_exam_score=predicted,
        confidence_score=None,
        input_snapshot=to_json(input_frame.to_dict(orient="records")[0]),
    )
    primary_subject = payload.subjects[0] if payload.subjects else "General"
    consistency_score = round(
        payload.attendance_percentage * 0.6 + min(10.0, payload.study_hours_per_day) * 10 * 0.4,
        2,
    )
    performance_log = models.PerformanceLog(
        student_id=student.student_id,
        subject=primary_subject,
        score=predicted,
        study_hours=payload.study_hours_per_day,
        attendance_percentage=payload.attendance_percentage,
        device_usage_time=student.device_usage_time,
        consistency_score=consistency_score,
    )
    db.add(prediction_row)
    db.add(performance_log)
    await run_db(db.commit)

    return schemas.PerformancePredictionResponse(
        student_id=student.student_id,
        predicted_exam_score=predicted,
        confidence_score=None,
    )


@app.post("/predict/trend", response_model=schemas.TrendPredictionResponse)
async def predict_score_trend(
    payload: schemas.TrendPredictionRequest,
    db: Session = Depends(get_db),
):
    if not academic_models:
        raise HTTPException(status_code=503, detail="Academic models are not ready")

    student = (
        db.query(models.StudentDatasetRecord)
        .filter(models.StudentDatasetRecord.student_id == payload.student_id)
        .first()
    )
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    next_score, slope = predict_trend(
        academic_models["trend"],
        payload.historical_scores,
        student.attendance_percentage,
        student.study_hours_per_day,
    )
    direction = "Improving" if slope > 0.15 else "Declining" if slope < -0.15 else "Stable"

    return schemas.TrendPredictionResponse(
        student_id=student.student_id,
        next_score_prediction=next_score,
        slope=slope,
        trend_direction=direction,
    )


@app.post("/cluster", response_model=schemas.ClusterResponse)
async def cluster_student(
    student_id: str = Query(...),
    db: Session = Depends(get_db),
):
    if not academic_models:
        raise HTTPException(status_code=503, detail="Academic models are not ready")

    student = (
        db.query(models.StudentDatasetRecord)
        .filter(models.StudentDatasetRecord.student_id == student_id)
        .first()
    )
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    behavior_score = student_behavior_score(student)
    matrix = pd.DataFrame(
        [
            {
                "exam_score": student.exam_score,
                "study_hours_per_day": student.study_hours_per_day,
                "attendance_percentage": student.attendance_percentage,
                "device_usage_time": student.device_usage_time,
                "behavior_score": behavior_score,
                "cgpa": student.cgpa,
            }
        ]
    )
    transformed = academic_models["cluster_scaler"].transform(matrix)
    cluster_id = int(academic_models["cluster"].predict(transformed)[0])
    centers = academic_models["cluster"].cluster_centers_
    cluster_map = label_clusters(centers)
    label = cluster_map.get(cluster_id, "Average")
    dist = float(np.linalg.norm(transformed[0] - centers[cluster_id]))

    cluster_row = models.StudentCluster(
        student_id=student.student_id,
        cluster_id=cluster_id,
        cluster_label=label,
        distance_to_centroid=round(dist, 4),
    )
    db.add(cluster_row)
    await run_db(db.commit)

    return schemas.ClusterResponse(student_id=student.student_id, cluster_id=cluster_id, cluster_label=label)


@app.post("/risk-analysis", response_model=schemas.RiskAnalysisResponse)
async def risk_analysis(
    payload: schemas.RiskAnalysisRequest,
    db: Session = Depends(get_db),
):
    student = (
        db.query(models.StudentDatasetRecord)
        .filter(models.StudentDatasetRecord.student_id == payload.student_id)
        .first()
    )
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    reasons = []
    risk_points = 0
    if payload.predicted_exam_score < 45:
        risk_points += 3
        reasons.append("Predicted score is critically low")
    elif payload.predicted_exam_score < 60:
        risk_points += 2
        reasons.append("Predicted score is below target")

    if payload.attendance_percentage < 70:
        risk_points += 2
        reasons.append("Attendance is below 70%")
    if payload.study_hours_per_day < 2.5:
        risk_points += 2
        reasons.append("Daily study time is low")
    if student.device_usage_time > 7:
        risk_points += 1
        reasons.append("High device usage may affect concentration")

    risk_level = "Low"
    if risk_points >= 5:
        risk_level = "High"
    elif risk_points >= 3:
        risk_level = "Medium"

    row = models.RiskAnalysis(
        student_id=student.student_id,
        predicted_exam_score=payload.predicted_exam_score,
        risk_level=risk_level,
        risk_reasons=",".join(reasons),
        threshold_used=50.0,
    )
    db.add(row)
    await run_db(db.commit)

    return schemas.RiskAnalysisResponse(student_id=student.student_id, risk_level=risk_level, risk_reasons=reasons)


@app.get("/analysis/weak-subjects/{student_id}", response_model=list[schemas.WeakSubjectItem])
async def weak_subject_detection(student_id: str, db: Session = Depends(get_db)):
    student = (
        db.query(models.StudentDatasetRecord)
        .filter(models.StudentDatasetRecord.student_id == student_id)
        .first()
    )
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return analyze_weak_subjects(student)


@app.get("/analysis/behavior/{student_id}", response_model=schemas.BehaviorAnalysisResponse)
async def student_behavior_analysis(student_id: str, db: Session = Depends(get_db)):
    student = (
        db.query(models.StudentDatasetRecord)
        .filter(models.StudentDatasetRecord.student_id == student_id)
        .first()
    )
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    consistency = round((student.attendance_percentage * 0.6 + min(10, student.study_hours_per_day) * 10 * 0.4), 2)
    if student.device_usage_time >= 7:
        impact = "High"
        summary = "Device usage is high; reduce distraction windows during study blocks."
    elif student.device_usage_time >= 4:
        impact = "Moderate"
        summary = "Balanced behavior with room to reduce non-study screen time."
    else:
        impact = "Low"
        summary = "Good behavior pattern with focused device usage."

    return schemas.BehaviorAnalysisResponse(
        student_id=student.student_id,
        study_consistency=consistency,
        behavior_summary=summary,
        device_impact_level=impact,
    )


@app.get("/analysis/performance-trend/{student_id}", response_model=schemas.PerformanceTrendResponse)
async def performance_trend_analysis(student_id: str, db: Session = Depends(get_db)):
    student = (
        db.query(models.StudentDatasetRecord)
        .filter(models.StudentDatasetRecord.student_id == student_id)
        .first()
    )
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    scores = parse_scores(student.historical_scores)
    if not scores:
        scores = [student.exam_score]
    slope = scores[-1] - scores[0]
    direction = "Improving" if slope > 1.5 else "Declining" if slope < -1.5 else "Stable"
    points = [schemas.PerformanceTrendPoint(index=index + 1, score=round(value, 2)) for index, value in enumerate(scores)]
    return schemas.PerformanceTrendResponse(student_id=student.student_id, trend_direction=direction, points=points)


@app.post("/revision/plan", response_model=schemas.RevisionPlanResponse)
async def create_revision_plan(payload: schemas.RevisionPlanRequest, db: Session = Depends(get_db)):
    student = (
        db.query(models.StudentDatasetRecord)
        .filter(models.StudentDatasetRecord.student_id == payload.student_id)
        .first()
    )
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    start_date = payload.base_date or datetime.utcnow()
    day_offsets = [1, 3, 7, 14]
    if payload.latest_performance is not None and payload.latest_performance < 55:
        day_offsets = [1, 2, 5, 10]

    rows = []
    for day_offset in day_offsets:
        row = models.RevisionSchedule(
            student_id=student.student_id,
            subject=payload.subject,
            revision_day_offset=day_offset,
            scheduled_date=start_date + timedelta(days=day_offset),
            performance_feedback=payload.latest_performance,
            revision_status="pending",
        )
        rows.append(row)

    db.add_all(rows)
    await run_db(db.commit)
    for row in rows:
        await run_db(db.refresh, row)

    return schemas.RevisionPlanResponse(
        student_id=student.student_id,
        schedule=[
            schemas.RevisionScheduleItem(
                id=row.id,
                subject=row.subject,
                revision_day_offset=row.revision_day_offset,
                scheduled_date=row.scheduled_date,
                revision_status=row.revision_status,
            )
            for row in rows
        ],
    )


@app.post("/revision/feedback/{revision_id}", response_model=schemas.RevisionScheduleItem)
async def update_revision_feedback(
    revision_id: int,
    payload: schemas.RevisionFeedbackRequest,
    db: Session = Depends(get_db),
):
    row = db.query(models.RevisionSchedule).filter(models.RevisionSchedule.id == revision_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Revision schedule not found")

    score = payload.score if payload.score is not None else payload.performance_feedback
    if score is None:
        raise HTTPException(status_code=422, detail="Either score or performance_feedback is required")

    row.performance_feedback = float(score)
    row.revision_status = "completed" if score >= 60 else "retry_needed"
    if score < 60:
        row.scheduled_date = row.scheduled_date + timedelta(days=2)
    await run_db(db.commit)
    await run_db(db.refresh, row)

    return schemas.RevisionScheduleItem(
        id=row.id,
        subject=row.subject,
        revision_day_offset=row.revision_day_offset,
        scheduled_date=row.scheduled_date,
        revision_status=row.revision_status,
    )


@app.get("/analytics/dashboard/{student_id}", response_model=schemas.AnalyticsDashboardResponse)
async def analytics_dashboard(student_id: str, db: Session = Depends(get_db)):
    student = (
        db.query(models.StudentDatasetRecord)
        .filter(models.StudentDatasetRecord.student_id == student_id)
        .first()
    )
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    scores = parse_scores(student.historical_scores)
    if not scores:
        scores = [student.exam_score]
    points = [schemas.PerformanceTrendPoint(index=index + 1, score=round(value, 2)) for index, value in enumerate(scores)]

    weak_items = analyze_weak_subjects(student)
    subject_scores = {item.subject: item.average_score for item in weak_items}
    for strong_subject in [item.strip() for item in student.strong_subjects.split(",") if item.strip()]:
        subject_scores.setdefault(strong_subject, round(min(100.0, student.exam_score + 6.0), 2))

    study_vs_score = []
    for idx, score in enumerate(scores):
        study_vs_score.append({"study_hours": round(max(0.5, student.study_hours_per_day * (0.85 + idx * 0.04)), 2), "score": round(score, 2)})

    weekly_report, monthly_report = build_reports(student)
    report_row = models.AnalyticsReport(
        student_id=student.student_id,
        report_type="combined",
        report_period="weekly-monthly",
        report_payload=to_json({"weekly": weekly_report, "monthly": monthly_report}),
    )
    db.add(report_row)
    await run_db(db.commit)

    return schemas.AnalyticsDashboardResponse(
        student_id=student.student_id,
        performance_over_time=points,
        subject_scores=subject_scores,
        study_vs_score=study_vs_score,
        heatmap=build_heatmap(student),
        weekly_report=weekly_report,
        monthly_report=monthly_report,
    )


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "edupredict-api"}


@app.get("/api/v1/dashboard")
async def dashboard_v1(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    profile = await get_or_create_profile(db, current_user.id)
    history = await run_db(
        lambda: db.query(models.PredictionHistory)
        .filter(models.PredictionHistory.user_id == current_user.id)
        .order_by(models.PredictionHistory.date.desc())
        .limit(20)
        .all()
    )

    habits = await run_db(
        lambda: db.query(models.HabitLog)
        .filter(models.HabitLog.user_id == current_user.id)
        .order_by(models.HabitLog.date.desc())
        .limit(10)
        .all()
    )

    pomodoro_sessions = await run_db(
        lambda: db.query(models.PomodoroSession)
        .filter(models.PomodoroSession.user_id == current_user.id)
        .order_by(models.PomodoroSession.created_at.desc())
        .limit(10)
        .all()
    )

    latest = history[0] if history else None
    notifications = []
    if latest:
        if latest.attendance < 70:
            notifications.append(
                {
                    "title": "Low Attendance",
                    "detail": "Attendance is below 70%.",
                    "severity": "high",
                }
            )
        if latest.assignment_status in {"delayed", "overdue"}:
            notifications.append(
                {
                    "title": "Upcoming Assignments",
                    "detail": f"Assignment status is {latest.assignment_status}.",
                    "severity": "medium",
                }
            )

    schedule = build_schedule(latest.risk_result if latest else "Medium")
    study_suggestions = build_study_suggestions(latest, history)
    return {
        "server_status": "online",
        "risk": latest.risk_result if latest else "Low",
        "history": [
            {
                "id": row.id,
                "date": row.date.isoformat() if row.date else None,
                "attendance": row.attendance,
                "study_hours": row.study_hours,
                "sleep": row.sleep,
                "stress": row.stress,
                "assignment_status": row.assignment_status,
                "risk_result": row.risk_result,
                "confidence_score": row.confidence_score,
            }
            for row in history
        ],
        "profile": {
            "user_id": profile.user_id,
            "full_name": profile.full_name or "",
            "student_id": profile.student_id or "",
            "department": profile.department or "",
            "target_cgpa": profile.target_cgpa,
            "profile_picture": profile.profile_picture or "",
        },
        "habits": [
            {
                "id": row.id,
                "user_id": row.user_id,
                "title": row.title,
                "status": row.status,
                "date": row.date.isoformat() if row.date else None,
            }
            for row in habits
        ],
        "notifications": notifications,
        "pomodoro_logs": [
            {
                "id": row.id,
                "user_id": row.user_id,
                "focus_minutes": row.focus_minutes,
                "break_minutes": row.break_minutes,
                "completed": row.completed,
                "created_at": row.created_at.isoformat() if row.created_at else None,
            }
            for row in pomodoro_sessions
        ],
        "weekly_schedule": [
            {
                "day_of_week": item.day_of_week,
                "suggested_study_hours": item.suggested_study_hours,
            }
            for item in schedule
        ],
        "study_suggestions": [
            {"title": item.title, "description": item.description}
            for item in study_suggestions
        ],
        "summary": {
            "latest_confidence": latest.confidence_score if latest else 0,
            "latest_attendance": latest.attendance if latest else 0,
            "latest_study_hours": latest.study_hours if latest else 0,
        },
    }


@app.get("/get-dashboard-data")
async def get_dashboard_data(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return await dashboard_v1(db, current_user)


@app.get("/model/accuracy")
def get_model_accuracy():
    return {"accuracy": MODEL_ACCURACY}


@app.get("/")
def read_root():
    return {"message": "Welcome to EduPredict AI API"}


@app.get("/notifications", response_model=list[schemas.NotificationResponse])
async def get_notifications(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
    limit: int = Query(20, ge=1, le=100),
):
    """Fetch user's notifications with optional limit."""
    notifications = (
        db.query(models.Notification)
        .filter(models.Notification.user_id == current_user.id)
        .order_by(models.Notification.created_at.desc())
        .limit(limit)
        .all()
    )
    return notifications


@app.post("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    """Mark a notification as read."""
    notification = (
        db.query(models.Notification)
        .filter(
            models.Notification.id == notification_id,
            models.Notification.user_id == current_user.id,
        )
        .first()
    )
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    notification.is_read = True
    notification.read_at = datetime.utcnow()
    db.commit()
    return {"status": "ok"}


@app.post("/notifications/read-all")
async def mark_all_notifications_read(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    """Mark all notifications as read."""
    db.query(models.Notification).filter(
        models.Notification.user_id == current_user.id,
        models.Notification.is_read == False,
    ).update(
        {
            models.Notification.is_read: True,
            models.Notification.read_at: datetime.utcnow(),
        }
    )
    db.commit()
    return {"status": "ok"}


@app.get("/notifications/unread-count")
async def get_unread_count(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    """Get count of unread notifications."""
    count = db.query(models.Notification).filter(
        models.Notification.user_id == current_user.id,
        models.Notification.is_read == False,
    ).count()
    return {"unread_count": count}


@app.post("/notifications/study-plan-ready/{plan_id}")
async def notify_study_plan_ready(
    plan_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    """Create and send a notification when study plan is ready."""
    plan = db.query(models.StudyPlan).filter(
        models.StudyPlan.id == plan_id,
        models.StudyPlan.user_id == current_user.id,
    ).first()
    
    if not plan:
        raise HTTPException(status_code=404, detail="Study plan not found")
    
    await create_and_send_notification(
        db,
        current_user.id,
        "study_plan_ready",
        f"Study Plan Ready: {plan.title}",
        f"Your personalized study plan is ready! {plan.adaptive_difficulty} difficulty based on your performance.",
        {
            "plan_id": plan.id,
            "plan_title": plan.title,
            "difficulty": plan.adaptive_difficulty,
            "weekly_hours": float(plan.weekly_target_hours),
        },
    )
    
    return {"status": "ok", "message": "Notification sent"}


@app.websocket("/ws/notifications/{user_id}")
async def notifications_ws(websocket: WebSocket, user_id: int):
    """WebSocket endpoint for real-time notifications."""
    await notification_ws_manager.connect(user_id, websocket)
    try:
        while True:
            msg = await websocket.receive_text()
            if msg.strip().lower() == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        notification_ws_manager.disconnect(user_id, websocket)
    except Exception:
        notification_ws_manager.disconnect(user_id, websocket)


@app.websocket("/ws/dashboard")
async def dashboard_ws(websocket: WebSocket):
    await dashboard_ws_manager.connect(websocket)
    try:
        while True:
            msg = await websocket.receive_text()
            if msg == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        dashboard_ws_manager.disconnect(websocket)
    except Exception:
        dashboard_ws_manager.disconnect(websocket)


async def handle_chat_websocket(websocket: WebSocket, user_id: int):
    await chat_ws_manager.connect(user_id, websocket)
    db = SessionLocal()
    try:
        await chat_ws_manager.send_to_user(
            user_id,
            {
                "type": "bot_message",
                "payload": {
                    "text": "Connected. Ask me about your risk trend, weak subjects, or study plan.",
                    "timestamp": "now",
                },
            },
        )

        while True:
            text_msg = await websocket.receive_text()
            if text_msg.strip().lower() == "ping":
                await websocket.send_json({"type": "pong"})
                continue

            await persist_chat_message(db, user_id, "user", text_msg)
            latest = await run_db(
                lambda: db.query(models.PredictionHistory)
                .filter(models.PredictionHistory.user_id == user_id)
                .order_by(models.PredictionHistory.date.desc())
                .first()
            )
            response_text = risk_tip_from_latest_prediction(text_msg, latest)
            await persist_chat_message(db, user_id, "bot", response_text)

            await chat_ws_manager.send_to_user(
                user_id,
                {"type": "bot_message", "payload": {"text": response_text, "timestamp": "now"}},
            )
    except WebSocketDisconnect:
        chat_ws_manager.disconnect(user_id, websocket)
    except Exception:
        chat_ws_manager.disconnect(user_id, websocket)
    finally:
        db.close()


@app.websocket("/ws/chat")
async def chat_ws(websocket: WebSocket):
    user_id_raw = websocket.query_params.get("user_id")
    if not user_id_raw:
        await websocket.close(code=4401)
        return

    try:
        user_id = int(user_id_raw)
    except ValueError:
        await websocket.close(code=4402)
        return

    await handle_chat_websocket(websocket, user_id)


@app.websocket("/ws/chat/{user_id}")
async def chat_ws_legacy(websocket: WebSocket, user_id: int):
    await handle_chat_websocket(websocket, user_id)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)

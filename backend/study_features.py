from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

import auth
import models
import schemas
from database import get_db

router = APIRouter(tags=["study-features"])


# Helper to convert list values into a comma-separated DB string.
def _join_list(values: list[str] | None) -> str:
    return ",".join([value.strip() for value in (values or []) if value and value.strip()])


# Helper to convert comma-separated DB strings back into Python lists.
def _split_csv(value: str | None) -> list[str]:
    if not value:
        return []
    return [part.strip() for part in value.split(",") if part.strip()]


# Difficulty is adapted from exam score and attendance to keep plan intensity realistic.
def _difficulty_from_metrics(exam_score: float, attendance_percentage: float) -> tuple[str, str]:
    if exam_score < 55 or attendance_percentage < 65:
        return "High Support", "Low score/attendance detected; increasing guided repetition blocks."
    if exam_score < 72 or attendance_percentage < 78:
        return "Medium", "Average performance detected; balancing revision and practice sessions."
    return "Advanced", "Strong baseline detected; allocating deeper practice and challenge sessions."


# Build a practical daily/weekly schedule with higher time for weak subjects.
def _build_schedule_rows(plan_id: int, user_id: int, payload: schemas.SmartPlannerRequest, adaptive_difficulty: str):
    day_order = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    subjects = payload.subjects or ["General"]
    weak = set(payload.weak_subjects or [])

    total_minutes = max(60, int(payload.available_hours_per_day * 60))
    weighted_subjects = []
    for subject in subjects:
        weight = 1.4 if subject in weak else 1.0
        weighted_subjects.append((subject, weight))

    total_weight = sum(weight for _, weight in weighted_subjects)
    rows = []
    for day in day_order:
        start_minute = 18 * 60  # Default study start time for university students (Evening)
        for idx, (subject, weight) in enumerate(weighted_subjects, start=1):
            planned = max(30, int(total_minutes * (weight / total_weight)))
            hour = (start_minute // 60) % 24
            minute = start_minute % 60
            start_time = f"{hour:02d}:{minute:02d}"
            rows.append(
                models.Schedule(
                    user_id=user_id,
                    study_plan_id=plan_id,
                    schedule_scope="weekly",
                    day_of_week=day,
                    subject=subject,
                    start_time=start_time,
                    planned_minutes=planned,
                    difficulty_level=adaptive_difficulty,
                    is_completed=False,
                )
            )
            start_minute += planned + 10
            if idx >= 3:
                break

    return rows


# Convert DB plan model to response shape with list-based subject fields.
def _to_plan_response(plan: models.StudyPlan) -> schemas.StudyPlanResponse:
    return schemas.StudyPlanResponse(
        id=plan.id,
        user_id=plan.user_id,
        title=plan.title,
        class_level=plan.class_level,
        subjects=_split_csv(plan.subjects),
        weak_subjects=_split_csv(plan.weak_subjects),
        strong_subjects=_split_csv(plan.strong_subjects),
        available_hours_per_day=plan.available_hours_per_day,
        exam_score=plan.exam_score,
        attendance_percentage=plan.attendance_percentage,
        adaptive_difficulty=plan.adaptive_difficulty,
        weekly_target_hours=plan.weekly_target_hours,
        is_active=plan.is_active,
        created_at=plan.created_at,
        updated_at=plan.updated_at,
    )


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
    return normalized


def _youtube_search_url(subject: str, language: str) -> str:
    query_subject = "+".join(subject.strip().split())
    query_language = {
        "english": "english",
        "hindi": "hindi",
        "bangla": "bangla",
    }.get(language, "english")
    query = f"{query_subject}+{query_language}+tutorial"
    return f"https://www.youtube.com/results?search_query={query}"


def _subject_video_map(subject: str, language: str) -> str:
    # Use the student's selected subject directly to build the search URL,
    # instead of returning a fixed channel for a broad topic.
    normalized_subject = subject.strip()
    if not normalized_subject:
        return _youtube_search_url("study skills", language)

    return _youtube_search_url(normalized_subject, language)


def _youtube_recommendations_for_plan(plan: models.StudyPlan, language: str) -> list[schemas.ResourceItem]:
    weak_subjects = _split_csv(plan.weak_subjects)
    if not weak_subjects:
        weak_subjects = _split_csv(plan.subjects)

    language = _normalize_language(language)
    if language not in {"english", "hindi", "bangla"}:
        raise HTTPException(status_code=400, detail="Language must be english, hindi, or bangla")

    recommendations: list[schemas.ResourceItem] = []
    for subject in weak_subjects:
        if not subject or not subject.strip():
            continue
        recommendations.append(
            schemas.ResourceItem(
                subject=subject.strip(),
                youtube_url=_subject_video_map(subject, language),
                pdf_url="",
            )
        )
    return recommendations


@router.post("/planner/generate", response_model=schemas.SmartPlannerResponse)
def generate_smart_study_plan(
    payload: schemas.SmartPlannerRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    adaptive_difficulty, adaptive_reason = _difficulty_from_metrics(payload.exam_score, payload.attendance_percentage)
    weekly_target_hours = round(payload.available_hours_per_day * 7, 2)

    # Create a new personalized study plan for the logged-in student.
    plan = models.StudyPlan(
        user_id=current_user.id,
        title=f"Smart Plan - {payload.class_level}",
        class_level=payload.class_level,
        subjects=_join_list(payload.subjects),
        weak_subjects=_join_list(payload.weak_subjects),
        strong_subjects=_join_list(payload.strong_subjects),
        available_hours_per_day=payload.available_hours_per_day,
        exam_score=payload.exam_score,
        attendance_percentage=payload.attendance_percentage,
        adaptive_difficulty=adaptive_difficulty,
        weekly_target_hours=weekly_target_hours,
        is_active=True,
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)

    # Auto-generate weekly schedule rows linked to this plan.
    schedule_rows = _build_schedule_rows(plan.id, current_user.id, payload, adaptive_difficulty)
    db.add_all(schedule_rows)
    db.commit()

    all_weekly = (
        db.query(models.Schedule)
        .filter(models.Schedule.user_id == current_user.id, models.Schedule.study_plan_id == plan.id)
        .order_by(models.Schedule.day_of_week.asc(), models.Schedule.start_time.asc())
        .all()
    )
    daily_rows = [row for row in all_weekly if row.day_of_week == "Monday"]

    return schemas.SmartPlannerResponse(
        plan=_to_plan_response(plan),
        daily_schedule=[schemas.ScheduleResponse.model_validate(item) for item in daily_rows],
        weekly_schedule=[schemas.ScheduleResponse.model_validate(item) for item in all_weekly],
        suggested_focus_minutes=25 if adaptive_difficulty != "High Support" else 20,
        adaptive_reason=adaptive_reason,
    )


@router.post("/planner/adapt/{plan_id}", response_model=schemas.StudyPlanResponse)
def adapt_study_plan(
    plan_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    plan = (
        db.query(models.StudyPlan)
        .filter(models.StudyPlan.id == plan_id, models.StudyPlan.user_id == current_user.id)
        .first()
    )
    if not plan:
        raise HTTPException(status_code=404, detail="Study plan not found")

    recent_progress = (
        db.query(models.ProgressTracking)
        .filter(models.ProgressTracking.user_id == current_user.id)
        .order_by(models.ProgressTracking.track_date.desc())
        .limit(7)
        .all()
    )

    # Adapt plan targets using recent consistency and focus activity trends.
    if recent_progress:
        avg_consistency = sum(row.consistency_score for row in recent_progress) / len(recent_progress)
        avg_focus = sum(row.active_minutes for row in recent_progress) / len(recent_progress)
        if avg_consistency < 55 or avg_focus < 90:
            plan.adaptive_difficulty = "High Support"
            plan.available_hours_per_day = min(6.0, plan.available_hours_per_day + 0.5)
        elif avg_consistency > 80 and avg_focus > 150:
            plan.adaptive_difficulty = "Advanced"
            plan.available_hours_per_day = min(7.0, plan.available_hours_per_day + 0.25)
        else:
            plan.adaptive_difficulty = "Medium"
    else:
        plan.adaptive_difficulty = plan.adaptive_difficulty or "Medium"

    plan.weekly_target_hours = round(plan.available_hours_per_day * 7, 2)
    db.commit()
    db.refresh(plan)
    return _to_plan_response(plan)


@router.post("/study-plans", response_model=schemas.StudyPlanResponse)
def create_study_plan(
    payload: schemas.StudyPlanCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    adaptive_difficulty, _ = _difficulty_from_metrics(payload.exam_score, payload.attendance_percentage)
    study_plan = models.StudyPlan(
        user_id=current_user.id,
        title=payload.title,
        class_level=payload.class_level,
        subjects=_join_list(payload.subjects),
        weak_subjects=_join_list(payload.weak_subjects),
        strong_subjects=_join_list(payload.strong_subjects),
        available_hours_per_day=payload.available_hours_per_day,
        exam_score=payload.exam_score,
        attendance_percentage=payload.attendance_percentage,
        adaptive_difficulty=adaptive_difficulty,
        weekly_target_hours=round(payload.available_hours_per_day * 7, 2),
        is_active=True,
    )
    db.add(study_plan)
    db.commit()
    db.refresh(study_plan)
    return _to_plan_response(study_plan)


@router.get("/study-plans", response_model=list[schemas.StudyPlanResponse])
def list_study_plans(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    plans = (
        db.query(models.StudyPlan)
        .filter(models.StudyPlan.user_id == current_user.id)
        .order_by(models.StudyPlan.updated_at.desc())
        .all()
    )
    return [_to_plan_response(plan) for plan in plans]


@router.get("/study-plans/{plan_id}", response_model=schemas.StudyPlanResponse)
def get_study_plan(
    plan_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    plan = (
        db.query(models.StudyPlan)
        .filter(models.StudyPlan.id == plan_id, models.StudyPlan.user_id == current_user.id)
        .first()
    )
    if not plan:
        raise HTTPException(status_code=404, detail="Study plan not found")
    return _to_plan_response(plan)


@router.get("/study-plans/{plan_id}/youtube-videos", response_model=list[schemas.ResourceItem])
def get_youtube_recommendations(
    plan_id: int,
    language: str = Query("english", description="Preferred language for YouTube tutorials: english, hindi, or bangla"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    plan = (
        db.query(models.StudyPlan)
        .filter(models.StudyPlan.id == plan_id, models.StudyPlan.user_id == current_user.id)
        .first()
    )
    if not plan:
        raise HTTPException(status_code=404, detail="Study plan not found")

    return _youtube_recommendations_for_plan(plan, language)


@router.put("/study-plans/{plan_id}", response_model=schemas.StudyPlanResponse)
def update_study_plan(
    plan_id: int,
    payload: schemas.StudyPlanUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    plan = (
        db.query(models.StudyPlan)
        .filter(models.StudyPlan.id == plan_id, models.StudyPlan.user_id == current_user.id)
        .first()
    )
    if not plan:
        raise HTTPException(status_code=404, detail="Study plan not found")

    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        if key in {"subjects", "weak_subjects", "strong_subjects"}:
            setattr(plan, key, _join_list(value))
        else:
            setattr(plan, key, value)

    if "available_hours_per_day" in data:
        plan.weekly_target_hours = round(plan.available_hours_per_day * 7, 2)

    db.commit()
    db.refresh(plan)
    return _to_plan_response(plan)


@router.delete("/study-plans/{plan_id}")
def delete_study_plan(
    plan_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    plan = (
        db.query(models.StudyPlan)
        .filter(models.StudyPlan.id == plan_id, models.StudyPlan.user_id == current_user.id)
        .first()
    )
    if not plan:
        raise HTTPException(status_code=404, detail="Study plan not found")
    db.delete(plan)
    db.commit()
    return {"message": "Study plan deleted"}


@router.post("/schedules/auto-generate", response_model=list[schemas.ScheduleResponse])
def auto_generate_schedule(
    plan_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    plan = (
        db.query(models.StudyPlan)
        .filter(models.StudyPlan.id == plan_id, models.StudyPlan.user_id == current_user.id)
        .first()
    )
    if not plan:
        raise HTTPException(status_code=404, detail="Study plan not found")

    # Replace existing schedule rows so regeneration remains deterministic.
    db.query(models.Schedule).filter(
        models.Schedule.user_id == current_user.id,
        models.Schedule.study_plan_id == plan.id,
    ).delete()

    request_proxy = schemas.SmartPlannerRequest(
        class_level=plan.class_level,
        subjects=_split_csv(plan.subjects),
        weak_subjects=_split_csv(plan.weak_subjects),
        strong_subjects=_split_csv(plan.strong_subjects),
        available_hours_per_day=plan.available_hours_per_day,
        exam_score=plan.exam_score,
        attendance_percentage=plan.attendance_percentage,
    )
    rows = _build_schedule_rows(plan.id, current_user.id, request_proxy, plan.adaptive_difficulty)
    db.add_all(rows)
    db.commit()

    generated = (
        db.query(models.Schedule)
        .filter(models.Schedule.user_id == current_user.id, models.Schedule.study_plan_id == plan.id)
        .order_by(models.Schedule.day_of_week.asc(), models.Schedule.start_time.asc())
        .all()
    )
    return [schemas.ScheduleResponse.model_validate(item) for item in generated]


@router.post("/schedules", response_model=schemas.ScheduleResponse)
def create_schedule(
    payload: schemas.ScheduleCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    if payload.study_plan_id:
        plan = (
            db.query(models.StudyPlan)
            .filter(models.StudyPlan.id == payload.study_plan_id, models.StudyPlan.user_id == current_user.id)
            .first()
        )
        if not plan:
            raise HTTPException(status_code=400, detail="Invalid study_plan_id")

    row = models.Schedule(user_id=current_user.id, **payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return schemas.ScheduleResponse.model_validate(row)


@router.get("/schedules", response_model=list[schemas.ScheduleResponse])
def list_schedules(
    plan_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    query = db.query(models.Schedule).filter(models.Schedule.user_id == current_user.id)
    if plan_id is not None:
        query = query.filter(models.Schedule.study_plan_id == plan_id)
    rows = query.order_by(models.Schedule.created_at.desc()).all()
    return [schemas.ScheduleResponse.model_validate(item) for item in rows]


@router.get("/schedules/{schedule_id}", response_model=schemas.ScheduleResponse)
def get_schedule(
    schedule_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    row = (
        db.query(models.Schedule)
        .filter(models.Schedule.id == schedule_id, models.Schedule.user_id == current_user.id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return schemas.ScheduleResponse.model_validate(row)


@router.put("/schedules/{schedule_id}", response_model=schemas.ScheduleResponse)
def update_schedule(
    schedule_id: int,
    payload: schemas.ScheduleUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    row = (
        db.query(models.Schedule)
        .filter(models.Schedule.id == schedule_id, models.Schedule.user_id == current_user.id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Schedule not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(row, key, value)
    db.commit()
    db.refresh(row)
    return schemas.ScheduleResponse.model_validate(row)


@router.delete("/schedules/{schedule_id}")
def delete_schedule(
    schedule_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    row = (
        db.query(models.Schedule)
        .filter(models.Schedule.id == schedule_id, models.Schedule.user_id == current_user.id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Schedule not found")
    db.delete(row)
    db.commit()
    return {"message": "Schedule deleted"}


@router.post("/tasks", response_model=schemas.TaskResponse)
def create_task(
    payload: schemas.TaskCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    if payload.schedule_id:
        schedule = (
            db.query(models.Schedule)
            .filter(models.Schedule.id == payload.schedule_id, models.Schedule.user_id == current_user.id)
            .first()
        )
        if not schedule:
            raise HTTPException(status_code=400, detail="Invalid schedule_id")

    task = models.Task(user_id=current_user.id, **payload.model_dump())
    db.add(task)
    db.commit()
    db.refresh(task)
    return schemas.TaskResponse.model_validate(task)


@router.get("/tasks", response_model=list[schemas.TaskResponse])
def list_tasks(
    status: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    query = db.query(models.Task).filter(models.Task.user_id == current_user.id)
    if status:
        query = query.filter(models.Task.status == status)
    rows = query.order_by(models.Task.created_at.desc()).all()
    return [schemas.TaskResponse.model_validate(item) for item in rows]


@router.get("/tasks/{task_id}", response_model=schemas.TaskResponse)
def get_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    row = db.query(models.Task).filter(models.Task.id == task_id, models.Task.user_id == current_user.id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Task not found")
    return schemas.TaskResponse.model_validate(row)


@router.put("/tasks/{task_id}", response_model=schemas.TaskResponse)
def update_task(
    task_id: int,
    payload: schemas.TaskUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    row = db.query(models.Task).filter(models.Task.id == task_id, models.Task.user_id == current_user.id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Task not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(row, key, value)
    db.commit()
    db.refresh(row)
    return schemas.TaskResponse.model_validate(row)


@router.delete("/tasks/{task_id}")
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    row = db.query(models.Task).filter(models.Task.id == task_id, models.Task.user_id == current_user.id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(row)
    db.commit()
    return {"message": "Task deleted"}


@router.post("/progress-tracking", response_model=schemas.ProgressTrackingResponse)
def create_progress_tracking(
    payload: schemas.ProgressTrackingCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    if payload.study_plan_id:
        plan = (
            db.query(models.StudyPlan)
            .filter(models.StudyPlan.id == payload.study_plan_id, models.StudyPlan.user_id == current_user.id)
            .first()
        )
        if not plan:
            raise HTTPException(status_code=400, detail="Invalid study_plan_id")
    if payload.task_id:
        task = db.query(models.Task).filter(models.Task.id == payload.task_id, models.Task.user_id == current_user.id).first()
        if not task:
            raise HTTPException(status_code=400, detail="Invalid task_id")

    track_payload = payload.model_dump(exclude_unset=True)
    track_payload["track_date"] = track_payload.get("track_date") or datetime.utcnow()
    row = models.ProgressTracking(user_id=current_user.id, **track_payload)
    db.add(row)
    db.commit()
    db.refresh(row)
    return schemas.ProgressTrackingResponse.model_validate(row)


@router.get("/progress-tracking", response_model=list[schemas.ProgressTrackingResponse])
def list_progress_tracking(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    rows = (
        db.query(models.ProgressTracking)
        .filter(models.ProgressTracking.user_id == current_user.id)
        .order_by(models.ProgressTracking.track_date.desc())
        .all()
    )
    return [schemas.ProgressTrackingResponse.model_validate(item) for item in rows]


@router.put("/progress-tracking/{entry_id}", response_model=schemas.ProgressTrackingResponse)
def update_progress_tracking(
    entry_id: int,
    payload: schemas.ProgressTrackingUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    row = (
        db.query(models.ProgressTracking)
        .filter(models.ProgressTracking.id == entry_id, models.ProgressTracking.user_id == current_user.id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Progress entry not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(row, key, value)
    db.commit()
    db.refresh(row)
    return schemas.ProgressTrackingResponse.model_validate(row)


@router.delete("/progress-tracking/{entry_id}")
def delete_progress_tracking(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    row = (
        db.query(models.ProgressTracking)
        .filter(models.ProgressTracking.id == entry_id, models.ProgressTracking.user_id == current_user.id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Progress entry not found")
    db.delete(row)
    db.commit()
    return {"message": "Progress entry deleted"}


@router.get("/progress/summary", response_model=schemas.ProgressSummaryResponse)
def get_progress_summary(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    progress = (
        db.query(models.ProgressTracking)
        .filter(models.ProgressTracking.user_id == current_user.id)
        .order_by(models.ProgressTracking.track_date.desc())
        .limit(30)
        .all()
    )
    tasks = db.query(models.Task).filter(models.Task.user_id == current_user.id).all()

    if not progress:
        return schemas.ProgressSummaryResponse(
            streak_count=0,
            weekly_performance=0,
            attendance_average=0,
            active_minutes_total=0,
            idle_minutes_total=0,
            completed_tasks=sum(1 for t in tasks if t.status == "Completed"),
            partial_tasks=sum(1 for t in tasks if t.status == "Partial"),
            not_done_tasks=sum(1 for t in tasks if t.status == "Not Done"),
        )

    attendance_average = round(sum(item.attendance_percentage for item in progress) / len(progress), 2)
    active_minutes_total = sum(item.active_minutes for item in progress)
    idle_minutes_total = sum(item.idle_minutes for item in progress)
    weekly_performance = round(sum(item.weekly_performance for item in progress[:7]) / max(1, len(progress[:7])), 2)
    streak_count = max((item.streak_count for item in progress), default=0)

    return schemas.ProgressSummaryResponse(
        streak_count=streak_count,
        weekly_performance=weekly_performance,
        attendance_average=attendance_average,
        active_minutes_total=active_minutes_total,
        idle_minutes_total=idle_minutes_total,
        completed_tasks=sum(1 for t in tasks if t.status == "Completed"),
        partial_tasks=sum(1 for t in tasks if t.status == "Partial"),
        not_done_tasks=sum(1 for t in tasks if t.status == "Not Done"),
    )


@router.post("/reminders", response_model=schemas.ReminderResponse)
def create_reminder(
    payload: schemas.ReminderCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    if payload.task_id:
        task = db.query(models.Task).filter(models.Task.id == payload.task_id, models.Task.user_id == current_user.id).first()
        if not task:
            raise HTTPException(status_code=400, detail="Invalid task_id")

    row = models.Reminder(user_id=current_user.id, **payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return schemas.ReminderResponse.model_validate(row)


@router.get("/reminders", response_model=list[schemas.ReminderResponse])
def list_reminders(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    rows = (
        db.query(models.Reminder)
        .filter(models.Reminder.user_id == current_user.id)
        .order_by(models.Reminder.remind_at.asc())
        .all()
    )
    return [schemas.ReminderResponse.model_validate(item) for item in rows]


@router.get("/reminders/due", response_model=list[schemas.ReminderResponse])
def due_reminders(
    within_minutes: int = Query(default=60, ge=1, le=1440),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    now = datetime.utcnow()
    until = now + timedelta(minutes=within_minutes)

    # Smart reminder filter returns pending reminders due soon.
    rows = (
        db.query(models.Reminder)
        .filter(
            models.Reminder.user_id == current_user.id,
            models.Reminder.is_sent.is_(False),
            models.Reminder.remind_at >= now,
            models.Reminder.remind_at <= until,
        )
        .order_by(models.Reminder.remind_at.asc())
        .all()
    )
    return [schemas.ReminderResponse.model_validate(item) for item in rows]


@router.put("/reminders/{reminder_id}", response_model=schemas.ReminderResponse)
def update_reminder(
    reminder_id: int,
    payload: schemas.ReminderUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    row = (
        db.query(models.Reminder)
        .filter(models.Reminder.id == reminder_id, models.Reminder.user_id == current_user.id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Reminder not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(row, key, value)
    db.commit()
    db.refresh(row)
    return schemas.ReminderResponse.model_validate(row)


@router.delete("/reminders/{reminder_id}")
def delete_reminder(
    reminder_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    row = (
        db.query(models.Reminder)
        .filter(models.Reminder.id == reminder_id, models.Reminder.user_id == current_user.id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Reminder not found")
    db.delete(row)
    db.commit()
    return {"message": "Reminder deleted"}


@router.post("/activity-logs", response_model=schemas.ActivityLogResponse)
def create_activity_log(
    payload: schemas.ActivityLogCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    row = models.ActivityLog(user_id=current_user.id, **payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return schemas.ActivityLogResponse.model_validate(row)


@router.get("/activity-logs", response_model=list[schemas.ActivityLogResponse])
def list_activity_logs(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    rows = (
        db.query(models.ActivityLog)
        .filter(models.ActivityLog.user_id == current_user.id)
        .order_by(models.ActivityLog.started_at.desc())
        .all()
    )
    return [schemas.ActivityLogResponse.model_validate(item) for item in rows]


@router.put("/activity-logs/{log_id}", response_model=schemas.ActivityLogResponse)
def update_activity_log(
    log_id: int,
    payload: schemas.ActivityLogUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    row = (
        db.query(models.ActivityLog)
        .filter(models.ActivityLog.id == log_id, models.ActivityLog.user_id == current_user.id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Activity log not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(row, key, value)
    db.commit()
    db.refresh(row)
    return schemas.ActivityLogResponse.model_validate(row)


@router.delete("/activity-logs/{log_id}")
def delete_activity_log(
    log_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    row = (
        db.query(models.ActivityLog)
        .filter(models.ActivityLog.id == log_id, models.ActivityLog.user_id == current_user.id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Activity log not found")
    db.delete(row)
    db.commit()
    return {"message": "Activity log deleted"}

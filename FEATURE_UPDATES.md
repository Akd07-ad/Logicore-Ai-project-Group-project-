# EduPredict AI - Feature Update Notes

## 1) Smart Study Planning System

### Added backend entities
- study_plans
- schedules
- tasks
- progress_tracking
- reminders
- activity_logs

### Added smart planning APIs
- POST /planner/generate
- POST /planner/adapt/{plan_id}
- POST /schedules/auto-generate?plan_id={id}

### Added CRUD APIs
- Study plans: POST/GET/GET by id/PUT/DELETE on /study-plans
- Schedules: POST/GET/GET by id/PUT/DELETE on /schedules
- Tasks: POST/GET/GET by id/PUT/DELETE on /tasks
- Progress: POST/GET/PUT/DELETE on /progress-tracking
- Reminders: POST/GET/GET due/PUT/DELETE on /reminders
- Activity logs: POST/GET/PUT/DELETE on /activity-logs

## 2) Progress Tracking System

### Implemented
- Daily task statuses: Completed / Partial / Not Done
- Consistency and weekly performance summary via GET /progress/summary
- Real-time study activity logs with active and idle minutes via /activity-logs
- Reminder system with due-window query via GET /reminders/due

## 3) Bangladesh Dataset (2000 Students)

### Dataset file
- backend/ml_logic/bd_students_2000.csv

### Generator script
- backend/ml_logic/generate_bd_student_dataset.py

### Import script
- backend/import_student_dataset.py

### Commands
From backend folder:
1. python ml_logic/generate_bd_student_dataset.py
2. python import_student_dataset.py

(Use your configured venv interpreter in this project.)

## 4) Frontend Extensions (existing UI extended, not rebuilt)

### Added pages
- /study-planner
- /task-tracker
- /focus-mode
- /reminders

### Integrated into existing dashboard
- Quick navigation buttons from Student Dashboard to all new modules

## 5) Notes
- Existing project structure is preserved.
- Existing features remain intact.
- New APIs are protected with current auth flow.
- New code includes inline comments for key logic blocks.

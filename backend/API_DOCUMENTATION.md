# EduPredict AI - Extended API Documentation

## ML and AI

### POST /predict/performance
Predicts exam score using Random Forest and writes records to `ml_predictions` and `performance_logs`.

Request:
```json
{
  "student_id": "BD00001",
  "study_hours_per_day": 4.2,
  "attendance_percentage": 85,
  "behavior_score": 0.78,
  "subjects": ["Math", "Physics", "ICT"]
}
```

Response:
```json
{
  "student_id": "BD00001",
  "predicted_exam_score": 74.2,
  "confidence_score": null
}
```

### POST /predict/trend
Predicts next score using Linear Regression from historical scores.

Request:
```json
{
  "student_id": "BD00001",
  "historical_scores": [60, 64, 68, 72]
}
```

Response:
```json
{
  "student_id": "BD00001",
  "next_score_prediction": 74.7,
  "slope": 4.0,
  "trend_direction": "Improving"
}
```

### POST /cluster?student_id=BD00001
Runs K-Means clustering and stores latest cluster entry.

Response:
```json
{
  "student_id": "BD00001",
  "cluster_id": 2,
  "cluster_label": "High Performer"
}
```

### POST /risk-analysis
Calculates academic risk level using threshold logic and persists to `risk_analysis`.

Request:
```json
{
  "student_id": "BD00001",
  "predicted_exam_score": 55,
  "attendance_percentage": 72,
  "study_hours_per_day": 3.1
}
```

Response:
```json
{
  "student_id": "BD00001",
  "risk_level": "Medium",
  "risk_reasons": [
    "Predicted score is below target"
  ]
}
```

## Analysis

### GET /analysis/weak-subjects/{student_id}
Returns weak subject insights and trend labels.

### GET /analysis/behavior/{student_id}
Returns study consistency, behavior summary, and device impact level.

### GET /analysis/performance-trend/{student_id}
Returns time-series points and trend direction.

## Smart Revision

### POST /revision/plan
Generates spaced repetition schedule and stores in `revision_schedule`.

Request:
```json
{
  "student_id": "BD00001",
  "subject": "Math",
  "latest_performance": 62
}
```

Response includes schedule on Day 1, Day 3, Day 7, Day 14.

### POST /revision/feedback/{revision_id}
Updates revision status and auto-adjusts next date for low scores.

## Analytics Dashboard

### GET /analytics/dashboard/{student_id}
Returns:
- `performance_over_time` (line chart)
- `subject_scores` (bar chart)
- `study_vs_score` (comparison chart)
- `heatmap` (daily intensity)
- `weekly_report`
- `monthly_report`

Also writes report snapshots to `analytics_reports`.

## CSV Dataset Import

### POST /dataset/import?file_path=ml_logic/bd_students_2000.csv
Validates and imports/upserts 2000-student CSV records into `student_dataset_records`.

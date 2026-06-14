import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier
from sklearn.linear_model import LinearRegression
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, StandardScaler


MODEL_DIR = Path(__file__).resolve().parent
PERFORMANCE_MODEL_PATH = MODEL_DIR / "performance_rf.joblib"
TREND_MODEL_PATH = MODEL_DIR / "trend_lr.joblib"
CLUSTER_MODEL_PATH = MODEL_DIR / "cluster_kmeans.joblib"
CLUSTER_SCALER_PATH = MODEL_DIR / "cluster_scaler.joblib"
CLUSTER_COLUMNS_PATH = MODEL_DIR / "cluster_columns.joblib"
RISK_MODEL_PATH = MODEL_DIR / "risk_clf.joblib"


def _coalesce_columns(frame: pd.DataFrame, aliases: list[tuple[str, list[str]]]) -> pd.DataFrame:
    for canonical, candidates in aliases:
        if canonical in frame.columns:
            continue
        source = next((name for name in candidates if name in frame.columns), None)
        if source is None:
            raise ValueError(f"Missing required column: {canonical}")
        frame[canonical] = frame[source]
    return frame


def _parse_historical_scores(value: str) -> list[float]:
    if not value:
        return []
    values = []
    for item in value.split(","):
        token = item.strip()
        if not token:
            continue
        try:
            values.append(float(token))
        except ValueError:
            continue
    return values


def _behavior_score(device_usage_time: float, attendance_percentage: float, study_hours_per_day: float) -> float:
    score = (0.45 * attendance_percentage) + (0.35 * min(12.0, study_hours_per_day) * 8.33) + (0.20 * max(0.0, 100.0 - device_usage_time * 7.0))
    return round(score / 100.0, 4)


def load_training_frame(csv_path: Path) -> pd.DataFrame:
    frame = pd.read_csv(csv_path)
    frame = _coalesce_columns(
        frame,
        [
            ("university_name", ["institution_name"]),
            ("university_type", ["institution_type"]),
            ("cgpa", ["predicted_cgpa"]),
            ("risk_level", ["risk_result"]),
        ],
    )
    if "university_type" not in frame.columns:
        # Legacy datasets only include institution names, so infer a stable fallback category.
        frame["university_type"] = "Private"
    if "cgpa" not in frame.columns:
        score = pd.to_numeric(frame.get("exam_score", 0), errors="coerce").fillna(0.0)
        frame["cgpa"] = (score / 25.0).clip(lower=0.0, upper=4.0)
    if "risk_level" not in frame.columns:
        frame["risk_level"] = "Medium"
    frame["university_type"] = frame["university_type"].astype(str).replace("", "Private").fillna("Private")
    frame["cgpa"] = pd.to_numeric(frame["cgpa"], errors="coerce").fillna(3.0).clip(lower=0.0, upper=4.0)
    frame["risk_level"] = frame["risk_level"].astype(str).replace("", "Medium").fillna("Medium")
    # Ensure semester/year is cleaned if used, but let's focus on other features
    frame["subjects_count"] = frame["subjects"].fillna("").apply(lambda x: len([item for item in str(x).split(",") if item.strip()]))
    frame["behavior_score"] = frame.apply(
        lambda row: _behavior_score(
            float(row.get("device_usage_time", 0.0)),
            float(row.get("attendance_percentage", 0.0)),
            float(row.get("study_hours_per_day", 0.0)),
        ),
        axis=1,
    )
    frame["historical_scores_list"] = frame["historical_scores"].fillna("").apply(_parse_historical_scores)
    frame["historical_last"] = frame["historical_scores_list"].apply(lambda seq: float(seq[-1]) if seq else 0.0)
    frame["historical_mean"] = frame["historical_scores_list"].apply(
        lambda seq: float(np.mean(seq)) if seq else 0.0
    )
    return frame


def train_models(csv_path: Path) -> dict:
    frame = load_training_frame(csv_path)

    # Feature columns for regression and classification
    feature_columns = [
        "study_hours_per_day",
        "attendance_percentage",
        "behavior_score",
        "subjects_count",
        "cgpa",
        "university_type",
        "preferred_study_time",
    ]
    categorical = ["university_type", "preferred_study_time"]
    numeric = ["study_hours_per_day", "attendance_percentage", "behavior_score", "subjects_count", "cgpa"]

    preprocessor = ColumnTransformer(
        transformers=[
            ("num", StandardScaler(), numeric),
            ("cat", OneHotEncoder(handle_unknown="ignore"), categorical),
        ]
    )

    # 1. Random Forest -> Performance Prediction (Exam Score)
    performance_model = Pipeline(
        steps=[
            ("preprocess", preprocessor),
            ("model", RandomForestRegressor(n_estimators=240, random_state=42)),
        ]
    )
    performance_model.fit(frame[feature_columns], frame["exam_score"])
    joblib.dump(performance_model, PERFORMANCE_MODEL_PATH)

    # 2. Linear Regression -> Score Trend Prediction
    trend_frame = frame[["historical_mean", "historical_last", "attendance_percentage", "study_hours_per_day", "exam_score"]].copy()
    trend_model = LinearRegression()
    trend_model.fit(
        trend_frame[["historical_mean", "historical_last", "attendance_percentage", "study_hours_per_day"]],
        trend_frame["exam_score"],
    )
    joblib.dump(trend_model, TREND_MODEL_PATH)

    # 3. K-Means -> Student Clustering
    cluster_columns = ["exam_score", "study_hours_per_day", "attendance_percentage", "device_usage_time", "behavior_score", "cgpa"]
    cluster_scaler = StandardScaler()
    cluster_matrix = cluster_scaler.fit_transform(frame[cluster_columns])
    cluster_model = KMeans(n_clusters=3, random_state=42, n_init=20)
    cluster_model.fit(cluster_matrix)

    joblib.dump(cluster_model, CLUSTER_MODEL_PATH)
    joblib.dump(cluster_scaler, CLUSTER_SCALER_PATH)
    joblib.dump(cluster_columns, CLUSTER_COLUMNS_PATH)

    # 4. Classification Model -> Academic Risk Detection
    risk_model = Pipeline(
        steps=[
            ("preprocess", preprocessor),
            ("model", RandomForestClassifier(n_estimators=200, random_state=42)),
        ]
    )
    risk_model.fit(frame[feature_columns], frame["risk_level"])
    joblib.dump(risk_model, RISK_MODEL_PATH)

    return {
        "rows": int(len(frame)),
        "feature_columns": feature_columns,
        "cluster_columns": cluster_columns,
    }


def ensure_models(csv_path: Path) -> None:
    # Always retrain if we are rebuilding the system
    train_models(csv_path)


def load_models() -> dict:
    return {
        "performance": joblib.load(PERFORMANCE_MODEL_PATH),
        "trend": joblib.load(TREND_MODEL_PATH),
        "cluster": joblib.load(CLUSTER_MODEL_PATH),
        "cluster_scaler": joblib.load(CLUSTER_SCALER_PATH),
        "cluster_columns": joblib.load(CLUSTER_COLUMNS_PATH),
        "risk": joblib.load(RISK_MODEL_PATH),
    }


def label_clusters(centers: np.ndarray) -> dict[int, str]:
    # Cluster centers are sorted by exam score to map to stable semantic labels.
    scored = sorted(list(enumerate(centers)), key=lambda item: item[1][0])
    mapping = {}
    labels = ["At Risk", "Average", "High Performer"]
    for index, (cluster_id, _) in enumerate(scored):
        mapping[int(cluster_id)] = labels[index]
    return mapping


def predict_trend(trend_model: LinearRegression, historical_scores: list[float], attendance: float, study_hours: float) -> tuple[float, float]:
    if len(historical_scores) < 2:
        raise ValueError("historical_scores must have at least 2 entries")

    values = np.array(historical_scores, dtype=float)
    x = np.arange(len(values)).reshape(-1, 1)
    slope_model = LinearRegression().fit(x, values)
    slope = float(slope_model.coef_[0])

    features = pd.DataFrame(
        [
            {
                "historical_mean": float(np.mean(values)),
                "historical_last": float(values[-1]),
                "attendance_percentage": float(attendance),
                "study_hours_per_day": float(study_hours),
            }
        ]
    )
    next_prediction = float(trend_model.predict(features)[0])
    return max(0.0, min(100.0, round(next_prediction, 2))), round(slope, 4)


def to_json(value: dict | list) -> str:
    return json.dumps(value, ensure_ascii=True)

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import inspect, text

import models
from database import engine


def run_migration() -> None:
    # Create all declared tables first.
    models.Base.metadata.create_all(bind=engine)

    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())

    with engine.begin() as conn:
        # Backfill columns for existing deployments.
        if "student_dataset_records" in table_names:
            dataset_cols = {col["name"] for col in inspector.get_columns("student_dataset_records")}
            dataset_missing = {
                "university_name": "VARCHAR DEFAULT ''",
                "university_type": "VARCHAR DEFAULT 'Private'",
                "department": "VARCHAR DEFAULT 'General'",
                "semester_year": "VARCHAR DEFAULT 'Year 1, Spring'",
                "cgpa": "FLOAT DEFAULT 3.0",
                "risk_level": "VARCHAR DEFAULT 'Medium'",
            }
            for col, ddl in dataset_missing.items():
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

        if "prediction_history" in table_names:
            prediction_cols = {col["name"] for col in inspector.get_columns("prediction_history")}
            missing = {
                "confidence_score": "FLOAT",
                "social_media_usage": "FLOAT DEFAULT 0.0",
                "assignment_status": "VARCHAR DEFAULT 'on_track'",
                "cgpa_forecast": "FLOAT",
                "dropout_risk": "VARCHAR",
                "weak_subjects": "VARCHAR",
            }
            for col, ddl in missing.items():
                if col not in prediction_cols:
                    conn.execute(text(f"ALTER TABLE prediction_history ADD COLUMN {col} {ddl}"))

        # Performance-oriented indexes.
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_ml_predictions_student_id ON ml_predictions(student_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_student_clusters_student_id ON student_clusters(student_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_risk_analysis_student_id ON risk_analysis(student_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_revision_schedule_student_id ON revision_schedule(student_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_performance_logs_student_id ON performance_logs(student_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_analytics_reports_student_id ON analytics_reports(student_id)"))


if __name__ == "__main__":
    run_migration()
    print("Migration complete")

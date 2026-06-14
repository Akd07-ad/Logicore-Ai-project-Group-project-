import argparse
import csv
from pathlib import Path

import models
from sqlalchemy import inspect, text
from database import SessionLocal, engine


REQUIRED_FIELDS = {
    "student_id",
    "name",
    "gender",
    "university_name",
    "university_type",
    "department",
    "subjects",
    "semester/year",
    "cgpa",
    "study_hours_per_day",
    "weak_subjects",
    "strong_subjects",
    "exam_score",
    "attendance_percentage",
    "district",
    "device_usage_time",
    "preferred_study_time",
    "historical_scores",
    "risk_level",
}


def _parse_historical_scores(raw_value: str) -> str:
    values = [item.strip() for item in (raw_value or "").split(",") if item.strip()]
    parsed = []
    for value in values:
        parsed.append(round(float(value), 2))

    if len(parsed) < 3:
        raise ValueError("historical_scores must contain at least 3 numeric values")

    for value in parsed:
        if value < 0 or value > 100:
            raise ValueError("historical_scores must be between 0 and 100")

    return ",".join(str(item) for item in parsed)


def _validate_row(row: dict) -> None:
    missing = [field for field in REQUIRED_FIELDS if field not in row]
    if missing:
        raise ValueError(f"Missing required fields: {', '.join(sorted(missing))}")

    if row["university_type"].strip() not in {"Public", "Private"}:
        raise ValueError("university_type must be Public or Private")

    if row["risk_level"].strip() not in {"Low", "Medium", "High"}:
        raise ValueError("risk_level must be Low, Medium, or High")

    cgpa = float(row["cgpa"])
    if cgpa < 0 or cgpa > 4:
        raise ValueError("cgpa must be between 0.0 and 4.0")

    for numeric_field in ["study_hours_per_day", "exam_score", "attendance_percentage", "device_usage_time"]:
        value = float(row[numeric_field])
        if value < 0:
            raise ValueError(f"{numeric_field} cannot be negative")


# This script imports the generated Bangladesh student CSV into the database.
def import_dataset(csv_path: Path) -> tuple[int, int]:
    models.Base.metadata.create_all(bind=engine)

    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())
    if "student_dataset_records" in table_names:
        existing_cols = {col["name"] for col in inspector.get_columns("student_dataset_records")}
        missing_cols = {
            "university_name": "VARCHAR DEFAULT ''",
            "university_type": "VARCHAR DEFAULT 'Private'",
            "department": "VARCHAR DEFAULT 'General'",
            "semester_year": "VARCHAR DEFAULT 'Year 1, Spring'",
            "cgpa": "FLOAT DEFAULT 3.0",
            "risk_level": "VARCHAR DEFAULT 'Medium'",
            "historical_scores": "VARCHAR DEFAULT ''",
        }
        if any(col not in existing_cols for col in missing_cols):
            with engine.begin() as conn:
                for col, ddl in missing_cols.items():
                    if col not in existing_cols:
                        conn.execute(text(f"ALTER TABLE student_dataset_records ADD COLUMN {col} {ddl}"))
                conn.execute(
                    text(
                        """
                        UPDATE student_dataset_records
                        SET university_name = COALESCE(NULLIF(university_name, ''), institution_name, 'Unknown Institution')
                        """
                    )
                )
                conn.execute(text("UPDATE student_dataset_records SET university_type = COALESCE(NULLIF(university_type, ''), 'Private')"))
                conn.execute(text("UPDATE student_dataset_records SET department = COALESCE(NULLIF(department, ''), class_level, 'General')"))
                conn.execute(text("UPDATE student_dataset_records SET semester_year = COALESCE(NULLIF(semester_year, ''), 'Year 1, Spring')"))
                conn.execute(text("UPDATE student_dataset_records SET cgpa = COALESCE(cgpa, MIN(4.0, MAX(0.0, exam_score / 25.0)), 3.0)"))
                conn.execute(text("UPDATE student_dataset_records SET risk_level = COALESCE(NULLIF(risk_level, ''), 'Medium')"))

    imported_count = 0
    skipped_count = 0

    db = SessionLocal()
    try:
        with csv_path.open("r", newline="", encoding="utf-8") as csv_file:
            reader = csv.DictReader(csv_file)
            for row in reader:
                _validate_row(row)
                existing = (
                    db.query(models.StudentDatasetRecord)
                    .filter(models.StudentDatasetRecord.student_id == row["student_id"])
                    .first()
                )
                if existing:
                    existing.name = row["name"]
                    existing.gender = row["gender"]
                    existing.class_level = "University"
                    existing.institution_name = row["university_name"]
                    existing.university_name = row["university_name"]
                    existing.university_type = row["university_type"]
                    existing.department = row["department"]
                    existing.subjects = row["subjects"]
                    existing.semester_year = row["semester/year"]
                    existing.cgpa = float(row["cgpa"])
                    existing.study_hours_per_day = float(row["study_hours_per_day"])
                    existing.weak_subjects = row["weak_subjects"]
                    existing.strong_subjects = row["strong_subjects"]
                    existing.exam_score = float(row["exam_score"])
                    existing.attendance_percentage = float(row["attendance_percentage"])
                    existing.district = row["district"]
                    existing.device_usage_time = float(row["device_usage_time"])
                    existing.preferred_study_time = row["preferred_study_time"]
                    existing.historical_scores = _parse_historical_scores(row["historical_scores"])
                    existing.risk_level = row["risk_level"]
                    skipped_count += 1
                    continue

                record = models.StudentDatasetRecord(
                    student_id=row["student_id"],
                    name=row["name"],
                    gender=row["gender"],
                    class_level="University",
                    institution_name=row["university_name"],
                    university_name=row["university_name"],
                    university_type=row["university_type"],
                    department=row["department"],
                    subjects=row["subjects"],
                    semester_year=row["semester/year"],
                    cgpa=float(row["cgpa"]),
                    study_hours_per_day=float(row["study_hours_per_day"]),
                    weak_subjects=row["weak_subjects"],
                    strong_subjects=row["strong_subjects"],
                    exam_score=float(row["exam_score"]),
                    attendance_percentage=float(row["attendance_percentage"]),
                    district=row["district"],
                    device_usage_time=float(row["device_usage_time"]),
                    preferred_study_time=row["preferred_study_time"],
                    historical_scores=_parse_historical_scores(row["historical_scores"]),
                    risk_level=row["risk_level"],
                )
                db.add(record)
                imported_count += 1

            db.commit()
    finally:
        db.close()

    return imported_count, skipped_count


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Import Bangladesh university student dataset into DB")
    parser.add_argument(
        "--file",
        default="ml_logic/bd_students_5000.csv",
        help="Relative path to CSV file from backend directory",
    )
    args = parser.parse_args()

    csv_file = Path(args.file)
    if not csv_file.is_absolute():
        csv_file = Path(__file__).resolve().parent / csv_file

    if not csv_file.exists():
        raise SystemExit(f"CSV file not found: {csv_file}")

    imported, skipped = import_dataset(csv_file)
    print(f"Import complete. Imported={imported}, Skipped={skipped}, Source={csv_file}")

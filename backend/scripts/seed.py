import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from import_student_dataset import import_dataset
from scripts.migrate import run_migration


def run_seed() -> None:
    run_migration()
    csv_path = Path(__file__).resolve().parents[1] / "ml_logic" / "bd_students_5000.csv"
    imported, skipped = import_dataset(csv_path)
    print(f"Seed complete. Imported={imported}, UpdatedOrSkipped={skipped}, Source={csv_path}")


if __name__ == "__main__":
    run_seed()

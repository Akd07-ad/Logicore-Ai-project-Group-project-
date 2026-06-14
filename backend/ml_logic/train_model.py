from pathlib import Path

from academic_ml import train_models


# Trains and saves all academic ML models from the Bangladesh student dataset.
def main() -> None:
    script_dir = Path(__file__).resolve().parent
    csv_path = script_dir / "bd_students_5000.csv"
    if not csv_path.exists():
        raise SystemExit(f"Dataset not found: {csv_path}")

    stats = train_models(csv_path)
    print("Training complete")
    print(f"Rows used: {stats['rows']}")
    print("Saved models:")
    print(f"- {script_dir / 'performance_rf.joblib'}")
    print(f"- {script_dir / 'trend_lr.joblib'}")
    print(f"- {script_dir / 'cluster_kmeans.joblib'}")


if __name__ == "__main__":
    main()

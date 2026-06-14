import sqlite3
import os

db_path = os.path.join("backend", "edupredict.db")
if not os.path.exists(db_path):
    print(f"Database not found at {db_path}")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()
try:
    cursor.execute("SELECT count(*) FROM student_dataset_records;")
    count = cursor.fetchone()[0]
    print(f"Total student records: {count}")
    
    cursor.execute("SELECT * FROM student_dataset_records LIMIT 1;")
    sample = cursor.fetchone()
    print(f"Sample record: {sample}")
except Exception as e:
    print(f"Error: {e}")
finally:
    conn.close()

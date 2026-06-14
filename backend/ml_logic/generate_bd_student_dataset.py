import csv
import random
from pathlib import Path

# This script generates a Bangladesh-context university dataset with 5000 student records.
RANDOM_SEED = 20260422
TOTAL_STUDENTS = 5000

DISTRICTS = [
    "Dhaka", "Chattogram", "Rajshahi", "Khulna", "Barishal", "Sylhet", "Rangpur", "Mymensingh",
    "Cumilla", "Gazipur", "Narayanganj", "Bogura", "Kushtia", "Jessore", "Cox's Bazar", "Tangail"
]

UNIVERSITIES = {
    "Public": [
        "University of Dhaka", "BUET", "Rajshahi University", "Chittagong University",
        "Jahangirnagar University", "KUET", "RUET", "CUET", "SUST", "Noakhali Science and Technology University",
        "Jagannath University", "Comilla University", "Jatiya Kabi Kazi Nazrul Islam University"
    ],
    "Private": [
        "North South University", "BRAC University", "Independent University, Bangladesh",
        "United International University", "Daffodil International University", "American International University-Bangladesh",
        "East West University", "Ahsanullah University of Science and Technology", "University of Liberal Arts Bangladesh"
    ]
}

DEPARTMENTS = {
    "Engineering": ["CSE", "EEE", "Civil Engineering", "Mechanical Engineering", "Software Engineering", "Data Science", "AI"],
    "Business": ["BBA", "Accounting", "Finance", "Marketing", "HRM", "MIS", "Economics"],
    "Health Sciences": ["Pharmacy", "Biotechnology", "Microbiology", "Nursing"],
    "Social Sciences": ["Psychology", "Sociology", "International Relations", "Anthropology"],
    "Arts & Humanities": ["English", "History", "Philosophy", "Journalism"],
    "Law": ["LLB", "International Law"],
    "Environmental Sciences": ["Environmental Science", "Agriculture"]
}

SUBJECT_POOL = {
    "Engineering": ["Data Structures", "Algorithms", "Circuit Analysis", "Thermodynamics", "Machine Learning", "Database Systems"],
    "Business": ["Financial Accounting", "Principles of Management", "Microeconomics", "Business Law", "Marketing Strategy"],
    "Health Sciences": ["Organic Chemistry", "Human Anatomy", "Pharmacology", "Genetics", "Clinical Pharmacy"],
    "Social Sciences": ["Political Science", "Social Psychology", "Research Methodology", "World History"],
    "Arts & Humanities": ["Literary Criticism", "History of Art", "Ethics", "Mass Communication"],
    "Law": ["Constitutional Law", "Criminal Law", "Civil Procedure", "Jurisprudence"],
    "Environmental Sciences": ["Ecology", "Soil Science", "Climate Change", "Sustainable Development"]
}

MALE_FIRST_NAMES = ["Rahim", "Karim", "Sajid", "Fahim", "Naeem", "Arif", "Shakib", "Nabil", "Tanvir", "Mahmud", "Jahid", "Rafi", "Siam", "Zubayer", "Adnan", "Imtiaz"]
FEMALE_FIRST_NAMES = ["Ayesha", "Nusrat", "Sumaiya", "Farhana", "Mim", "Tanjila", "Sabina", "Nadia", "Sadia", "Jannat", "Fariha", "Mariam", "Tasnia", "Raisa", "Afia", "Nabila"]
LAST_NAMES = ["Islam", "Rahman", "Akter", "Hossain", "Ahmed", "Sarker", "Chowdhury", "Begum", "Hasan", "Khan", "Ali", "Uddin"]

def pick_name(gender: str) -> str:
    first = random.choice(FEMALE_FIRST_NAMES if gender == "Female" else MALE_FIRST_NAMES)
    last = random.choice(LAST_NAMES)
    return f"{first} {last}"

def pick_university() -> tuple[str, str]:
    u_type = random.choices(["Public", "Private"], weights=[0.4, 0.6], k=1)[0]
    u_name = random.choice(UNIVERSITIES[u_type])
    return u_name, u_type

def pick_department() -> str:
    category = random.choices(list(DEPARTMENTS.keys()), weights=[0.3, 0.2, 0.1, 0.1, 0.1, 0.1, 0.1], k=1)[0]
    return random.choice(DEPARTMENTS[category])

def pick_subjects(dept: str) -> list[str]:
    category = next((cat for cat, depts in DEPARTMENTS.items() if dept in depts), "Engineering")
    pool = SUBJECT_POOL[category]
    return random.sample(pool, k=min(len(pool), random.randint(4, 6)))

def cgpa_distribution() -> float:
    # Realistic CGPA distribution (0.00 - 4.00)
    val = random.gauss(3.2, 0.5)
    return max(2.00, min(4.00, round(val, 2)))

def semester_year() -> str:
    year = random.randint(1, 4)
    semester = random.choice(["Spring", "Summer", "Fall"])
    return f"Year {year}, {semester}"

def risk_level_logic(cgpa: float, attendance: float, study_hours: float) -> str:
    if cgpa < 2.5 or attendance < 60 or study_hours < 2:
        return "High"
    elif cgpa < 3.0 or attendance < 75 or study_hours < 4:
        return "Medium"
    return "Low"

def main() -> None:
    random.seed(RANDOM_SEED)
    output_file = Path(__file__).resolve().parent / "bd_students_5000.csv"

    headers = [
        "student_id", "name", "gender", "university_name", "university_type",
        "department", "semester/year", "cgpa", "subjects", "attendance_percentage",
        "study_hours_per_day", "weak_subjects", "strong_subjects", "district",
        "device_usage_time", "preferred_study_time", "exam_score", "historical_scores", "risk_level"
    ]

    with output_file.open("w", newline="", encoding="utf-8") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=headers)
        writer.writeheader()

        for index in range(1, TOTAL_STUDENTS + 1):
            gender = random.choices(["Male", "Female"], weights=[0.52, 0.48], k=1)[0]
            u_name, u_type = pick_university()
            dept = pick_department()
            subjects_list = pick_subjects(dept)
            cgpa = cgpa_distribution()
            attendance = max(50, min(99, round(random.gauss(80, 12), 1)))
            study_hours = max(1, min(12, round(random.gauss(5, 2), 1)))
            
            weak_count = random.randint(1, 2)
            strong_count = random.randint(1, 2)
            weak_subjects = random.sample(subjects_list, k=min(weak_count, len(subjects_list)))
            strong_pool = [s for s in subjects_list if s not in weak_subjects]
            strong_subjects = random.sample(strong_pool, k=min(strong_count, len(strong_pool))) if strong_pool else [subjects_list[0]]
            
            exam_score = max(40, min(100, round(cgpa * 25 + random.uniform(-5, 5), 1)))
            
            # Historical scores: last 5 exam scores
            history = [round(max(40, min(100, exam_score + random.uniform(-10, 5))), 1) for _ in range(4)]
            history.append(exam_score)
            historical_scores = ",".join(map(str, history))
            
            risk_level = risk_level_logic(cgpa, attendance, study_hours)

            writer.writerow({
                "student_id": f"U{index:05d}",
                "name": pick_name(gender),
                "gender": gender,
                "university_name": u_name,
                "university_type": u_type,
                "department": dept,
                "semester/year": semester_year(),
                "cgpa": cgpa,
                "subjects": ", ".join(subjects_list),
                "attendance_percentage": attendance,
                "study_hours_per_day": study_hours,
                "weak_subjects": ", ".join(weak_subjects),
                "strong_subjects": ", ".join(strong_subjects),
                "district": random.choice(DISTRICTS),
                "device_usage_time": max(1, min(14, round(random.gauss(6, 2.5), 1))),
                "preferred_study_time": random.choice(["Morning", "Afternoon", "Evening", "Night"]),
                "exam_score": exam_score,
                "historical_scores": historical_scores,
                "risk_level": risk_level
            })

    print(f"Generated dataset: {output_file}")

if __name__ == "__main__":
    main()

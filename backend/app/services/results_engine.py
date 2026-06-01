"""
Results compilation engine for ScholaNexus.
Computes student rankings, division calculations, and class analytics.
"""
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from app.models.assessment import Assessment
from app.models.student import Student
from app.models.subject import Subject, TeacherSubjectClass
from app.models.score import Score
from app.models.user import User
from app.utils.necta import (
    marks_to_grade,
    grade_to_points,
    calculate_division,
    best_seven_points,
    calculate_gpa,
)


async def compile_class_results(assessment_id: int, db: Session) -> Dict[str, Any]:
    """
    For every student in the class:
    1. Collect all submitted scores across subjects
    2. Calculate grade and points per subject
    3. Sum best-7 points, determine division
    4. Calculate average marks
    5. Rank students by average marks (handle ties)
    6. Return structured dict
    """
    # Expire all cached ORM objects so this session always reads committed data from the DB.
    # This prevents SQLAlchemy's identity-map cache from serving stale Score rows after an admin override.
    db.expire_all()
    assessment = db.query(Assessment).filter(Assessment.id == assessment_id).first()
    if not assessment:
        return {}

    students = (
        db.query(Student)
        .filter(Student.class_id == assessment.class_id, Student.is_active == True)
        .order_by(Student.last_name, Student.first_name)
        .all()
    )

    # Get all submitted scores for this assessment
    submitted_scores = (
        db.query(Score)
        .filter(Score.assessment_id == assessment_id, Score.is_submitted == True)
        .all()
    )

    # Build lookup: {student_id: {subject_id: score}}
    score_lookup: Dict[int, Dict[int, Score]] = {}
    for score in submitted_scores:
        if score.student_id not in score_lookup:
            score_lookup[score.student_id] = {}
        score_lookup[score.student_id][score.subject_id] = score

    # Get subjects assigned to this class
    assignments = (
        db.query(TeacherSubjectClass)
        .filter(TeacherSubjectClass.class_id == assessment.class_id)
        .all()
    )
    subject_ids = list({a.subject_id for a in assignments})
    subjects = db.query(Subject).filter(Subject.id.in_(subject_ids)).all()
    subject_map = {s.id: s for s in subjects}

    # Compile per-student results
    student_results = []
    for student in students:
        scores_by_subject = {}
        marks_list = []
        points_list = []

        for subject in subjects:
            score_obj = score_lookup.get(student.id, {}).get(subject.id)
            if score_obj and score_obj.marks is not None:
                g = marks_to_grade(score_obj.marks)
                p = grade_to_points(g)
                scores_by_subject[subject.id] = {
                    "subject_id": subject.id,
                    "subject_name": subject.name,
                    "subject_code": subject.code,
                    "marks": score_obj.marks,
                    "grade": g,
                    "points": p,
                }
                marks_list.append(score_obj.marks)
                points_list.append(p)
            else:
                scores_by_subject[subject.id] = {
                    "subject_id": subject.id,
                    "subject_name": subject.name,
                    "subject_code": subject.code,
                    "marks": None,
                    "grade": None,
                    "points": None,
                }

        avg_marks = round(sum(marks_list) / len(marks_list), 2) if marks_list else 0.0
        total_best7 = best_seven_points(points_list)
        division = calculate_division(total_best7, len(points_list)) if points_list else "Division 0"

        student_results.append({
            "student": {
                "id": student.id,
                "first_name": student.first_name,
                "middle_name": student.middle_name,
                "last_name": student.last_name,
                "admission_number": student.admission_number,
                "gender": student.gender.value if student.gender else "M",
            },
            "scores_by_subject": scores_by_subject,
            "avg_marks": avg_marks,
            "total_points": total_best7,
            "division": division,
            "position": 0,  # assigned after sorting
        })

    # Rank by average marks (higher is better)
    student_results.sort(key=lambda x: x["avg_marks"], reverse=True)
    # Assign positions with tie handling
    pos = 1
    for i, result in enumerate(student_results):
        if i > 0 and result["avg_marks"] == student_results[i - 1]["avg_marks"]:
            result["position"] = student_results[i - 1]["position"]
        else:
            result["position"] = pos
        pos += 1

    # Subject analytics
    subject_analytics = []
    for subject in subjects:
        grade_counts = {
            "A": {"M": 0, "F": 0, "total": 0},
            "B": {"M": 0, "F": 0, "total": 0},
            "C": {"M": 0, "F": 0, "total": 0},
            "D": {"M": 0, "F": 0, "total": 0},
            "F": {"M": 0, "F": 0, "total": 0},
        }
        subject_marks = []
        for result in student_results:
            sc = result["scores_by_subject"].get(subject.id, {})
            if sc.get("marks") is not None:
                g = sc["grade"]
                gender = result["student"]["gender"]
                if g in grade_counts:
                    grade_counts[g][gender] += 1
                    grade_counts[g]["total"] += 1
                subject_marks.append(sc["marks"])

        gpa = calculate_gpa(subject_marks) if subject_marks else 0.0

        # Get teacher name
        assignment = next((a for a in assignments if a.subject_id == subject.id), None)
        teacher_name = ""
        if assignment:
            teacher = db.query(User).filter(User.id == assignment.teacher_id).first()
            teacher_name = teacher.full_name if teacher else ""

        subject_analytics.append({
            "subject_id": subject.id,
            "subject_name": subject.name,
            "subject_code": subject.code,
            "grade_counts": grade_counts,
            "gpa": gpa,
            "teacher_name": teacher_name,
        })

    # Class GPA
    all_marks = []
    for result in student_results:
        for sc in result["scores_by_subject"].values():
            if sc.get("marks") is not None:
                all_marks.append(sc["marks"])
    class_gpa = calculate_gpa(all_marks) if all_marks else 0.0

    # Submission progress
    progress = await get_submission_progress(assessment_id, db)

    return {
        "students": student_results,
        "subjects": [{"id": s.id, "name": s.name, "code": s.code} for s in subjects],
        "subject_analytics": subject_analytics,
        "class_gpa": class_gpa,
        "submission_progress": progress,
        "assessment_id": assessment_id,
        "class_id": assessment.class_id,
    }


async def get_submission_progress(assessment_id: int, db: Session) -> Dict[str, Any]:
    """
    Returns submission progress for an assessment.
    """
    assessment = db.query(Assessment).filter(Assessment.id == assessment_id).first()
    if not assessment:
        return {"total_teacher_subject_slots": 0, "submitted_count": 0, "percentage": 0.0}

    assignments = (
        db.query(TeacherSubjectClass)
        .filter(TeacherSubjectClass.class_id == assessment.class_id)
        .all()
    )
    total_slots = len(assignments)

    subjects_status = []
    submitted_count = 0

    for assignment in assignments:
        # A subject is "submitted" if any score for this subject/assessment is is_submitted=True
        any_submitted = (
            db.query(Score)
            .filter(
                Score.assessment_id == assessment_id,
                Score.subject_id == assignment.subject_id,
                Score.is_submitted == True,
            )
            .first()
        )

        teacher = db.query(User).filter(User.id == assignment.teacher_id).first()
        subject = db.query(Subject).filter(Subject.id == assignment.subject_id).first()

        is_submitted = any_submitted is not None
        if is_submitted:
            submitted_count += 1

        subjects_status.append({
            "subject_name": subject.name if subject else "",
            "subject_id": assignment.subject_id,
            "teacher_name": teacher.full_name if teacher else "",
            "is_submitted": is_submitted,
            "submitted_at": any_submitted.submitted_at.isoformat() if (any_submitted and any_submitted.submitted_at) else None,
        })

    percentage = round((submitted_count / total_slots) * 100, 1) if total_slots > 0 else 0.0

    return {
        "total_teacher_subject_slots": total_slots,
        "submitted_count": submitted_count,
        "percentage": percentage,
        "subjects_status": subjects_status,
    }

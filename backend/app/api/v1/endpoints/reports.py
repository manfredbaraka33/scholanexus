from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_teacher, require_admin, get_current_user
from app.models.user import User
from app.models.assessment import Assessment
from app.models.subject import Subject, TeacherSubjectClass
from app.models.student import Student
from app.models.score import Score
from app.services.pdf_generator import generate_scoresheet_pdf, generate_report_cards_pdf, generate_standings_pdf, generate_analytics_pdf
from app.services.results_engine import compile_class_results
from app.utils.necta import marks_to_grade, grade_to_points

router = APIRouter(prefix="/reports", tags=["reports"])

_NO_CACHE_HEADERS = {
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    "Pragma": "no-cache",
    "Expires": "0",
}


@router.get("/scoresheet/{assessment_id}/{subject_id}")
async def get_scoresheet_pdf(
    assessment_id: int,
    subject_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_teacher),
):
    assessment = db.query(Assessment).filter(Assessment.id == assessment_id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    subject = db.query(Subject).filter(Subject.id == subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    # Get teacher assignment
    assignment = db.query(TeacherSubjectClass).filter(
        TeacherSubjectClass.subject_id == subject_id,
        TeacherSubjectClass.class_id == assessment.class_id,
    ).first()
    teacher_name = current_user.full_name

    # Get students and scores
    students = (
        db.query(Student)
        .filter(Student.class_id == assessment.class_id, Student.is_active == True)
        .order_by(Student.last_name, Student.first_name)
        .all()
    )

    students_data = []
    grade_counts = {
        "A": {"M": 0, "F": 0, "total": 0},
        "B": {"M": 0, "F": 0, "total": 0},
        "C": {"M": 0, "F": 0, "total": 0},
        "D": {"M": 0, "F": 0, "total": 0},
        "F": {"M": 0, "F": 0, "total": 0},
    }
    marks_list = []

    for student in students:
        score = db.query(Score).filter(
            Score.student_id == student.id,
            Score.subject_id == subject_id,
            Score.assessment_id == assessment_id,
        ).first()

        name = f"{student.last_name.upper()}, {student.first_name}"
        if student.middle_name:
            name += f" {student.middle_name}"
        gender = student.gender.value if student.gender else "M"

        marks = score.marks if score else None
        if marks is not None:
            g = marks_to_grade(marks)
            grade_counts[g][gender] += 1
            grade_counts[g]["total"] += 1
            marks_list.append(marks)

        students_data.append({"name": name, "gender": gender, "marks": marks})

    from app.utils.necta import calculate_gpa
    subject_gpa = calculate_gpa(marks_list) if marks_list else 0.0

    assessment_name = assessment.name.value if hasattr(assessment.name, "value") else str(assessment.name)
    class_name = assessment.class_.name if assessment.class_ else ""

    pdf_bytes = generate_scoresheet_pdf(
        subject_name=subject.name,
        subject_code=subject.code,
        class_name=class_name,
        assessment_name=assessment_name,
        teacher_name=teacher_name,
        students_data=students_data,
        grade_counts=grade_counts,
        subject_gpa=subject_gpa,
    )

    filename = f"scoresheet_{subject.code}_{assessment_name}_{class_name}.pdf".replace(" ", "_")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


@router.get("/reportcards/{assessment_id}")
async def get_report_cards_pdf(
    assessment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_teacher),
):
    assessment = db.query(Assessment).filter(Assessment.id == assessment_id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    results = await compile_class_results(assessment_id, db)
    if not results or not results.get("students"):
        raise HTTPException(status_code=400, detail="No results available")

    assessment_name = assessment.name.value if hasattr(assessment.name, "value") else str(assessment.name)
    class_name = assessment.class_.name if assessment.class_ else ""
    academic_year = assessment.academic_year

    pdf_bytes = generate_report_cards_pdf(
        students_results=results["students"],
        assessment_name=assessment_name,
        class_name=class_name,
        academic_year=academic_year,
        subjects_list=results.get("subjects", []),
    )

    filename = f"reportcards_{assessment_name}_{class_name}.pdf".replace(" ", "_")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


@router.get("/standings/{assessment_id}")
async def get_standings_pdf(
    assessment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_teacher),
):
    assessment = db.query(Assessment).filter(Assessment.id == assessment_id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    results = await compile_class_results(assessment_id, db)
    if not results or not results.get("students"):
        raise HTTPException(status_code=400, detail="No results available")

    assessment_name = assessment.name.value if hasattr(assessment.name, "value") else str(assessment.name)
    class_name = assessment.class_.name if assessment.class_ else ""
    academic_year = assessment.academic_year

    # Build subject cols sorted by code
    subject_cols = sorted(
        [{"subject_id": s["id"], "subject_code": s["code"], "subject_name": s["name"]}
         for s in results.get("subjects", [])],
        key=lambda x: x["subject_code"],
    )

    # NECTA sort: females first by position, then males
    def necta_key(row):
        g = 0 if row["student"]["gender"] == "F" else 1
        return (g, row.get("position", 9999), row["student"]["last_name"], row["student"]["first_name"])

    sorted_students = sorted(results["students"], key=necta_key)

    pdf_bytes = generate_standings_pdf(
        sorted_students=sorted_students,
        subject_cols=subject_cols,
        assessment_name=assessment_name,
        class_name=class_name,
        academic_year=academic_year,
    )

    filename = f"standings_{assessment_name}_{class_name}.pdf".replace(" ", "_")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            **_NO_CACHE_HEADERS,
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )


@router.get("/analytics/{assessment_id}")
async def get_analytics_pdf(
    assessment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_teacher),
):
    from app.services.analytics import get_class_analytics
    assessment = db.query(Assessment).filter(Assessment.id == assessment_id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    analytics = await get_class_analytics(assessment_id, db)
    assessment_name = assessment.name.value if hasattr(assessment.name, "value") else str(assessment.name)
    class_name = assessment.class_.name if assessment.class_ else ""
    academic_year = assessment.academic_year

    pdf_bytes = generate_analytics_pdf(
        subject_analytics=analytics.get("subject_analytics", []),
        class_gpa=analytics.get("class_gpa", 0.0),
        assessment_name=assessment_name,
        class_name=class_name,
        academic_year=academic_year,
    )

    filename = f"analytics_{assessment_name}_{class_name}.pdf".replace(" ", "_")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_teacher, get_current_user
from app.models.user import User
from app.models.student import Student
from app.models.subject import TeacherSubjectClass, Subject
from app.models.class_ import Class_
from app.models.score import Score
from app.models.assessment import Assessment
from app.schemas.student import StudentResponse
from app.schemas.score import ScoreResponse
from app.services.results_engine import compile_class_results

router = APIRouter(prefix="/teacher", tags=["teacher"])


@router.get("/assignments")
def get_my_assignments(
    current_user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """Returns teacher's subject+class combos."""
    assignments = (
        db.query(TeacherSubjectClass)
        .filter(TeacherSubjectClass.teacher_id == current_user.id)
        .all()
    )
    result = []
    for a in assignments:
        subject = db.query(Subject).filter(Subject.id == a.subject_id).first()
        cls = db.query(Class_).filter(Class_.id == a.class_id).first()
        # Get assessments for this class
        assessments = (
            db.query(Assessment)
            .filter(Assessment.class_id == a.class_id)
            .all()
        )
        assessment_status = []
        for assessment in assessments:
            any_submitted = (
                db.query(Score)
                .filter(
                    Score.assessment_id == assessment.id,
                    Score.subject_id == a.subject_id,
                    Score.submitted_by == current_user.id,
                    Score.is_submitted == True,
                )
                .first()
            )
            any_in_progress = (
                db.query(Score)
                .filter(
                    Score.assessment_id == assessment.id,
                    Score.subject_id == a.subject_id,
                    Score.submitted_by == current_user.id,
                )
                .first()
            )
            if any_submitted:
                status = "submitted"
            elif any_in_progress:
                status = "in_progress"
            else:
                status = "not_started"

            assessment_status.append({
                "assessment_id": assessment.id,
                "assessment_name": assessment.name.value if hasattr(assessment.name, "value") else assessment.name,
                "academic_year": assessment.academic_year,
                "status": status,
            })

        result.append({
            "id": a.id,
            "assignment_id": a.id,
            "subject_id": a.subject_id,
            "subject_name": subject.name if subject else "",
            "subject_code": subject.code if subject else "",
            "class_id": a.class_id,
            "class_name": cls.name if cls else "",
            "assessments": assessment_status,
        })
    return result


@router.get("/students", response_model=List[StudentResponse])
def get_students_for_class(
    class_id: int,
    current_user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    return (
        db.query(Student)
        .filter(Student.class_id == class_id, Student.is_active == True)
        .order_by(Student.last_name, Student.first_name)
        .all()
    )


@router.get("/scores", response_model=List[ScoreResponse])
def get_scores(
    assessment_id: int,
    subject_id: int,
    current_user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    return (
        db.query(Score)
        .filter(
            Score.assessment_id == assessment_id,
            Score.subject_id == subject_id,
        )
        .all()
    )


@router.get("/published-standings")
def list_published_assessments(
    current_user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """Return all published assessments (metadata only) for the teacher to pick from."""
    assessments = (
        db.query(Assessment)
        .filter(Assessment.is_published == True)
        .order_by(Assessment.created_at.desc())
        .all()
    )
    result = []
    for a in assessments:
        result.append({
            "id": a.id,
            "name": a.name.value if hasattr(a.name, "value") else str(a.name),
            "class_name": a.class_.name if a.class_ else "",
            "academic_year": a.academic_year,
        })
    return result


@router.get("/published-standings/{assessment_id}")
async def get_published_standings(
    assessment_id: int,
    current_user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """Return compiled results for a published assessment."""
    assessment = db.query(Assessment).filter(
        Assessment.id == assessment_id,
        Assessment.is_published == True,
    ).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Published standings not found")
    return await compile_class_results(assessment_id, db)

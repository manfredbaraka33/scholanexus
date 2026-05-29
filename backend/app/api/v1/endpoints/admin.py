import csv
import io
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.core.deps import require_admin, require_teacher
from app.core.security import hash_password
from app.models.user import User, UserRole
from app.models.class_ import Class_
from app.models.student import Student
from app.models.subject import Subject, TeacherSubjectClass
from app.models.assessment import Assessment
from app.models.score import Score
from app.schemas.user import UserCreate, UserResponse
from app.schemas.student import StudentCreate, StudentResponse
from app.schemas.subject import (
    SubjectCreate, SubjectResponse, SubjectUpdate,
    ClassCreate, ClassResponse,
    TeacherSubjectClassCreate, TeacherSubjectClassResponse,
)
from app.schemas.assessment import AssessmentCreate, AssessmentResponse
from app.schemas.score import AdminScoreOverrideRequest, ScoreResponse
from app.utils.necta import marks_to_grade, grade_to_points

router = APIRouter(prefix="/admin", tags=["admin"])
logger = logging.getLogger(__name__)


# ── Classes ──────────────────────────────────────────────────────

@router.get("/classes", response_model=List[ClassResponse])
def list_classes(db: Session = Depends(get_db), _=Depends(require_admin)):
    return db.query(Class_).all()


@router.post("/classes", response_model=ClassResponse)
def create_class(data: ClassCreate, db: Session = Depends(get_db), _=Depends(require_admin)):
    cls = Class_(**data.model_dump())
    db.add(cls)
    db.commit()
    db.refresh(cls)
    return cls


# ── Students ─────────────────────────────────────────────────────

@router.get("/students", response_model=List[StudentResponse])
def list_students(
    class_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    q = db.query(Student).filter(Student.is_active == True)
    if class_id:
        q = q.filter(Student.class_id == class_id)
    return q.order_by(Student.last_name, Student.first_name).all()


@router.post("/students", response_model=StudentResponse)
def create_student(data: StudentCreate, db: Session = Depends(get_db), _=Depends(require_admin)):
    if db.query(Student).filter(Student.admission_number == data.admission_number).first():
        raise HTTPException(status_code=400, detail="Admission number already exists")
    student = Student(**data.model_dump())
    db.add(student)
    db.commit()
    db.refresh(student)
    return student


@router.put("/students/{student_id}", response_model=StudentResponse)
def update_student(
    student_id: int,
    data: dict,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    for k, v in data.items():
        if hasattr(student, k):
            setattr(student, k, v)
    db.commit()
    db.refresh(student)
    return student


@router.delete("/students/{student_id}")
def delete_student(student_id: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    student.is_active = False
    db.commit()
    return {"detail": "Student deactivated"}


@router.get("/students/template")
def download_student_template():
    """Return a CSV template for bulk student import."""
    headers = "admission_number,first_name,middle_name,last_name,gender,class_name\n"
    example = "2024/001,John,Michael,Doe,M,Form 1 A\n"
    content = headers + example
    return StreamingResponse(
        io.StringIO(content),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=students_template.csv"},
    )


@router.post("/students/bulk")
async def bulk_import_students(
    file: UploadFile = File(...),
    class_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    """CSV columns: admission_number, first_name, middle_name, last_name, gender, class_name"""
    content = await file.read()
    decoded = content.decode("utf-8", errors="replace")
    reader = csv.DictReader(io.StringIO(decoded))

    created = 0
    errors = []

    # Build class name lookup
    classes = {c.name.lower(): c for c in db.query(Class_).all()}

    for row_num, row in enumerate(reader, 2):
        try:
            adm = row.get("admission_number", "").strip()
            if not adm:
                continue
            if db.query(Student).filter(Student.admission_number == adm).first():
                errors.append(f"Row {row_num}: Admission number {adm} already exists")
                continue

            # Resolve class
            if class_id:
                resolved_class_id = class_id
            else:
                class_name = row.get("class_name", "").strip().lower()
                cls = classes.get(class_name)
                if not cls:
                    errors.append(f"Row {row_num}: Class '{class_name}' not found")
                    continue
                resolved_class_id = cls.id

            gender = row.get("gender", "M").strip().upper()
            if gender not in ("M", "F"):
                gender = "M"

            student = Student(
                admission_number=adm,
                first_name=row.get("first_name", "").strip(),
                middle_name=row.get("middle_name", "").strip() or None,
                last_name=row.get("last_name", "").strip(),
                gender=gender,
                class_id=resolved_class_id,
            )
            db.add(student)
            created += 1
        except Exception as e:
            errors.append(f"Row {row_num}: {str(e)}")

    db.commit()
    return {"created": created, "errors": errors}


# ── Teachers ─────────────────────────────────────────────────────

@router.get("/teachers", response_model=List[UserResponse])
def list_teachers(
    active_only: bool = False,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    q = db.query(User).filter(User.role == UserRole.teacher)
    if active_only:
        q = q.filter(User.is_active == True)
    return q.all()


@router.post("/teachers", response_model=UserResponse)
def create_teacher(data: UserCreate, db: Session = Depends(get_db), _=Depends(require_admin)):
    if db.query(User).filter(User.username == data.username).first():
        raise HTTPException(status_code=400, detail="Username already exists")
    teacher = User(
        username=data.username,
        email=data.email,
        full_name=data.full_name,
        role=UserRole.teacher,
        hashed_password=hash_password(data.password),
    )
    db.add(teacher)
    db.commit()
    db.refresh(teacher)
    return teacher


@router.put("/teachers/{teacher_id}", response_model=UserResponse)
def update_teacher(
    teacher_id: int,
    data: dict,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    teacher = db.query(User).filter(User.id == teacher_id).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")
    allowed = {"full_name", "email", "is_active"}
    for k, v in data.items():
        if k in allowed:
            setattr(teacher, k, v)
    db.commit()
    db.refresh(teacher)
    return teacher


@router.patch("/teachers/{teacher_id}/deactivate", response_model=UserResponse)
def deactivate_teacher(
    teacher_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    teacher = db.query(User).filter(User.id == teacher_id).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")
    teacher.is_active = False
    db.commit()
    db.refresh(teacher)
    return teacher


@router.patch("/teachers/{teacher_id}/reactivate", response_model=UserResponse)
def reactivate_teacher(
    teacher_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    teacher = db.query(User).filter(User.id == teacher_id).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")
    teacher.is_active = True
    db.commit()
    db.refresh(teacher)
    return teacher


@router.patch("/teachers/{teacher_id}/reset-password")
def reset_teacher_password(
    teacher_id: int,
    data: dict,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    teacher = db.query(User).filter(User.id == teacher_id).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")
    new_pass = data.get("password", "")
    if len(new_pass) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    teacher.hashed_password = hash_password(new_pass)
    db.commit()
    return {"detail": "Password reset successfully"}


# ── Subjects ─────────────────────────────────────────────────────

@router.get("/subjects", response_model=List[SubjectResponse])
def list_subjects(db: Session = Depends(get_db), _=Depends(require_admin)):
    return db.query(Subject).all()


@router.post("/subjects", response_model=SubjectResponse)
def create_subject(data: SubjectCreate, db: Session = Depends(get_db), _=Depends(require_admin)):
    # Standardize the incoming subject code format
    clean_code = data.code.strip().upper()

    # Query the database using the clean uppercase code string
    if db.query(Subject).filter(Subject.code == clean_code).first():
        raise HTTPException(status_code=400, detail="Subject code already exists")
    
    # Map payload properties and override code cleanly
    payload = data.model_dump()
    payload["code"] = clean_code
    
    subj = Subject(**payload)
    db.add(subj)
    db.commit()
    
    try:
        db.refresh(subj)
    except Exception as e:
        # Fallback safeguard: if database defaults fail to refresh, manually assign state
        db.rollback()
        raise HTTPException(
            status_code=500, 
            detail=f"Database integrity verification error on refresh: {str(e)}"
        )
        
    return subj


@router.delete("/subjects/{subject_id}")
def delete_subject(subject_id: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    subj = db.query(Subject).filter(Subject.id == subject_id).first()
    if not subj:
        raise HTTPException(status_code=404, detail="Subject not found")
    db.delete(subj)
    db.commit()
    return {"detail": "Subject deleted"}


@router.put("/subjects/{subject_id}", response_model=SubjectResponse)
def update_subject(
    subject_id: int,
    data: SubjectUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    subj = db.query(Subject).filter(Subject.id == subject_id).first()
    if not subj:
        raise HTTPException(status_code=404, detail="Subject not found")
    if data.code and data.code.upper() != subj.code:
        if db.query(Subject).filter(Subject.code == data.code.upper()).first():
            raise HTTPException(status_code=400, detail="Subject code already exists")
    if data.code:
        data.code = data.code.upper()
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(subj, k, v)
    db.commit()
    db.refresh(subj)
    return subj


# ── Teacher Assignments ───────────────────────────────────────────

@router.post("/assign", response_model=TeacherSubjectClassResponse)
def assign_teacher(
    data: TeacherSubjectClassCreate,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    # Check for duplicate
    existing = db.query(TeacherSubjectClass).filter(
        TeacherSubjectClass.teacher_id == data.teacher_id,
        TeacherSubjectClass.subject_id == data.subject_id,
        TeacherSubjectClass.class_id == data.class_id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Assignment already exists")

    assignment = TeacherSubjectClass(**data.model_dump())
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return _enrich_assignment(assignment, db)


@router.get("/assignments", response_model=List[TeacherSubjectClassResponse])
def list_assignments(
    class_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    q = db.query(TeacherSubjectClass)
    if class_id:
        q = q.filter(TeacherSubjectClass.class_id == class_id)
    assignments = q.all()
    return [_enrich_assignment(a, db) for a in assignments]


@router.delete("/assign/{assignment_id}")
def remove_assignment(
    assignment_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    assignment = db.query(TeacherSubjectClass).filter(TeacherSubjectClass.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    db.delete(assignment)
    db.commit()
    return {"detail": "Assignment removed"}


# ── Assessments ──────────────────────────────────────────────────

@router.post("/assessments", response_model=AssessmentResponse)
def create_assessment(
    data: AssessmentCreate,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    assessment = Assessment(**data.model_dump())
    db.add(assessment)
    db.commit()
    db.refresh(assessment)
    return assessment


@router.get("/assessments", response_model=List[AssessmentResponse])
def list_assessments(
    class_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _=Depends(require_teacher),
):
    q = db.query(Assessment)
    if class_id:
        q = q.filter(Assessment.class_id == class_id)
    return q.order_by(Assessment.created_at.desc()).all()


@router.post("/assessments/{assessment_id}/publish")
def toggle_publish_assessment(
    assessment_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    assessment = db.query(Assessment).filter(Assessment.id == assessment_id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    assessment.is_published = not assessment.is_published
    db.commit()
    db.refresh(assessment)
    return {"id": assessment.id, "is_published": assessment.is_published}





# @router.post("/scores/override", response_model=ScoreResponse)
# async def admin_override_score(
#     data: AdminScoreOverrideRequest,
#     background_tasks: BackgroundTasks,
#     db: Session = Depends(get_db),
#     _=Depends(require_admin),
# ):
#     # 1. Add strict explicit logging or casting to prevent the Else-Trap
#     score = db.query(Score).filter(
#         Score.assessment_id == int(data.assessment_id),
#         Score.subject_id == int(data.subject_id),
#         Score.student_id == int(data.student_id),
#     ).first()

#     marks = None if data.marks is None else max(0.0, min(100.0, float(data.marks)))
#     grade = marks_to_grade(marks) if marks is not None else None
#     points = grade_to_points(grade) if grade is not None else None

#     if score:
#         score.marks = marks
#         score.grade = grade
#         score.points = points
#     else:
#         score = Score(
#             student_id=data.student_id,
#             subject_id=data.subject_id,
#             assessment_id=data.assessment_id,
#             marks=marks,
#             grade=grade,
#             points=points,
#             is_submitted=True,
#         )
#         db.add(score)

#     try:
#         db.commit()
#         db.refresh(score)
#     except Exception as e:
#         db.rollback()
#         raise HTTPException(status_code=500, detail=f"Database commit failed: {str(e)}")

#     # 2. DO NOT pass the request's 'db' session into a background task.
#     # Pass only the IDs, and let the background task spawn its own temporary session.
#     background_tasks.add_task(_admin_broadcast, data.assessment_id) 
    
#     return score

@router.post("/admin/scores/override", response_model=ScoreResponse)
async def override_score(
    data: ScoreOverridePayload, # This expects student_id, subject_id, assessment_id, marks
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _=Depends(require_teacher)
):
    # 1. Look for the existing row using the composite keys
    score = db.query(Score).filter(
        Score.student_id == data.student_id,
        Score.subject_id == data.subject_id,
        Score.assessment_id == data.assessment_id
    ).first()
    
    # 2. If it is a brand new mark, create the row
    if not score:
        score = Score(
            student_id=data.student_id,
            subject_id=data.subject_id,
            assessment_id=data.assessment_id
        )
        db.add(score)
        
    # 3. Apply the marks and run structural conversions
    score.marks = data.marks
    score.grade = marks_to_grade(data.marks) if data.marks is not None else None
    score.points = grade_to_points(score.grade) if score.grade else 0
    
    db.commit()
    db.refresh(score)
    
    # 4. Trigger the live background sync update
    background_tasks.add_task(_admin_broadcast, score.assessment_id)
    
    return score

async def _admin_broadcast(assessment_id: int):
    try:
        from app.core.database import SessionLocal  # ✅ Precise import path
        from app.services.results_engine import compile_class_results
        from main import manager
        
        # Open a fresh, isolated database connection for this background worker
        with SessionLocal() as session:
            results = await compile_class_results(assessment_id, session)
            await manager.broadcast(assessment_id, results)
            
    except Exception:
        logger.exception("Failed to broadcast admin score override for assessment_id=%s", assessment_id)

# ── Helpers ──────────────────────────────────────────────────────

def _enrich_assignment(assignment: TeacherSubjectClass, db: Session) -> dict:
    teacher = db.query(User).filter(User.id == assignment.teacher_id).first()
    subject = db.query(Subject).filter(Subject.id == assignment.subject_id).first()
    cls = db.query(Class_).filter(Class_.id == assignment.class_id).first()
    return {
        "id": assignment.id,
        "teacher_id": assignment.teacher_id,
        "subject_id": assignment.subject_id,
        "class_id": assignment.class_id,
        "teacher_name": teacher.full_name if teacher else "",
        "subject_name": subject.name if subject else "",
        "subject_code": subject.code if subject else "",
        "class_name": cls.name if cls else "",
    }



# ── Regular Score Patch Update ───────────────────────────────────

class ScorePatchRequest(BaseModel):
    marks: float = Field(..., ge=0.0, le=100.0)


@router.patch("/update-regular-student-score", response_model=ScoreResponse)
async def update_regular_score(
    student_id: int,
    subject_id: int,
    assessment_id: int,
    data: ScorePatchRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _=Depends(require_teacher)
):
    # The database will now query matching Integer against Integer flawlessly
    score = db.query(Score).filter(
        Score.student_id == student_id,
        Score.subject_id == subject_id,
        Score.assessment_id == assessment_id
    ).first()
    
    if not score:
        raise HTTPException(status_code=404, detail="Score record truly not found")
        
    score.marks = data.marks
    score.grade = marks_to_grade(data.marks) if data.marks is not None else None
    score.points = grade_to_points(score.grade) if score.grade else 0
    
    db.commit()
    db.refresh(score)
    background_tasks.add_task(_admin_broadcast, score.assessment_id)
    return score


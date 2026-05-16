from app.models.user import User, UserRole
from app.models.class_ import Class_
from app.models.student import Student, GenderEnum
from app.models.subject import Subject, TeacherSubjectClass
from app.models.assessment import Assessment, AssessmentType
from app.models.score import Score

__all__ = [
    "User", "UserRole",
    "Class_",
    "Student", "GenderEnum",
    "Subject", "TeacherSubjectClass",
    "Assessment", "AssessmentType",
    "Score",
]

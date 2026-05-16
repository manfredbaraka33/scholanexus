from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from app.core.database import Base


class Class_(Base):
    __tablename__ = "classes"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), nullable=False)  # e.g. "Form 1"
    stream = Column(String(10), nullable=True)  # e.g. "A", "B"
    academic_year = Column(String(20), nullable=False)

    # Relationships
    students = relationship("Student", back_populates="class_")
    assessments = relationship("Assessment", back_populates="class_")
    teacher_subject_assignments = relationship("TeacherSubjectClass", back_populates="class_")

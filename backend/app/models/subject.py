from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class Subject(Base):
    __tablename__ = "subjects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    code = Column(String(20), unique=True, nullable=False, index=True)

    # Relationships
    teacher_assignments = relationship("TeacherSubjectClass", back_populates="subject")
    scores = relationship("Score", back_populates="subject")


class TeacherSubjectClass(Base):
    __tablename__ = "teacher_subject_classes"

    id = Column(Integer, primary_key=True, index=True)
    teacher_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    class_id = Column(Integer, ForeignKey("classes.id"), nullable=False)

    # Relationships
    teacher = relationship("User", back_populates="subject_assignments")
    subject = relationship("Subject", back_populates="teacher_assignments")
    class_ = relationship("Class_", back_populates="teacher_subject_assignments")

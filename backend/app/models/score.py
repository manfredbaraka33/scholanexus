from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class Score(Base):
    __tablename__ = "scores"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    assessment_id = Column(Integer, ForeignKey("assessments.id"), nullable=False)
    marks = Column(Float, nullable=True)
    submitted_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    submitted_at = Column(DateTime, nullable=True)
    is_submitted = Column(Boolean, default=False, nullable=False)

    # Computed fields stored for performance
    grade = Column(String(2), nullable=True)
    points = Column(Integer, nullable=True)

    # Relationships
    student = relationship("Student", back_populates="scores")
    subject = relationship("Subject", back_populates="scores")
    assessment = relationship("Assessment", back_populates="scores")
    submitter = relationship("User", foreign_keys=[submitted_by], back_populates="submitted_scores")

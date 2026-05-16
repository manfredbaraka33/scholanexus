import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from app.core.database import Base


class AssessmentType(str, enum.Enum):
    midterm_exam = "midterm_exam"
    terminal_exam = "terminal_exam"
    annual_exam = "annual_exam"


class Assessment(Base):
    __tablename__ = "assessments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(Enum(AssessmentType), nullable=False)
    class_id = Column(Integer, ForeignKey("classes.id"), nullable=False)
    academic_year = Column(String(20), nullable=False)
    is_finalized = Column(Boolean, default=False, nullable=False)
    is_published = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    class_ = relationship("Class_", back_populates="assessments")
    scores = relationship("Score", back_populates="assessment")

    @property
    def class_name(self) -> str:
        return self.class_.name if self.class_ else ""

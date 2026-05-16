import enum
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Enum
from sqlalchemy.orm import relationship
from app.core.database import Base


class GenderEnum(str, enum.Enum):
    M = "M"
    F = "F"


class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    first_name = Column(String(100), nullable=False)
    middle_name = Column(String(100), nullable=True)
    last_name = Column(String(100), nullable=False)
    gender = Column(Enum(GenderEnum), nullable=False)
    class_id = Column(Integer, ForeignKey("classes.id"), nullable=False)
    admission_number = Column(String(50), unique=True, nullable=False, index=True)
    is_active = Column(Boolean, default=True, nullable=False)

    # Relationships
    class_ = relationship("Class_", back_populates="students")
    scores = relationship("Score", back_populates="student")

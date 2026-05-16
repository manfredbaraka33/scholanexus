from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.models.assessment import AssessmentType


class AssessmentCreate(BaseModel):
    name: AssessmentType
    class_id: int
    academic_year: str


class AssessmentResponse(BaseModel):
    id: int
    name: AssessmentType
    class_id: int
    class_name: Optional[str] = None
    academic_year: str
    is_finalized: bool
    is_published: bool = False
    created_at: datetime

    class Config:
        from_attributes = True

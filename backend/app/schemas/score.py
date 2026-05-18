from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class ScoreItem(BaseModel):
    student_id: int
    marks: Optional[float] = None


class ScoreSaveRequest(BaseModel):
    assessment_id: int
    subject_id: int
    scores: List[ScoreItem]


class AdminScoreOverrideRequest(BaseModel):
    assessment_id: int
    subject_id: int
    student_id: int
    marks: Optional[float] = None


class ScoreResponse(BaseModel):
    id: int
    student_id: int
    subject_id: int
    assessment_id: int
    marks: Optional[float] = None
    grade: Optional[str] = None
    points: Optional[int] = None
    is_submitted: bool
    submitted_at: Optional[datetime] = None

    class Config:
        from_attributes = True

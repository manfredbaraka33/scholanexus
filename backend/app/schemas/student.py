from pydantic import BaseModel
from typing import Optional
from app.models.student import GenderEnum


class StudentBase(BaseModel):
    first_name: str
    middle_name: Optional[str] = None
    last_name: str
    gender: GenderEnum
    class_id: int
    admission_number: str


class StudentCreate(StudentBase):
    pass


class StudentUpdate(BaseModel):
    first_name: Optional[str] = None
    middle_name: Optional[str] = None
    last_name: Optional[str] = None
    gender: Optional[GenderEnum] = None
    class_id: Optional[int] = None
    is_active: Optional[bool] = None


class StudentResponse(StudentBase):
    id: int
    is_active: bool

    class Config:
        from_attributes = True

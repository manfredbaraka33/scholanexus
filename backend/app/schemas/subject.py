from pydantic import BaseModel
from typing import Optional


class SubjectBase(BaseModel):
    name: str
    code: str


class SubjectCreate(SubjectBase):
    pass


class SubjectUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None


class SubjectResponse(SubjectBase):
    id: int

    class Config:
        from_attributes = True


class TeacherSubjectClassCreate(BaseModel):
    teacher_id: int
    subject_id: int
    class_id: int


class TeacherSubjectClassResponse(BaseModel):
    id: int
    teacher_id: int
    subject_id: int
    class_id: int
    teacher_name: Optional[str] = None
    subject_name: Optional[str] = None
    subject_code: Optional[str] = None
    class_name: Optional[str] = None

    class Config:
        from_attributes = True


class ClassBase(BaseModel):
    name: str
    stream: Optional[str] = None
    academic_year: str


class ClassCreate(ClassBase):
    pass


class ClassResponse(ClassBase):
    id: int

    class Config:
        from_attributes = True

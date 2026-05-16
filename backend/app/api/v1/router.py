from fastapi import APIRouter
from app.api.v1.endpoints import auth, admin, teacher, scores, results, reports

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(admin.router)
api_router.include_router(teacher.router)
api_router.include_router(scores.router)
api_router.include_router(results.router)
api_router.include_router(reports.router)

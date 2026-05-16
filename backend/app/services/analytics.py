"""
Analytics service for ScholaNexus.
"""
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from app.services.results_engine import compile_class_results


async def get_class_analytics(assessment_id: int, db: Session) -> Dict[str, Any]:
    """Return class-level analytics."""
    results = await compile_class_results(assessment_id, db)
    return {
        "subject_analytics": results.get("subject_analytics", []),
        "class_gpa": results.get("class_gpa", 0.0),
        "submission_progress": results.get("submission_progress", {}),
    }

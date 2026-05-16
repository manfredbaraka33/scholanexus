"""
NECTA Tanzania O-Level grading utilities.
"""
from typing import List, Optional


def marks_to_grade(marks: float) -> str:
    """NECTA Tanzania O-Level grading:
    75-100 → A, 65-74 → B, 45-64 → C, 30-44 → D, 0-29 → F
    """
    if marks >= 75:
        return "A"
    elif marks >= 65:
        return "B"
    elif marks >= 45:
        return "C"
    elif marks >= 30:
        return "D"
    else:
        return "F"


def grade_to_points(grade: str) -> int:
    """A=1, B=2, C=3, D=4, F=5"""
    mapping = {"A": 1, "B": 2, "C": 3, "D": 4, "F": 5}
    return mapping.get(grade.upper(), 5)


def calculate_division(total_points: int, num_subjects: int) -> str:
    """
    Uses best 7 subjects if more than 7.
    Division I:   7–17  points
    Division II:  18–21 points
    Division III: 22–25 points
    Division IV:  26–33 points
    Division 0:   34+   or failed to sit
    """
    if num_subjects == 0:
        return "Division 0"

    if total_points <= 17:
        return "Division I"
    elif total_points <= 21:
        return "Division II"
    elif total_points <= 25:
        return "Division III"
    elif total_points <= 33:
        return "Division IV"
    else:
        return "Division 0"


def best_seven_points(points_list: List[int]) -> int:
    """Return sum of best (lowest) 7 points from the list."""
    if not points_list:
        return 0
    sorted_points = sorted(points_list)
    best_7 = sorted_points[:7]
    return sum(best_7)


def calculate_gpa(marks_list: List[float]) -> float:
    """Average of grade points across subjects. Lower is better (NECTA style).
    Returns float rounded to 2 decimal places.
    """
    if not marks_list:
        return 0.0
    points = [grade_to_points(marks_to_grade(m)) for m in marks_list]
    return round(sum(points) / len(points), 2)


def grade_comment(grade: str) -> str:
    """Return comment for grade."""
    comments = {
        "A": "Excellent",
        "B": "Very Good",
        "C": "Good",
        "D": "Improve",
        "F": "Improve",
    }
    return comments.get(grade.upper(), "")

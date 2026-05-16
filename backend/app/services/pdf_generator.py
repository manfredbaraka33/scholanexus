"""
PDF generation service for ScholaNexus using ReportLab.
Generates score sheet PDFs and report card booklets.
"""
import io
from datetime import date
from typing import List, Dict, Any, Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm, cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, Image
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches

from app.utils.necta import marks_to_grade, grade_to_points, grade_comment
from app.core.config import settings


# ─────────────────────────────────────────────────────────────────
# Colour constants
# ─────────────────────────────────────────────────────────────────
NAVY = colors.HexColor("#1e3a8a")
TEAL = colors.HexColor("#0f766e")
GRADE_COLORS = {
    "A": colors.HexColor("#d1fae5"),
    "B": colors.HexColor("#ccfbf1"),
    "C": colors.HexColor("#fef9c3"),
    "D": colors.HexColor("#ffedd5"),
    "F": colors.HexColor("#fee2e2"),
}


def _make_bar_chart(grade_counts: Dict[str, Dict[str, int]]) -> bytes:
    """Render a grouped bar chart of grade distribution by gender and return PNG bytes."""
    grades = ["A", "B", "C", "D", "F"]
    male_counts = [grade_counts.get(g, {}).get("M", 0) for g in grades]
    female_counts = [grade_counts.get(g, {}).get("F", 0) for g in grades]

    x = range(len(grades))
    width = 0.35

    fig, ax = plt.subplots(figsize=(5, 3), dpi=100)
    bars_m = ax.bar([i - width / 2 for i in x], male_counts, width, label="Male", color="#3b82f6")
    bars_f = ax.bar([i + width / 2 for i in x], female_counts, width, label="Female", color="#ec4899")

    ax.set_xlabel("Grade")
    ax.set_ylabel("Count")
    ax.set_title("Grade Distribution by Gender")
    ax.set_xticks(list(x))
    ax.set_xticklabels(grades)
    ax.legend()
    ax.grid(axis="y", linestyle="--", alpha=0.5)
    ax.yaxis.set_major_locator(plt.MaxNLocator(integer=True))
    plt.tight_layout()

    buf = io.BytesIO()
    plt.savefig(buf, format="png", bbox_inches="tight")
    plt.close(fig)
    buf.seek(0)
    return buf.read()


def generate_scoresheet_pdf(
    subject_name: str,
    subject_code: str,
    class_name: str,
    assessment_name: str,
    teacher_name: str,
    students_data: List[Dict[str, Any]],  # [{name, gender, marks, grade}]
    grade_counts: Dict[str, Dict[str, int]],
    subject_gpa: float,
) -> bytes:
    """
    Generate a score sheet PDF for a teacher's subject.
    Returns PDF bytes.
    """
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "Title", parent=styles["Heading1"],
        alignment=TA_CENTER, fontSize=14, textColor=NAVY, spaceAfter=2,
    )
    subtitle_style = ParagraphStyle(
        "Subtitle", parent=styles["Normal"],
        alignment=TA_CENTER, fontSize=10, spaceAfter=1,
    )
    section_style = ParagraphStyle(
        "Section", parent=styles["Normal"],
        fontSize=9, textColor=colors.grey, spaceAfter=4,
    )

    story = []

    # ── Header ──────────────────────────────────────────────────
    story.append(Paragraph(settings.SCHOOL_NAME.upper(), title_style))
    story.append(Paragraph(settings.SCHOOL_ADDRESS, subtitle_style))
    story.append(HRFlowable(width="100%", thickness=2, color=NAVY))
    story.append(Spacer(1, 4 * mm))

    meta_data = [
        [
            Paragraph(f"<b>SUBJECT:</b> {subject_name} ({subject_code})", styles["Normal"]),
            Paragraph(f"<b>CLASS:</b> {class_name}", styles["Normal"]),
        ],
        [
            Paragraph(
                f"<b>ASSESSMENT:</b> {assessment_name.replace('_', ' ').title()}",
                styles["Normal"],
            ),
            Paragraph(
                f"<b>DATE:</b> {date.today().strftime('%d %B %Y')}",
                styles["Normal"],
            ),
        ],
        [
            Paragraph(f"<b>TEACHER:</b> {teacher_name}", styles["Normal"]),
            Paragraph("", styles["Normal"]),
        ],
    ]
    meta_table = Table(meta_data, colWidths=["60%", "40%"])
    meta_table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    story.append(meta_table)
    story.append(HRFlowable(width="100%", thickness=1, color=colors.lightgrey))
    story.append(Spacer(1, 4 * mm))

    # ── Score Table ──────────────────────────────────────────────
    header_row = ["#", "Student Name", "Gender", "Marks", "Grade", "Points"]
    table_data = [header_row]

    for idx, s in enumerate(students_data, 1):
        marks = s.get("marks")
        grade = marks_to_grade(marks) if marks is not None else "—"
        points = grade_to_points(grade) if marks is not None else "—"
        table_data.append([
            str(idx),
            s.get("name", ""),
            s.get("gender", ""),
            f"{marks:.1f}" if marks is not None else "—",
            grade,
            str(points) if marks is not None else "—",
        ])

    col_widths = [10 * mm, 75 * mm, 18 * mm, 20 * mm, 18 * mm, 18 * mm]
    score_table = Table(table_data, colWidths=col_widths, repeatRows=1)

    table_style = [
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("ALIGN", (1, 1), (1, -1), "LEFT"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#e2e8f0")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
    ]

    # Colour grade cells
    for row_idx, s in enumerate(students_data, 1):
        marks = s.get("marks")
        if marks is not None:
            grade = marks_to_grade(marks)
            grade_bg = GRADE_COLORS.get(grade, colors.white)
            table_style.append(("BACKGROUND", (4, row_idx), (4, row_idx), grade_bg))

    score_table.setStyle(TableStyle(table_style))
    story.append(score_table)
    story.append(Spacer(1, 6 * mm))

    # ── Grade Analysis Section ───────────────────────────────────
    story.append(HRFlowable(width="100%", thickness=1, color=NAVY))
    story.append(Spacer(1, 2 * mm))
    story.append(Paragraph("GRADE ANALYSIS", ParagraphStyle(
        "GradeHead", fontSize=10, fontName="Helvetica-Bold", textColor=NAVY, spaceAfter=3
    )))

    grades = ["A", "B", "C", "D", "F"]
    analysis_header = ["Grade", "Male", "Female", "Total"]
    analysis_data = [analysis_header]
    total_m = total_f = total_t = 0
    for g in grades:
        mc = grade_counts.get(g, {}).get("M", 0)
        fc = grade_counts.get(g, {}).get("F", 0)
        tc = grade_counts.get(g, {}).get("total", 0)
        total_m += mc
        total_f += fc
        total_t += tc
        analysis_data.append([g, str(mc), str(fc), str(tc)])
    analysis_data.append(["Total", str(total_m), str(total_f), str(total_t)])

    analysis_table = Table(analysis_data, colWidths=[20 * mm, 25 * mm, 25 * mm, 25 * mm])
    analysis_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), TEAL),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#f0fdf4")),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#e2e8f0")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(analysis_table)
    story.append(Spacer(1, 4 * mm))

    # GPA display
    story.append(Paragraph(
        f"<b>Subject GPA:</b> {subject_gpa:.2f} (NECTA scale — lower is better)",
        styles["Normal"],
    ))
    story.append(Spacer(1, 4 * mm))

    # ── Bar Chart ────────────────────────────────────────────────
    chart_bytes = _make_bar_chart(grade_counts)
    chart_img = Image(io.BytesIO(chart_bytes), width=12 * cm, height=7 * cm)
    story.append(chart_img)
    story.append(Spacer(1, 6 * mm))

    # ── Signature Line ───────────────────────────────────────────
    story.append(HRFlowable(width="100%", thickness=1, color=colors.lightgrey))
    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph("Teacher Signature: ___________________________", styles["Normal"]))

    doc.build(story)
    buf.seek(0)
    return buf.read()


def generate_report_cards_pdf(
    students_results: List[Dict[str, Any]],
    assessment_name: str,
    class_name: str,
    academic_year: str,
    subjects_list: List[Dict[str, Any]],
) -> bytes:
    """
    Generate a report cards booklet — one A4 page per student.
    Returns PDF bytes.
    """
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=15 * mm,
        rightMargin=15 * mm,
        topMargin=15 * mm,
        bottomMargin=15 * mm,
    )

    styles = getSampleStyleSheet()
    school_title_style = ParagraphStyle(
        "SchoolTitle", fontSize=13, fontName="Helvetica-Bold",
        alignment=TA_CENTER, textColor=NAVY, spaceAfter=1,
    )
    address_style = ParagraphStyle(
        "Addr", fontSize=9, alignment=TA_CENTER, spaceAfter=2,
    )
    assessment_label_style = ParagraphStyle(
        "AssessLabel", fontSize=11, fontName="Helvetica-Bold",
        alignment=TA_CENTER, textColor=TEAL, spaceAfter=6,
    )

    all_pages = []

    for result in students_results:
        student = result["student"]
        name_parts = [student["first_name"]]
        if student.get("middle_name"):
            name_parts.append(student["middle_name"])
        name_parts.append(student["last_name"].upper())
        full_name = " ".join(name_parts)

        page_story = []

        # School header
        page_story.append(Paragraph(settings.SCHOOL_NAME.upper(), school_title_style))
        page_story.append(Paragraph(f"{settings.SCHOOL_ADDRESS}  |  Tel: 0766941565", address_style))
        page_story.append(Paragraph("<i>\"Discipline and Efficiency\"</i>", ParagraphStyle(
            "Motto", fontSize=8, alignment=TA_CENTER, textColor=NAVY,
            fontName="Helvetica-Oblique", spaceAfter=3,
        )))
        assessment_label = f"{assessment_name.replace('_', ' ').upper()} RESULTS — {academic_year}"
        page_story.append(Paragraph(assessment_label, assessment_label_style))
        page_story.append(HRFlowable(width="100%", thickness=2, color=NAVY))
        page_story.append(Spacer(1, 4 * mm))

        # Student info
        info_data = [
            [
                Paragraph(f"<b>Name:</b> {full_name}", styles["Normal"]),
                Paragraph(f"<b>Adm#:</b> {student['admission_number']}", styles["Normal"]),
            ],
            [
                Paragraph(f"<b>Class:</b> {class_name}", styles["Normal"]),
                Paragraph(f"<b>Gender:</b> {'Male' if student['gender'] == 'M' else 'Female'}", styles["Normal"]),
            ],
        ]
        info_table = Table(info_data, colWidths=["65%", "35%"])
        info_table.setStyle(TableStyle([
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ]))
        page_story.append(info_table)
        page_story.append(Spacer(1, 4 * mm))

        # Scores table
        scores_header = ["Subject", "Score", "Total Marks", "Grade", "Comment"]
        scores_data = [scores_header]
        total_marks_sum = 0
        total_out_of = 0

        for subject in subjects_list:
            sc = result["scores_by_subject"].get(subject["id"])
            if sc and sc.get("marks") is not None:
                g = sc["grade"] or marks_to_grade(sc["marks"])
                comment = grade_comment(g)
                marks_val = sc["marks"]
            else:
                g = "—"
                comment = "—"
                marks_val = None

            marks_display = f"{marks_val:.0f}" if marks_val is not None else "—"
            scores_data.append([
                subject["name"],
                marks_display,
                "100",
                g,
                comment,
            ])
            if marks_val is not None:
                total_marks_sum += marks_val
                total_out_of += 100

        # Total row
        scores_data.append([
            "TOTAL",
            f"{total_marks_sum:.0f}" if total_out_of > 0 else "—",
            str(total_out_of),
            "—",
            "—",
        ])

        col_widths = [55 * mm, 20 * mm, 25 * mm, 18 * mm, 30 * mm]
        scores_table = Table(scores_data, colWidths=col_widths, repeatRows=1)

        t_style = [
            ("BACKGROUND", (0, 0), (-1, 0), NAVY),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
            ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#eff6ff")),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("ALIGN", (1, 0), (-1, -1), "CENTER"),
            ("ALIGN", (0, 0), (0, -1), "LEFT"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -2), [colors.white, colors.HexColor("#f8fafc")]),
            ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#e2e8f0")),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
        ]

        # Grade cell colouring
        for row_i, subject in enumerate(subjects_list, 1):
            sc = result["scores_by_subject"].get(subject["id"])
            if sc and sc.get("grade"):
                g = sc["grade"]
                grade_bg = GRADE_COLORS.get(g, colors.white)
                t_style.append(("BACKGROUND", (3, row_i), (3, row_i), grade_bg))

        scores_table.setStyle(TableStyle(t_style))
        page_story.append(scores_table)
        page_story.append(Spacer(1, 5 * mm))

        # Summary row
        gpa = result.get("total_points", 0)
        division = result.get("division", "—")
        position = result.get("position", "—")
        total_students = len(students_results)

        summary_data = [[
            Paragraph(f"<b>Division:</b> {division}", styles["Normal"]),
            Paragraph(f"<b>Position:</b> {position} / {total_students}", styles["Normal"]),
            Paragraph(f"<b>Points:</b> {gpa}", styles["Normal"]),
        ]]
        summary_table = Table(summary_data, colWidths=["33%", "33%", "34%"])
        summary_table.setStyle(TableStyle([
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#eff6ff")),
            ("BOX", (0, 0), (-1, -1), 1, NAVY),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
        ]))
        page_story.append(summary_table)
        page_story.append(Spacer(1, 4 * mm))

        # ── Swahili performance statement ─────────────────────────
        page_story.append(HRFlowable(width="100%", thickness=1, color=NAVY))
        page_story.append(Spacer(1, 3 * mm))

        avg_display = "—"
        if total_out_of > 0:
            avg_marks_val = total_marks_sum / (total_out_of / 100)
            avg_grade = marks_to_grade(avg_marks_val)
            avg_display = f"{avg_marks_val:.1f} ({avg_grade})"

        perf_style = ParagraphStyle(
            "SwahiliPerf", parent=styles["Normal"],
            fontSize=9, fontName="Helvetica-Bold",
            backColor=colors.HexColor("#eff6ff"),
            borderPad=5, leading=14, spaceAfter=5,
        )
        page_story.append(Paragraph(
            f"Amekuwa wa &nbsp; <u>{position}</u> &nbsp; kati ya &nbsp; <u>{total_students}</u> "
            f"&nbsp; akiwa na wastani wa &nbsp; <u>{avg_display}</u>",
            perf_style,
        ))
        page_story.append(Spacer(1, 4 * mm))

        # ── Comment sections ──────────────────────────────────────
        lbl_style = ParagraphStyle(
            "CLabel", parent=styles["Normal"],
            fontSize=8, fontName="Helvetica-Bold", spaceAfter=1,
        )
        small_style = ParagraphStyle(
            "CSmall", parent=styles["Normal"], fontSize=8,
        )

        for comment_label in [
            "Maoni ya Mwalimu wa Darasa / Class Teacher Comment",
            "Maoni ya Mwalimu wa Masomo / Academic Teacher Comment",
            "Maoni ya Mkuu wa Shule / Head Teacher Comment",
        ]:
            page_story.append(Paragraph(comment_label + ":", lbl_style))
            page_story.append(Spacer(1, 5 * mm))
            page_story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#94a3b8")))
            page_story.append(Spacer(1, 1 * mm))
            row = [[
                Paragraph("Sahihi / Signature: ____________________", small_style),
                Paragraph("Tarehe / Date: ________________", small_style),
            ]]
            row_t = Table(row, colWidths=["55%", "45%"])
            row_t.setStyle(TableStyle([
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]))
            page_story.append(row_t)
            page_story.append(Spacer(1, 2 * mm))

        # ── Stamp footer ──────────────────────────────────────────
        page_story.append(Spacer(1, 3 * mm))
        page_story.append(HRFlowable(width="100%", thickness=0.5, color=colors.grey))
        page_story.append(Spacer(1, 2 * mm))
        page_story.append(Paragraph(
            "<i>This report card is not valid without the school stamp.</i>",
            ParagraphStyle(
                "StampNote", fontSize=8, alignment=TA_CENTER,
                textColor=colors.grey, fontName="Helvetica-Oblique",
            ),
        ))

        all_pages.extend(page_story)
        # Page break between students (except last)
        if result != students_results[-1]:
            from reportlab.platypus import PageBreak
            all_pages.append(PageBreak())

    doc.build(all_pages)
    buf.seek(0)
    return buf.read()


def generate_standings_pdf(
    sorted_students: List[Dict[str, Any]],
    subject_cols: List[Dict[str, Any]],
    assessment_name: str,
    class_name: str,
    academic_year: str,
) -> bytes:
    """Generate a landscape A4 PDF of the live standings table."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=landscape(A4),
        leftMargin=10 * mm,
        rightMargin=10 * mm,
        topMargin=12 * mm,
        bottomMargin=12 * mm,
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "STitle", fontSize=12, fontName="Helvetica-Bold",
        alignment=TA_CENTER, textColor=NAVY, spaceAfter=2,
    )
    sub_style = ParagraphStyle(
        "SSub", fontSize=9, alignment=TA_CENTER, spaceAfter=6,
    )

    story = []
    story.append(Paragraph(settings.SCHOOL_NAME.upper(), title_style))
    story.append(Paragraph(
        f"{assessment_name.replace('_', ' ').upper()} — {class_name} ({academic_year})",
        sub_style,
    ))
    story.append(HRFlowable(width="100%", thickness=2, color=NAVY))
    story.append(Spacer(1, 4 * mm))

    # Header row
    header = ["S/No", "First Name", "Middle Name", "Last Name", "G"]
    header += [s["subject_code"] for s in subject_cols]
    header += ["Total", "Avg", "Division", "Pts", "Rank"]

    table_data = [header]
    for i, row in enumerate(sorted_students):
        student = row["student"]
        marks_vals = [
            row["scores_by_subject"].get(s["subject_id"], {}).get("marks")
            for s in subject_cols
        ]
        total = sum(m for m in marks_vals if m is not None) or None
        marks_cells = [str(int(m)) if m is not None else "—" for m in marks_vals]

        data_row = [
            str(i + 1),
            student["first_name"],
            student.get("middle_name") or "—",
            student["last_name"],
            student["gender"],
            *marks_cells,
            str(int(total)) if total is not None else "—",
            f"{row['avg_marks']:.1f}" if row.get("avg_marks") else "—",
            row.get("division", "—"),
            str(row.get("total_points", "—")),
            str(row.get("position", "—")),
        ]
        table_data.append(data_row)

    # Dynamic column widths — fixed cols then equal for subjects
    fixed_widths = [10*mm, 26*mm, 22*mm, 26*mm, 8*mm]
    tail_widths = [16*mm, 14*mm, 18*mm, 10*mm, 12*mm]
    available = landscape(A4)[0] - 20*mm - sum(fixed_widths) - sum(tail_widths)
    subj_w = (available / len(subject_cols)) if subject_cols else 14*mm
    col_widths = fixed_widths + [subj_w] * len(subject_cols) + tail_widths

    t = Table(table_data, colWidths=col_widths, repeatRows=1)
    style = TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 7),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("ALIGN", (1, 1), (3, -1), "LEFT"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#e2e8f0")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
    ])
    t.setStyle(style)
    story.append(t)

    doc.build(story)
    buf.seek(0)
    return buf.read()


def generate_analytics_pdf(
    subject_analytics: List[Dict[str, Any]],
    class_gpa: float,
    assessment_name: str,
    class_name: str,
    academic_year: str,
) -> bytes:
    """Generate a portrait A4 PDF of the class analytics (grade distribution per subject)."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=15 * mm,
        bottomMargin=15 * mm,
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "ATitle", fontSize=13, fontName="Helvetica-Bold",
        alignment=TA_CENTER, textColor=NAVY, spaceAfter=2,
    )
    sub_style = ParagraphStyle(
        "ASub", fontSize=9, alignment=TA_CENTER, spaceAfter=6,
    )
    subj_head_style = ParagraphStyle(
        "ASubjHead", fontSize=10, fontName="Helvetica-Bold",
        textColor=NAVY, spaceAfter=3,
    )

    story = []
    story.append(Paragraph(settings.SCHOOL_NAME.upper(), title_style))
    story.append(Paragraph(
        f"Class Analytics — {assessment_name.replace('_', ' ').upper()} · {class_name} ({academic_year})",
        sub_style,
    ))
    story.append(HRFlowable(width="100%", thickness=2, color=NAVY))
    story.append(Spacer(1, 3 * mm))
    story.append(Paragraph(
        f"<b>Class GPA (NECTA):</b> {class_gpa:.2f} — lower is better",
        styles["Normal"],
    ))
    story.append(Spacer(1, 5 * mm))

    grades = ["A", "B", "C", "D", "F"]
    for subj in subject_analytics:
        story.append(Paragraph(
            f"{subj['subject_name']} ({subj.get('subject_code', '')})"
            f"  ·  GPA: {subj.get('gpa', 0):.2f}",
            subj_head_style,
        ))

        gc = subj.get("grade_counts", {})
        analysis_header = ["Grade", "Male", "Female", "Total"]
        analysis_data = [analysis_header]
        for g in grades:
            m = gc.get(g, {}).get("M", 0)
            f = gc.get(g, {}).get("F", 0)
            analysis_data.append([g, str(m), str(f), str(m + f)])

        a_table = Table(analysis_data, colWidths=[20*mm, 25*mm, 25*mm, 25*mm])
        a_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), TEAL),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#e2e8f0")),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))

        # Bar chart beside table
        chart_bytes = _make_bar_chart(gc)
        chart_img = Image(io.BytesIO(chart_bytes), width=9*cm, height=5*cm)

        row_t = Table([[a_table, chart_img]], colWidths=["38%", "62%"])
        row_t.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (1, 0), (1, 0), 8),
        ]))
        story.append(row_t)
        story.append(Spacer(1, 5 * mm))

    doc.build(story)
    buf.seek(0)
    return buf.read()

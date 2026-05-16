"""
Seed script for ScholaNexus.
Creates:
  - Default admin user
  - 10 standard subjects
  - 4 classes (Form 1–4)

Run from the backend/ directory:
    python seed.py
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal, engine, Base
from app.core.security import hash_password
from app.models.user import User, UserRole
from app.models.subject import Subject
from app.models.class_ import Class_

# Ensure tables exist
Base.metadata.create_all(bind=engine)


def seed():
    db = SessionLocal()
    try:
        # ── Admin user ──────────────────────────────────────────
        if not db.query(User).filter(User.username == "admin").first():
            admin = User(
                username="admin",
                email="admin@scholanexus.local",
                full_name="System Admin",
                role=UserRole.admin,
                hashed_password=hash_password("admin123"),
                is_active=True,
            )
            db.add(admin)
            print("✓ Admin user created (username=admin, password=admin123)")
        else:
            print("· Admin user already exists, skipping.")

        # ── Subjects ─────────────────────────────────────────────
        subjects_data = [
            ("Mathematics", "MATH"),
            ("English Language", "ENG"),
            ("Physics", "PHY"),
            ("Chemistry", "CHEM"),
            ("Biology", "BIO"),
            ("History", "HIST"),
            ("Geography", "GEO"),
            ("Kiswahili", "KIS"),
            ("Commerce", "COMM"),
            ("Book Keeping", "BK"),
        ]
        for name, code in subjects_data:
            if not db.query(Subject).filter(Subject.code == code).first():
                db.add(Subject(name=name, code=code))
                print(f"✓ Subject created: {name} ({code})")
            else:
                print(f"· Subject {code} already exists, skipping.")

        # ── Classes ──────────────────────────────────────────────
        import datetime
        current_year = str(datetime.datetime.now().year)
        classes_data = ["Form 1", "Form 2", "Form 3", "Form 4"]
        for class_name in classes_data:
            if not db.query(Class_).filter(
                Class_.name == class_name,
                Class_.academic_year == current_year
            ).first():
                db.add(Class_(name=class_name, academic_year=current_year))
                print(f"✓ Class created: {class_name} ({current_year})")
            else:
                print(f"· Class {class_name} ({current_year}) already exists, skipping.")

        db.commit()
        print("\n✅ Seed completed successfully.")
    except Exception as e:
        db.rollback()
        print(f"\n❌ Seed failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()

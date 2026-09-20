"""
Run once (after `alembic upgrade head`) to create a staff user who can
manage orders and coupons:

    python create_staff.py <username>

You'll be prompted for the password so it never appears in shell history
or process listings.
"""
import sys
import getpass

from app.database import SessionLocal
from app import models, auth


def main():
    if len(sys.argv) != 2:
        print("Usage: python create_staff.py <username>")
        sys.exit(1)

    username = sys.argv[1]
    password = getpass.getpass("Password: ")
    confirm = getpass.getpass("Confirm password: ")
    if password != confirm:
        print("Passwords don't match.", file=sys.stderr)
        sys.exit(1)
    if not password:
        print("Password can't be empty.", file=sys.stderr)
        sys.exit(1)

    db = SessionLocal()
    try:
        existing = db.query(models.StaffUser).filter(models.StaffUser.username == username).first()
        if existing:
            print(f"Staff user '{username}' already exists.")
            return
        user = models.StaffUser(username=username, hashed_password=auth.hash_password(password))
        db.add(user)
        db.commit()
        print(f"Created staff user '{username}'.")
    finally:
        db.close()


if __name__ == "__main__":
    main()

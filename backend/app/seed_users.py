import json
import os
from pathlib import Path

from app.db.session import SessionLocal
from app.services.seed_user_service import seed_users


def main() -> None:
    seed_file = Path(
        os.environ.get("SEED_USERS_FILE", Path.cwd() / "seed" / "users.json")
    )
    with seed_file.open(encoding="utf-8") as users_file:
        users = json.load(users_file)

    with SessionLocal() as db:
        seeded_count = seed_users(db, users)

    print(f"Seeded {len(users)} development users ({seeded_count} created, existing accounts refreshed).")


if __name__ == "__main__":
    main()

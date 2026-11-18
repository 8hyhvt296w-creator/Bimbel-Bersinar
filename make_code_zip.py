"""Build a ZIP of the app source (no secrets) and print a one-time download path.

Usage: cd /app/backend && python scripts/make_code_zip.py
"""

import asyncio
import os
import secrets
import sys
import zipfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lib.db import db  # noqa: E402

ROOT = Path("/app")
OUT_DIR = Path("/app/backend/.exports")
EXCLUDE_DIRS = {"node_modules", "__pycache__", ".git", "dist", "build", ".venv", "venv", ".cache", "test_reports",
                ".exports", ".pytest_cache", ".screenshots", "test-results", ".vite", ".emergent"}
EXCLUDE_FILES = {".env", ".env.local", ".env.production", "test_credentials.md"}
INCLUDE_EXTRA = [ROOT / ".emergent" / "crons.yml"]


def build_zip(dest: Path) -> int:
    count = 0
    with zipfile.ZipFile(dest, "w", zipfile.ZIP_DEFLATED) as zf:
        for dirpath, dirnames, filenames in os.walk(ROOT):
            dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIRS]
            for name in filenames:
                if name in EXCLUDE_FILES or name.startswith(".env") or name.endswith((".pyc", ".swp", ".log")):
                    continue
                path = Path(dirpath) / name
                zf.write(path, Path("bimbel-bersinar") / path.relative_to(ROOT))
                count += 1
        for extra in INCLUDE_EXTRA:
            if extra.exists():
                zf.write(extra, Path("bimbel-bersinar") / extra.relative_to(ROOT))
                count += 1
    return count


async def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    filename = f"bimbel-bersinar-kode-{stamp}.zip"
    token = secrets.token_urlsafe(32)
    dest = OUT_DIR / f"{token}.zip"
    n = build_zip(dest)
    now = datetime.now(timezone.utc)
    await db.download_tokens.insert_one({
        "token": token, "path": str(dest), "filename": filename, "used": False,
        "created_at": now, "expires_at": now + timedelta(hours=24),
    })
    print(f"files={n} size={dest.stat().st_size} path=/api/download/{token}")


if __name__ == "__main__":
    asyncio.run(main())

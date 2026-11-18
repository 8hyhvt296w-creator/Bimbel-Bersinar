"""Shared Mongo handle — import `client`/`db` from here (server.py, routers, seed.py)."""

import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING, DESCENDING, IndexModel

load_dotenv(Path(__file__).parent.parent / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

logger = logging.getLogger(__name__)

# One entry per collection: every field a route filters, sorts, or dedupes on. Applied by ensure_indexes() at startup.
INDEXES: dict[str, list[IndexModel]] = {
    "users": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("email", ASCENDING)], name="email", unique=True),
        IndexModel([("role", ASCENDING), ("name", ASCENDING)], name="role_name"),
    ],
    "auth_sessions": [
        IndexModel([("token", ASCENDING)], name="token", unique=True),
        IndexModel([("expires_at", ASCENDING)], name="expires_ttl", expireAfterSeconds=0),
    ],
    "students": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("status", ASCENDING), ("name", ASCENDING)], name="status_name"),
    ],
    "invoices": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("code", ASCENDING)], name="code", unique=True),
        IndexModel([("status", ASCENDING), ("due_date", ASCENDING)], name="status_due"),
        IndexModel([("issued_date", DESCENDING)], name="issued_desc"),
    ],
    "jadwal": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("date", ASCENDING), ("start", ASCENDING)], name="date_start"),
        IndexModel([("tentor_id", ASCENDING), ("date", ASCENDING)], name="tentor_date"),
    ],
    "events": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("date", ASCENDING)], name="date"),
    ],
    "jurnal": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("jadwal_id", ASCENDING)], name="jadwal_id", unique=True),
        IndexModel([("tentor_id", ASCENDING), ("date", DESCENDING)], name="tentor_date"),
        IndexModel([("status", ASCENDING), ("date", DESCENDING)], name="status_date"),
        IndexModel([("attendance.student_id", ASCENDING), ("date", ASCENDING)], name="student_date"),
    ],
    "rapor": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("tentor_id", ASCENDING), ("created_at", DESCENDING)], name="tentor_created"),
        IndexModel([("student_id", ASCENDING), ("subject", ASCENDING), ("period", ASCENDING)], name="student_subject_period"),
    ],
    "settings": [IndexModel([("id", ASCENDING)], name="id", unique=True)],
    "notifications": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("user_id", ASCENDING), ("created_at", DESCENDING)], name="user_created"),
        IndexModel([("user_id", ASCENDING), ("read", ASCENDING)], name="user_read"),
    ],
    "reminder_runs": [IndexModel([("ran_at", DESCENDING)], name="ran_at_desc")],
    "cron_runs": [IndexModel([("run_id", ASCENDING)], name="run_id", unique=True)],
    "download_tokens": [
        IndexModel([("token", ASCENDING)], name="token", unique=True),
        IndexModel([("expires_at", ASCENDING)], name="expires_ttl", expireAfterSeconds=0),
    ],
}


async def ensure_indexes() -> None:
    for collection, models in INDEXES.items():
        for model in models:  # one at a time so a bad spec skips only itself
            try:
                await db[collection].create_indexes([model])
            except Exception as exc:  # never block boot on an index; the log line names what to fix
                logger.error("ensure_indexes(%s.%s): %s", collection, model.document["name"], exc)

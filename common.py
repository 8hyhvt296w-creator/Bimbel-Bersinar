"""Shared helpers used by several routers."""

import os
import uuid
from datetime import datetime, timezone

from lib.dates import today_iso
from lib.db import db
from models.schemas import AttendanceSummary, Jadwal

PACKAGES = {
    "bulanan": {"key": "bulanan", "label": "Paket Bulanan", "price": 500_000, "meetings": None},
    "8x": {"key": "8x", "label": "Paket 8x Pertemuan", "price": 400_000, "meetings": 8},
}
INVOICE_DUE_DAYS = 7
REMINDER_DAYS_BEFORE = 1  # "hampir jatuh tempo" = H-1 (dan hari H)


async def get_settings() -> dict:
    doc = await db.settings.find_one({"id": "main"}, {"_id": 0})
    return doc or {"id": "main", "reminder_email": None, "prices": {}}


async def get_packages() -> dict[str, dict]:
    prices = (await get_settings()).get("prices", {})
    return {k: {**p, "price": prices.get(k, p["price"])} for k, p in PACKAGES.items()}


async def notify(user_ids: list[str], kind: str, title: str, message: str) -> None:
    if not user_ids:
        return
    created = now_iso()
    await db.notifications.insert_many([
        {"id": new_id(), "user_id": uid, "kind": kind, "title": title, "message": message, "created_at": created, "read": False}
        for uid in user_ids
    ])


async def admin_ids() -> list[str]:
    return [u["id"] for u in await db.users.find({"role": "admin"}, {"_id": 0, "id": 1}).to_list(100)]


def new_id() -> str:
    return str(uuid.uuid4())


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def today() -> str:
    return today_iso(os.environ.get("APP_TZ", "Asia/Jakarta"))


async def jadwal_with_status(docs: list[dict], mask_validation: bool) -> list[Jadwal]:
    """Attach journal status to jadwal docs. Tentors never see 'Tervalidasi' (masked as 'Terkirim')."""
    ids = [d["id"] for d in docs]
    journals = await db.jurnal.find({"jadwal_id": {"$in": ids}}, {"_id": 0, "jadwal_id": 1, "status": 1}).to_list(5000)
    by_jadwal = {j["jadwal_id"]: j["status"] for j in journals}
    out = []
    for d in docs:
        status = by_jadwal.get(d["id"], "Belum Diisi")
        if mask_validation and status == "Tervalidasi":
            status = "Terkirim"
        out.append(Jadwal(**{**d, "journal_status": status}))
    return out


async def attendance_summary(student_id: str, date_from: str, date_to: str) -> AttendanceSummary:
    journals = await db.jurnal.find(
        {"attendance.student_id": student_id, "date": {"$gte": date_from, "$lte": date_to}}, {"_id": 0}
    ).to_list(5000)
    s = AttendanceSummary()
    for j in journals:
        for a in j["attendance"]:
            if a["student_id"] != student_id:
                continue
            key = a["status"].lower()
            setattr(s, key, getattr(s, key) + 1)
            s.total += 1
    s.persen = round(s.hadir / s.total * 100, 1) if s.total else 0.0
    return s


async def tentor_student_ids(tentor_id: str) -> set[str]:
    docs = await db.jadwal.find({"tentor_id": tentor_id}, {"_id": 0, "student_ids": 1}).to_list(5000)
    return {sid for d in docs for sid in d["student_ids"]}

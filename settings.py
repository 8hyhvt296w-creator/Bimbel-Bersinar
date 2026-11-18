"""Pengaturan (harga paket, email pengingat), cron pengingat jatuh tempo, notifikasi."""

import asyncio
import hmac
import logging
import os

from fastapi import APIRouter, Depends, HTTPException, Request

from lib.auth import get_current_user, require_admin
from lib.common import PACKAGES, get_packages, get_settings, now_iso
from lib.db import db
from lib.reminders import run_due_reminder
from models.schemas import (
    AppSettings, NotificationList, Notification, PackageInfo, PackagePriceIn, PackagePriceOut, ReminderRun,
    ReminderSettingsIn,
)

router = APIRouter(tags=["settings"])
logger = logging.getLogger(__name__)
_background: set[asyncio.Task] = set()


async def _last_run() -> ReminderRun | None:
    doc = await db.reminder_runs.find_one({}, {"_id": 0}, sort=[("ran_at", -1)])
    return ReminderRun(**doc) if doc else None


@router.get("/settings", response_model=AppSettings, dependencies=[Depends(require_admin)])
async def read_settings():
    s = await get_settings()
    return AppSettings(reminder_email=s.get("reminder_email"), packages=[PackageInfo(**p) for p in (await get_packages()).values()],
                       last_reminder=await _last_run())


@router.put("/settings/reminder", response_model=AppSettings, dependencies=[Depends(require_admin)])
async def update_reminder(body: ReminderSettingsIn):
    await db.settings.update_one({"id": "main"}, {"$set": {"reminder_email": body.reminder_email}}, upsert=True)
    return await read_settings()


@router.put("/settings/packages/{key}", response_model=PackagePriceOut, dependencies=[Depends(require_admin)])
async def update_package_price(key: str, body: PackagePriceIn):
    if key not in PACKAGES:
        raise HTTPException(status_code=404, detail="Paket tidak ditemukan")
    await db.settings.update_one({"id": "main"}, {"$set": {f"prices.{key}": body.price}}, upsert=True)
    # Berlaku juga untuk invoice yang belum dibayar
    res = await db.invoices.update_many({"package": key, "status": "Belum Bayar"}, {"$set": {"amount": body.price}})
    return PackagePriceOut(package=PackageInfo(**(await get_packages())[key]), invoices_updated=res.modified_count)


@router.post("/reminders/run", response_model=ReminderRun, dependencies=[Depends(require_admin)])
async def run_reminder_now():
    return await run_due_reminder("manual")


@router.post("/cron/due-reminder", status_code=202)
async def cron_due_reminder(request: Request):
    # Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
    secret = os.environ.get("WEBHOOK_CRON_SECRET", "")
    auth = request.headers.get("authorization", "")
    token = auth[7:] if auth.lower().startswith("bearer ") else ""
    if not secret or not token or not hmac.compare_digest(token.encode(), secret.encode()):
        raise HTTPException(status_code=401, detail="unauthorized")
    try:
        envelope = await request.json()
    except Exception:
        envelope = None
    if envelope is not None and not isinstance(envelope, dict):
        raise HTTPException(status_code=400, detail="invalid body")
    run_id = request.headers.get("x-webhook-id") or (envelope or {}).get("run_id")
    if run_id:
        res = await db.cron_runs.update_one({"run_id": run_id}, {"$setOnInsert": {"run_id": run_id, "at": now_iso()}}, upsert=True)
        if res.upserted_id is None:
            return {"status": "duplicate"}
    task = asyncio.create_task(run_due_reminder("cron"))
    _background.add(task)
    task.add_done_callback(_background.discard)
    return {"status": "accepted"}


@router.get("/notifications", response_model=NotificationList)
async def list_notifications(user: dict = Depends(get_current_user)):
    docs = await db.notifications.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(30)
    unread = await db.notifications.count_documents({"user_id": user["id"], "read": False})
    return NotificationList(unread=unread, items=[Notification(**d) for d in docs])


@router.post("/notifications/read-all")
async def read_all(user: dict = Depends(get_current_user)):
    await db.notifications.update_many({"user_id": user["id"], "read": False}, {"$set": {"read": True}})
    return {"ok": True}

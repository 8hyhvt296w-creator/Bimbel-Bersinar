"""Jurnal tentor: tentor mengisi, admin memvalidasi. Tentor tidak pernah melihat info honor/validasi."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from lib.auth import get_current_user, require_admin, require_tentor
from lib.common import new_id, now_iso, today
from lib.db import db
from models.schemas import Jurnal, JurnalIn

router = APIRouter(prefix="/jurnal", tags=["jurnal"])


def to_view(doc: dict, is_tentor: bool) -> Jurnal:
    j = Jurnal(**doc)
    if is_tentor:
        j.status = "Terkirim"
        j.validated_at = None
    return j


@router.get("", response_model=list[Jurnal])
async def list_jurnal(status: Optional[str] = None, user: dict = Depends(get_current_user)):
    is_tentor = user["role"] == "tentor"
    q: dict = {}
    if is_tentor:
        q["tentor_id"] = user["id"]
    elif status:
        q["status"] = status
    docs = await db.jurnal.find(q, {"_id": 0}).sort([("date", -1), ("start", -1)]).to_list(5000)
    return [to_view(d, is_tentor) for d in docs]


@router.post("", response_model=Jurnal)
async def submit_jurnal(body: JurnalIn, user: dict = Depends(require_tentor)):
    jadwal = await db.jadwal.find_one({"id": body.jadwal_id}, {"_id": 0})
    if not jadwal or jadwal["tentor_id"] != user["id"]:
        raise HTTPException(status_code=404, detail="Jadwal tidak ditemukan")
    if jadwal["date"] > today():
        raise HTTPException(status_code=400, detail="Jurnal hanya bisa diisi pada hari sesi atau sesudahnya")
    if await db.jurnal.find_one({"jadwal_id": body.jadwal_id}):
        raise HTTPException(status_code=409, detail="Jurnal untuk sesi ini sudah dikirim")
    names = dict(zip(jadwal["student_ids"], jadwal["student_names"]))
    att = {a.student_id: a.status for a in body.attendance}
    if set(att) != set(names):
        raise HTTPException(status_code=422, detail="Absensi harus diisi untuk semua siswa di sesi ini")
    doc = {
        "id": new_id(), "jadwal_id": jadwal["id"], "date": jadwal["date"], "start": jadwal["start"],
        "end": jadwal["end"], "room": jadwal["room"], "subject": jadwal["subject"],
        "tentor_id": user["id"], "tentor_name": user["name"],
        "attendance": [{"student_id": sid, "student_name": names[sid], "status": att[sid]} for sid in jadwal["student_ids"]],
        "materi": body.materi, "catatan": body.catatan, "status": "Terkirim",
        "submitted_at": now_iso(), "validated_at": None,
    }
    await db.jurnal.insert_one(doc)
    doc.pop("_id", None)
    return to_view(doc, True)


@router.post("/{jurnal_id}/validasi", response_model=Jurnal, dependencies=[Depends(require_admin)])
async def validate_jurnal(jurnal_id: str):
    doc = await db.jurnal.find_one({"id": jurnal_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Jurnal tidak ditemukan")
    if doc["status"] == "Tervalidasi":
        raise HTTPException(status_code=409, detail="Jurnal sudah tervalidasi")
    update = {"status": "Tervalidasi", "validated_at": now_iso()}
    await db.jurnal.update_one({"id": jurnal_id}, {"$set": update})
    return Jurnal(**{**doc, **update})

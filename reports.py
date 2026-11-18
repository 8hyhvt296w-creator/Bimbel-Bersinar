"""Payroll (admin), Laporan Belajar & Rapor."""

import calendar as cal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from lib.auth import get_current_user, require_admin, require_tentor
from lib.common import attendance_summary, new_id, now_iso, tentor_student_ids
from lib.db import db
from models.schemas import (
    AttendanceSummary, LaporanEntry, LaporanOut, PayrollOut, PayrollRow, PayrollSession, Rapor, RaporIn,
    RaporPoint, StudentBrief,
)

router = APIRouter(tags=["reports"])


def month_bounds(month: str) -> tuple[str, str]:
    y, m = int(month[:4]), int(month[5:7])
    return f"{month}-01", f"{month}-{cal.monthrange(y, m)[1]:02d}"


# ---------- payroll (privat admin) ----------
@router.get("/payroll", response_model=PayrollOut, dependencies=[Depends(require_admin)])
async def payroll(month: str):
    tentors = await db.users.find({"role": "tentor"}, {"_id": 0, "password_hash": 0}).sort("name", 1).to_list(1000)
    journals = await db.jurnal.find({"date": {"$regex": f"^{month}"}}, {"_id": 0}).sort([("date", 1), ("start", 1)]).to_list(10000)
    rows = []
    for t in tentors:
        mine = [j for j in journals if j["tentor_id"] == t["id"]]
        valid = [j for j in mine if j["status"] == "Tervalidasi"]
        rows.append(PayrollRow(
            tentor_id=t["id"], name=t["name"], subject=t.get("subject", ""), rate_per_session=t["rate_per_session"],
            sesi_sah=len(valid), sesi_menunggu=len(mine) - len(valid), total=len(valid) * t["rate_per_session"],
            details=[PayrollSession(date=j["date"], start=j["start"], end=j["end"], subject=j["subject"], room=j["room"]) for j in valid],
        ))
    return PayrollOut(month=month, rows=rows, total_sesi_sah=sum(r.sesi_sah for r in rows), grand_total=sum(r.total for r in rows))


# ---------- laporan belajar ----------
async def visible_student_ids(user: dict) -> Optional[set[str]]:
    """None = all students (admin)."""
    return None if user["role"] == "admin" else await tentor_student_ids(user["id"])


@router.get("/laporan/students", response_model=list[StudentBrief])
async def laporan_students(user: dict = Depends(get_current_user)):
    ids = await visible_student_ids(user)
    q = {} if ids is None else {"id": {"$in": list(ids)}}
    docs = await db.students.find(q, {"_id": 0}).sort("name", 1).to_list(5000)
    return [StudentBrief(**d) for d in docs]


@router.get("/laporan/{student_id}", response_model=LaporanOut)
async def laporan(student_id: str, date_from: str, date_to: str, user: dict = Depends(get_current_user)):
    ids = await visible_student_ids(user)
    if ids is not None and student_id not in ids:
        raise HTTPException(status_code=403, detail="Siswa ini tidak Anda ajar")
    student = await db.students.find_one({"id": student_id}, {"_id": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Siswa tidak ditemukan")
    journals = await db.jurnal.find(
        {"attendance.student_id": student_id, "date": {"$gte": date_from, "$lte": date_to}}, {"_id": 0}
    ).sort([("date", 1), ("start", 1)]).to_list(5000)
    entries = []
    for j in journals:
        status = next(a["status"] for a in j["attendance"] if a["student_id"] == student_id)
        entries.append(LaporanEntry(date=j["date"], start=j["start"], subject=j["subject"], tentor_name=j["tentor_name"],
                                    materi=j["materi"], catatan=j["catatan"], kehadiran=status))
    return LaporanOut(student=StudentBrief(**student), date_from=date_from, date_to=date_to, entries=entries,
                      summary=await attendance_summary(student_id, date_from, date_to))


# ---------- rapor ----------
@router.get("/rapor/kehadiran", response_model=AttendanceSummary)
async def rapor_kehadiran(student_id: str, period: str, user: dict = Depends(get_current_user)):
    ids = await visible_student_ids(user)
    if ids is not None and student_id not in ids:
        raise HTTPException(status_code=403, detail="Siswa ini tidak Anda ajar")
    return await attendance_summary(student_id, *month_bounds(period))


async def build_rapor_doc(body: RaporIn, tentor: dict) -> dict:
    student = await db.students.find_one({"id": body.student_id}, {"_id": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Siswa tidak ditemukan")
    if body.student_id not in await tentor_student_ids(tentor["id"]):
        raise HTTPException(status_code=403, detail="Siswa ini tidak Anda ajar")
    kehadiran = await attendance_summary(body.student_id, *month_bounds(body.period))
    data = body.model_dump()
    return {
        **data, "student_name": student["name"], "jenjang": student["jenjang"], "program": student["program"],
        "tentor_id": tentor["id"], "tentor_name": tentor["name"], "subject": tentor.get("subject", ""),
        "rata_rata": round((body.nilai_pemahaman + body.nilai_kuis + body.nilai_keaktifan) / 3, 1),
        "kehadiran": kehadiran.model_dump(),
    }


@router.get("/rapor", response_model=list[Rapor])
async def list_rapor(user: dict = Depends(get_current_user)):
    q = {} if user["role"] == "admin" else {"tentor_id": user["id"]}
    docs = await db.rapor.find(q, {"_id": 0}).sort("created_at", -1).to_list(5000)
    return [Rapor(**d) for d in docs]


@router.get("/rapor/{rapor_id}", response_model=Rapor)
async def get_rapor(rapor_id: str, user: dict = Depends(get_current_user)):
    doc = await db.rapor.find_one({"id": rapor_id}, {"_id": 0})
    if not doc or (user["role"] == "tentor" and doc["tentor_id"] != user["id"]):
        raise HTTPException(status_code=404, detail="Rapor tidak ditemukan")
    return Rapor(**doc)


@router.get("/rapor/{rapor_id}/riwayat", response_model=list[RaporPoint])
async def rapor_history(rapor_id: str, user: dict = Depends(get_current_user)):
    """Perkembangan nilai siswa (mapel yang sama) dari bulan ke bulan, sampai periode rapor ini."""
    doc = await get_rapor(rapor_id, user)
    q = {"student_id": doc.student_id, "subject": doc.subject, "period": {"$lte": doc.period},
         "$or": [{"status": "Diterbitkan"}, {"id": doc.id}]}
    docs = await db.rapor.find(q, {"_id": 0}).sort([("period", 1), ("created_at", 1)]).to_list(100)
    return [RaporPoint(period=d["period"], label=d["label"], nilai_pemahaman=d["nilai_pemahaman"], nilai_kuis=d["nilai_kuis"],
                       nilai_keaktifan=d["nilai_keaktifan"], rata_rata=d["rata_rata"], kehadiran_persen=d["kehadiran"]["persen"])
            for d in docs]


@router.post("/rapor", response_model=Rapor)
async def create_rapor(body: RaporIn, user: dict = Depends(require_tentor)):
    doc = {**await build_rapor_doc(body, user), "id": new_id(), "status": "Draft", "created_at": now_iso(), "published_at": None}
    await db.rapor.insert_one(doc)
    doc.pop("_id", None)
    return Rapor(**doc)


@router.put("/rapor/{rapor_id}", response_model=Rapor)
async def update_rapor(rapor_id: str, body: RaporIn, user: dict = Depends(require_tentor)):
    existing = await db.rapor.find_one({"id": rapor_id, "tentor_id": user["id"]}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Rapor tidak ditemukan")
    if existing["status"] == "Diterbitkan":
        raise HTTPException(status_code=409, detail="Rapor sudah diterbitkan, tidak bisa diubah")
    data = await build_rapor_doc(body, user)
    await db.rapor.update_one({"id": rapor_id}, {"$set": data})
    return Rapor(**{**existing, **data})


@router.post("/rapor/{rapor_id}/terbitkan", response_model=Rapor, dependencies=[Depends(require_admin)])
async def publish_rapor(rapor_id: str):
    doc = await db.rapor.find_one({"id": rapor_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Rapor tidak ditemukan")
    if doc["status"] == "Diterbitkan":
        raise HTTPException(status_code=409, detail="Rapor sudah diterbitkan")
    kehadiran = await attendance_summary(doc["student_id"], *month_bounds(doc["period"]))
    update = {"status": "Diterbitkan", "published_at": now_iso(), "kehadiran": kehadiran.model_dump()}
    await db.rapor.update_one({"id": rapor_id}, {"$set": update})
    return Rapor(**{**doc, **update})


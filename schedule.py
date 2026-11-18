"""Jadwal sesi, agenda (Try Out / Libur), kalender bulanan & dashboard."""

from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException

from lib.auth import get_current_user, require_admin
from lib.common import REMINDER_DAYS_BEFORE, jadwal_with_status, new_id, notify, now_iso, tentor_student_ids, today
from lib.db import db
from models.schemas import (
    AdminDashboard, CalendarOut, Event, EventIn, Invoice, Jadwal, JadwalIn, TentorDashboard, TodayOut,
)

router = APIRouter(tags=["schedule"])
BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]


def fmt_tanggal(iso: str) -> str:
    d = date.fromisoformat(iso)
    return f"{d.day} {BULAN[d.month - 1]}"


@router.get("/today", response_model=TodayOut)
async def get_today():
    return TodayOut(today=today())


@router.get("/calendar", response_model=CalendarOut)
async def calendar(month: str, user: dict = Depends(get_current_user)):
    q: dict = {"date": {"$regex": f"^{month}"}}
    is_tentor = user["role"] == "tentor"
    if is_tentor:
        q["tentor_id"] = user["id"]
    docs = await db.jadwal.find(q, {"_id": 0}).sort([("date", 1), ("start", 1)]).to_list(5000)
    sessions = await jadwal_with_status(docs, mask_validation=is_tentor)
    events: list[Event] = []
    if not is_tentor:  # tentor calendar is filtered to own teaching schedule only
        ev = await db.events.find({"date": {"$regex": f"^{month}"}}, {"_id": 0}).sort("date", 1).to_list(1000)
        events = [Event(**e) for e in ev]
    return CalendarOut(month=month, sessions=sessions, events=events)


async def _validate_jadwal(body: JadwalIn, exclude_id: str | None = None) -> dict:
    if body.end <= body.start:
        raise HTTPException(status_code=422, detail="Jam selesai harus setelah jam mulai")
    tentor = await db.users.find_one({"id": body.tentor_id, "role": "tentor"}, {"_id": 0})
    if not tentor:
        raise HTTPException(status_code=404, detail="Tentor tidak ditemukan")
    students = await db.students.find({"id": {"$in": body.student_ids}}, {"_id": 0}).to_list(1000)
    if len(students) != len(set(body.student_ids)):
        raise HTTPException(status_code=404, detail="Ada siswa yang tidak ditemukan")
    inactive = [s["name"] for s in students if s["status"] != "Aktif"]
    if inactive:
        raise HTTPException(status_code=400, detail=f"Siswa belum aktif (invoice belum lunas): {', '.join(inactive)}")

    overlap: dict = {"date": body.date, "start": {"$lt": body.end}, "end": {"$gt": body.start}}
    if exclude_id:
        overlap["id"] = {"$ne": exclude_id}
    clash = await db.jadwal.find_one({**overlap, "tentor_id": body.tentor_id}, {"_id": 0})
    if clash:
        raise HTTPException(
            status_code=409,
            detail=f"Jadwal bentrok: {tentor['name']} sudah mengajar {clash['subject']} pukul "
                   f"{clash['start']}–{clash['end']} di {clash['room']}",
        )
    clash = await db.jadwal.find_one({**overlap, "room": body.room}, {"_id": 0})
    if clash:
        raise HTTPException(
            status_code=409,
            detail=f"Ruangan bentrok: {body.room} sudah dipakai {clash['tentor_name']} ({clash['subject']}) "
                   f"pukul {clash['start']}–{clash['end']}",
        )
    by_id = {s["id"]: s["name"] for s in students}
    return {
        "date": body.date, "start": body.start, "end": body.end, "room": body.room,
        "subject": body.subject, "tentor_id": tentor["id"], "tentor_name": tentor["name"],
        "student_ids": body.student_ids, "student_names": [by_id[i] for i in body.student_ids],
    }


def _desc(d: dict) -> str:
    return f"{d['subject']} {fmt_tanggal(d['date'])} {d['start']}–{d['end']} di {d['room']}"


@router.post("/jadwal", response_model=Jadwal, dependencies=[Depends(require_admin)])
async def create_jadwal(body: JadwalIn):
    doc = {"id": new_id(), **await _validate_jadwal(body)}
    await db.jadwal.insert_one(doc)
    doc.pop("_id", None)
    await notify([doc["tentor_id"]], "jadwal", "Jadwal baru", f"Anda dijadwalkan mengajar {_desc(doc)}")
    return Jadwal(**doc)


@router.put("/jadwal/{jadwal_id}", response_model=Jadwal, dependencies=[Depends(require_admin)])
async def update_jadwal(jadwal_id: str, body: JadwalIn):
    old = await db.jadwal.find_one({"id": jadwal_id}, {"_id": 0})
    if not old:
        raise HTTPException(status_code=404, detail="Jadwal tidak ditemukan")
    if await db.jurnal.find_one({"jadwal_id": jadwal_id}):
        raise HTTPException(status_code=409, detail="Jadwal sudah memiliki jurnal, tidak bisa diubah")
    data = {**await _validate_jadwal(body, exclude_id=jadwal_id), "changed_at": now_iso()}
    await db.jadwal.update_one({"id": jadwal_id}, {"$set": data})
    new = {**old, **data}
    if old["tentor_id"] == new["tentor_id"]:
        await notify([new["tentor_id"]], "jadwal", "Perubahan jadwal", f"{_desc(old)} diubah menjadi {_desc(new)}")
    else:
        await notify([old["tentor_id"]], "jadwal", "Jadwal dialihkan", f"{_desc(old)} dialihkan ke tentor lain")
        await notify([new["tentor_id"]], "jadwal", "Jadwal baru", f"Anda dijadwalkan mengajar {_desc(new)}")
    return Jadwal(**new)


@router.delete("/jadwal/{jadwal_id}", dependencies=[Depends(require_admin)])
async def delete_jadwal(jadwal_id: str):
    if await db.jurnal.find_one({"jadwal_id": jadwal_id}):
        raise HTTPException(status_code=409, detail="Jadwal sudah memiliki jurnal, tidak bisa dihapus")
    old = await db.jadwal.find_one_and_delete({"id": jadwal_id}, {"_id": 0})
    if not old:
        raise HTTPException(status_code=404, detail="Jadwal tidak ditemukan")
    await notify([old["tentor_id"]], "jadwal", "Jadwal dibatalkan", f"Sesi {_desc(old)} dibatalkan oleh Admin")
    return {"ok": True}


@router.post("/events", response_model=Event, dependencies=[Depends(require_admin)])
async def create_event(body: EventIn):
    ev = Event(id=new_id(), **body.model_dump())
    await db.events.insert_one(ev.model_dump())
    return ev


@router.delete("/events/{event_id}", dependencies=[Depends(require_admin)])
async def delete_event(event_id: str):
    res = await db.events.delete_one({"id": event_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Agenda tidak ditemukan")
    return {"ok": True}


@router.get("/dashboard/admin", response_model=AdminDashboard, dependencies=[Depends(require_admin)])
async def admin_dashboard():
    t = today()
    total = await db.students.count_documents({})
    aktif = await db.students.count_documents({"status": "Aktif"})
    unpaid = await db.invoices.find({"status": "Belum Bayar"}, {"_id": 0}).sort("due_date", 1).to_list(5000)
    paid_month = await db.invoices.find({"status": "Lunas", "paid_date": {"$regex": f"^{t[:7]}"}}, {"_id": 0}).to_list(5000)
    today_docs = await db.jadwal.find({"date": t}, {"_id": 0}).sort("start", 1).to_list(500)
    soon_limit = (date.fromisoformat(t) + timedelta(days=REMINDER_DAYS_BEFORE)).isoformat()
    return AdminDashboard(
        today=t, total_siswa=total, siswa_aktif=aktif, siswa_belum_aktif=total - aktif,
        tentor_count=await db.users.count_documents({"role": "tentor"}),
        invoice_belum_bayar=len(unpaid), invoice_belum_bayar_total=sum(i["amount"] for i in unpaid),
        invoice_lewat_tempo=sum(1 for i in unpaid if i["due_date"] < t),
        invoice_hampir_tempo=sum(1 for i in unpaid if t <= i["due_date"] <= soon_limit),
        pendapatan_bulan_ini=sum(i["amount"] for i in paid_month),
        jurnal_menunggu=await db.jurnal.count_documents({"status": "Terkirim"}),
        sesi_hari_ini=await jadwal_with_status(today_docs, mask_validation=False),
        invoice_jatuh_tempo=[Invoice(**i) for i in unpaid[:5]],
    )


@router.get("/dashboard/tentor", response_model=TentorDashboard)
async def tentor_dashboard(user: dict = Depends(get_current_user)):
    if user["role"] != "tentor":
        raise HTTPException(status_code=403, detail="Khusus Tentor")
    t = today()
    today_docs = await db.jadwal.find({"tentor_id": user["id"], "date": t}, {"_id": 0}).sort("start", 1).to_list(100)
    past_docs = await db.jadwal.find({"tentor_id": user["id"], "date": {"$lte": t}}, {"_id": 0}).sort(
        [("date", -1), ("start", -1)]).to_list(5000)
    past = await jadwal_with_status(past_docs, mask_validation=True)
    return TentorDashboard(
        today=t,
        sesi_hari_ini=await jadwal_with_status(today_docs, mask_validation=True),
        jurnal_belum_diisi=[j for j in past if j.journal_status == "Belum Diisi"],
        jurnal_terkirim_bulan_ini=await db.jurnal.count_documents({"tentor_id": user["id"], "date": {"$regex": f"^{t[:7]}"}}),
        siswa_diajar=len(await tentor_student_ids(user["id"])),
    )

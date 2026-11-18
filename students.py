"""Siswa, paket & invoice — khusus Admin."""

from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from lib.auth import require_admin
from lib.common import INVOICE_DUE_DAYS, get_packages, new_id, now_iso, today
from lib.db import db
from models.schemas import (
    Invoice, InvoicePayIn, InvoiceRenewIn, PackageInfo, Student, StudentCreated, StudentIn, StudentUpdate,
)

router = APIRouter(tags=["students"], dependencies=[Depends(require_admin)])


async def issue_invoice(student: dict, package: str, amount: Optional[int]) -> Invoice:
    pkg = (await get_packages())[package]
    issued = today()
    due = (date.fromisoformat(issued) + timedelta(days=INVOICE_DUE_DAYS)).isoformat()
    prefix = f"INV-{issued[:4]}{issued[5:7]}-"
    count = await db.invoices.count_documents({"code": {"$regex": f"^{prefix}"}})
    inv = Invoice(
        id=new_id(), code=f"{prefix}{count + 1:04d}", student_id=student["id"], student_name=student["name"],
        package=package, package_label=pkg["label"], amount=amount if amount is not None else pkg["price"],
        issued_date=issued, due_date=due, status="Belum Bayar",
    )
    await db.invoices.insert_one(inv.model_dump())
    return inv


@router.get("/packages", response_model=list[PackageInfo])
async def list_packages():
    return [PackageInfo(**p) for p in (await get_packages()).values()]


@router.get("/students", response_model=list[Student])
async def list_students(status: Optional[str] = None):
    q = {"status": status} if status else {}
    docs = await db.students.find(q, {"_id": 0}).sort("name", 1).to_list(5000)
    return [Student(**d) for d in docs]


@router.post("/students", response_model=StudentCreated)
async def create_student(body: StudentIn):
    data = body.model_dump(exclude={"amount"})
    student = Student(id=new_id(), status="Belum Aktif", created_at=now_iso(), **data)
    await db.students.insert_one(student.model_dump())
    invoice = await issue_invoice(student.model_dump(), body.package, body.amount)
    return StudentCreated(student=student, invoice=invoice)


@router.put("/students/{student_id}", response_model=Student)
async def update_student(student_id: str, body: StudentUpdate):
    data = body.model_dump(exclude_none=True)
    student = await db.students.find_one({"id": student_id}, {"_id": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Siswa tidak ditemukan")
    if data:
        await db.students.update_one({"id": student_id}, {"$set": data})
        if "name" in data and data["name"] != student["name"]:
            # keep denormalised names in sync
            await db.invoices.update_many({"student_id": student_id}, {"$set": {"student_name": data["name"]}})
            await db.rapor.update_many({"student_id": student_id}, {"$set": {"student_name": data["name"]}})
            await db.jurnal.update_many({"attendance.student_id": student_id}, {"$set": {"attendance.$[a].student_name": data["name"]}},
                                        array_filters=[{"a.student_id": student_id}])
            async for j in db.jadwal.find({"student_ids": student_id}, {"_id": 0, "id": 1, "student_ids": 1, "student_names": 1}):
                names = [data["name"] if sid == student_id else n for sid, n in zip(j["student_ids"], j["student_names"])]
                await db.jadwal.update_one({"id": j["id"]}, {"$set": {"student_names": names}})
        if "jenjang" in data or "program" in data:
            await db.rapor.update_many({"student_id": student_id}, {"$set": {k: data[k] for k in ("jenjang", "program") if k in data}})
    return Student(**{**student, **data})


@router.post("/students/{student_id}/invoice", response_model=Invoice)
async def renew_invoice(student_id: str, body: InvoiceRenewIn):
    student = await db.students.find_one({"id": student_id}, {"_id": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Siswa tidak ditemukan")
    package = body.package or student["package"]
    return await issue_invoice(student, package, body.amount)


@router.get("/invoices", response_model=list[Invoice])
async def list_invoices(status: Optional[str] = None):
    q = {"status": status} if status else {}
    docs = await db.invoices.find(q, {"_id": 0}).sort("issued_date", -1).to_list(5000)
    return [Invoice(**d) for d in docs]


@router.get("/invoices/{invoice_id}", response_model=Invoice)
async def get_invoice(invoice_id: str):
    doc = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Invoice tidak ditemukan")
    return Invoice(**doc)


@router.post("/invoices/{invoice_id}/lunas", response_model=Invoice)
async def mark_paid(invoice_id: str, body: InvoicePayIn):
    doc = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Invoice tidak ditemukan")
    if doc["status"] == "Lunas":
        raise HTTPException(status_code=409, detail="Invoice sudah lunas")
    update = {"status": "Lunas", "paid_date": body.paid_date or today(), "method": body.method}
    await db.invoices.update_one({"id": invoice_id}, {"$set": update})
    # Aktivasi siswa otomatis
    await db.students.update_one({"id": doc["student_id"]}, {"$set": {"status": "Aktif"}})
    return Invoice(**{**doc, **update})

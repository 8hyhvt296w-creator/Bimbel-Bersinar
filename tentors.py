"""Data tentor + tarif honor (rahasia) — khusus Admin."""

from fastapi import APIRouter, Depends, HTTPException

from lib.auth import hash_password, require_admin
from lib.common import new_id, now_iso
from lib.db import db
from models.schemas import TentorAdmin, TentorIn, TentorUpdate

router = APIRouter(prefix="/tentors", tags=["tentors"], dependencies=[Depends(require_admin)])


@router.get("", response_model=list[TentorAdmin])
async def list_tentors():
    docs = await db.users.find({"role": "tentor"}, {"_id": 0, "password_hash": 0}).sort("name", 1).to_list(1000)
    return [TentorAdmin(**d) for d in docs]


@router.post("", response_model=TentorAdmin)
async def create_tentor(body: TentorIn):
    email = body.email.strip().lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=409, detail="Email sudah terdaftar")
    doc = {
        "id": new_id(), "email": email, "name": body.name, "role": "tentor", "subject": body.subject,
        "phone": body.phone, "rate_per_session": body.rate_per_session,
        "password_hash": hash_password(body.password), "active": True, "created_at": now_iso(),
    }
    await db.users.insert_one(doc)
    return TentorAdmin(**doc)


@router.patch("/{tentor_id}", response_model=TentorAdmin)
async def update_tentor(tentor_id: str, body: TentorUpdate):
    data = body.model_dump(exclude_none=True)
    if "password" in data:
        data["password_hash"] = hash_password(data.pop("password"))
    if data:
        res = await db.users.update_one({"id": tentor_id, "role": "tentor"}, {"$set": data})
        if res.matched_count == 0:
            raise HTTPException(status_code=404, detail="Tentor tidak ditemukan")
    doc = await db.users.find_one({"id": tentor_id, "role": "tentor"}, {"_id": 0, "password_hash": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Tentor tidak ditemukan")
    if "name" in data:
        await db.jadwal.update_many({"tentor_id": tentor_id}, {"$set": {"tentor_name": data["name"]}})
    return TentorAdmin(**doc)

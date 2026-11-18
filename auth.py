from fastapi import APIRouter, Depends, HTTPException, Request, Response

from lib.auth import create_session, destroy_session, get_current_user, verify_password
from lib.db import db
from models.schemas import LoginIn, Me

router = APIRouter(prefix="/auth", tags=["auth"])


def to_me(user: dict) -> Me:
    return Me(id=user["id"], email=user["email"], name=user["name"], role=user["role"], subject=user.get("subject"))


@router.post("/login", response_model=Me)
async def login(body: LoginIn, response: Response):
    user = await db.users.find_one({"email": body.email.strip().lower()}, {"_id": 0})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Email atau password salah")
    await create_session(response, user["id"])
    return to_me(user)


@router.post("/logout")
async def logout(request: Request, response: Response):
    await destroy_session(request, response)
    return {"ok": True}


@router.get("/me", response_model=Me)
async def me(user: dict = Depends(get_current_user)):
    return to_me(user)

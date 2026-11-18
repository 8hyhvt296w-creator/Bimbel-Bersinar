"""One-time download links (created by scripts/make_code_zip.py). Token is the credential; consumed on first use."""

import os
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask

from lib.db import db

router = APIRouter(prefix="/download", tags=["download"])


def _cleanup(path: str) -> None:
    try:
        os.remove(path)
    except FileNotFoundError:
        pass


@router.get("/{token}")
async def download(token: str):
    now = datetime.now(timezone.utc)
    doc = await db.download_tokens.find_one_and_update(
        {"token": token, "used": False, "expires_at": {"$gt": now}},
        {"$set": {"used": True, "used_at": now}},
    )
    if not doc or not os.path.exists(doc["path"]):
        raise HTTPException(status_code=404, detail="Link unduhan tidak valid, sudah dipakai, atau kedaluwarsa")
    return FileResponse(
        doc["path"], media_type="application/zip", filename=doc["filename"],
        background=BackgroundTask(_cleanup, doc["path"]),
    )

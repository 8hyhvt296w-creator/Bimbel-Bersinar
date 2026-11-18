"""Pengingat invoice jatuh tempo: notifikasi in-app untuk Admin + email ringkasan."""

import logging
from datetime import date, timedelta
from html import escape

from lib.common import REMINDER_DAYS_BEFORE, admin_ids, get_settings, new_id, notify, now_iso, today
from lib.db import db
from lib.email import EmailError, send_email
from models.schemas import ReminderRun

logger = logging.getLogger(__name__)
BRAND = "Bimbel Bersinar"


def _rupiah(n: int) -> str:
    return "Rp " + f"{n:,}".replace(",", ".")


def _rows(invoices: list[dict], color: str) -> str:
    return "".join(
        f'<tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-family:monospace;font-size:12px">{escape(i["code"])}</td>'
        f'<td style="padding:8px;border-bottom:1px solid #e2e8f0">{escape(i["student_name"])}</td>'
        f'<td style="padding:8px;border-bottom:1px solid #e2e8f0;color:{color}">{escape(i["due_date"])}</td>'
        f'<td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right">{_rupiah(i["amount"])}</td></tr>'
        for i in invoices
    )


def _section(title: str, invoices: list[dict], color: str) -> str:
    if not invoices:
        return ""
    return (f'<h3 style="margin:20px 0 8px;color:{color};font-size:15px">{escape(title)} ({len(invoices)})</h3>'
            f'<table role="presentation" width="100%" style="border-collapse:collapse;font-size:13px">'
            f'<tr style="background:#f1f5f9;text-align:left"><th style="padding:8px">No. Invoice</th><th style="padding:8px">Siswa</th>'
            f'<th style="padding:8px">Jatuh Tempo</th><th style="padding:8px;text-align:right">Nominal</th></tr>'
            f'{_rows(invoices, color)}</table>')


def build_email(t: str, soon: list[dict], overdue: list[dict]) -> tuple[str, str]:
    subject = f"Pengingat tagihan {BRAND}: {len(overdue)} lewat tempo, {len(soon)} jatuh tempo segera"
    total = sum(i["amount"] for i in soon + overdue)
    html = (
        '<table role="presentation" width="100%"><tr><td style="padding:24px;font-family:Arial,sans-serif;color:#0f172a">'
        f'<h2 style="margin:0 0 4px">Pengingat Invoice — {escape(t)}</h2>'
        f'<p style="margin:0;color:#475569">Total tagihan perlu ditindaklanjuti: <strong>{_rupiah(total)}</strong></p>'
        f'{_section("Sudah lewat jatuh tempo", overdue, "#b91c1c")}'
        f'{_section("Jatuh tempo hari ini / besok", soon, "#b45309")}'
        '<p style="margin-top:20px;color:#475569">Buka menu Invoice di aplikasi untuk menandai pembayaran yang sudah diterima.</p>'
        f'<p style="font-size:12px;color:#94a3b8">Email otomatis dari {escape(BRAND)}. Kami tidak pernah meminta password melalui email.</p>'
        '</td></tr></table>'
    )
    return subject, html


async def run_due_reminder(trigger: str) -> ReminderRun:
    t = today()
    limit = (date.fromisoformat(t) + timedelta(days=REMINDER_DAYS_BEFORE)).isoformat()
    unpaid = await db.invoices.find({"status": "Belum Bayar", "due_date": {"$lte": limit}}, {"_id": 0}).sort("due_date", 1).to_list(5000)
    overdue = [i for i in unpaid if i["due_date"] < t]
    soon = [i for i in unpaid if i["due_date"] >= t]

    detail = ""
    if not unpaid:
        status = "Tidak ada tagihan"
    else:
        parts = []
        if overdue:
            parts.append(f"{len(overdue)} invoice lewat jatuh tempo")
        if soon:
            parts.append(f"{len(soon)} invoice jatuh tempo hari ini/besok")
        names = ", ".join(i["student_name"] for i in (overdue + soon)[:5])
        await notify(await admin_ids(), "jatuh_tempo", "Pengingat jatuh tempo", f"{' dan '.join(parts)}: {names}")
        email = (await get_settings()).get("reminder_email")
        if not email:
            status, detail = "Email belum diatur", "Atur email penerima di menu Pengaturan"
        else:
            subject, html = build_email(t, soon, overdue)
            try:
                await send_email(to=email, subject=subject, html=html)
                status, detail = "Terkirim", email
            except EmailError as e:
                status, detail = "Gagal", str(e)
    run = ReminderRun(id=new_id(), date=t, ran_at=now_iso(), trigger=trigger, due_soon=len(soon), overdue=len(overdue),
                      email_status=status, detail=detail)
    await db.reminder_runs.insert_one(run.model_dump())
    logger.info("Due reminder (%s): %s", trigger, run.model_dump())
    return run

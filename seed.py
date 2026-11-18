"""Seed data demo bimbel. Idempotent: drops app collections and reseeds. Run: cd /app/backend && python seed.py"""

import asyncio
import calendar as cal
from datetime import date, timedelta

from lib.auth import hash_password
from lib.common import PACKAGES, new_id, now_iso, today
from lib.db import db, ensure_indexes

COLLECTIONS = ["users", "auth_sessions", "students", "invoices", "jadwal", "events", "jurnal", "rapor",
               "settings", "notifications", "reminder_runs", "cron_runs"]

TENTORS = [
    ("siti", "Siti Rahma", "siti@bimbel.id", "Matematika", 85_000),
    ("andi", "Andi Pratama", "andi@bimbel.id", "Fisika", 90_000),
    ("dewi", "Dewi Lestari", "dewi@bimbel.id", "Bahasa Inggris", 75_000),
    ("rizky", "Rizky Hidayat", "rizky@bimbel.id", "Biologi", 80_000),
]

STUDENTS = [  # key, name, jenjang, program, school, parent, package, paid
    ("s1", "Aditya Nugroho", "SMA", "Intensif UTBK Saintek", "SMAN 3 Bandung", "Bapak Nugroho", "bulanan", True),
    ("s2", "Bunga Citra", "SMA", "Intensif UTBK Saintek", "SMAN 5 Bandung", "Ibu Ratna", "bulanan", True),
    ("s3", "Cahya Putri", "SMA", "Reguler SMA IPA", "SMA Taruna Bakti", "Ibu Sari", "8x", True),
    ("s4", "Dimas Saputra", "SMA", "Reguler SMA IPA", "SMAN 8 Bandung", "Bapak Hendra", "bulanan", True),
    ("s5", "Eka Pramesti", "SMP", "Reguler SMP", "SMPN 2 Bandung", "Ibu Wulan", "8x", True),
    ("s6", "Fajar Ramadhan", "SMP", "Reguler SMP", "SMPN 5 Bandung", "Bapak Ahmad", "bulanan", True),
    ("s7", "Gita Maharani", "SMP", "Persiapan ANBK SMP", "SMP Santa Angela", "Ibu Maya", "8x", True),
    ("s8", "Hana Safitri", "SMA", "Reguler SMA IPA", "SMAN 2 Bandung", "Bapak Yusuf", "bulanan", True),
    ("s9", "Irfan Maulana", "SD", "Calistung & Matematika SD", "SDN Merdeka 5", "Ibu Lina", "8x", False),
    ("s10", "Jasmine Aulia", "SD", "Persiapan Masuk SMP", "SD Al-Azhar", "Bapak Rudi", "bulanan", False),
]

# weekday (0=Mon) -> list of (tentor, start, end, room, students)
PATTERN = {
    0: [("siti", "15:00", "16:30", "Ruang A", ["s1", "s2", "s3"]), ("dewi", "16:00", "17:30", "Ruang B", ["s5", "s6", "s7"])],
    1: [("andi", "15:00", "16:30", "Ruang A", ["s1", "s2", "s4"]), ("rizky", "16:00", "17:30", "Ruang B", ["s3", "s4", "s8"])],
    2: [("siti", "15:00", "16:30", "Ruang A", ["s1", "s2", "s3"]), ("rizky", "16:00", "17:30", "Ruang B", ["s3", "s4", "s8"])],
    3: [("andi", "15:00", "16:30", "Ruang A", ["s1", "s2", "s4"]), ("dewi", "16:00", "17:30", "Ruang B", ["s5", "s6", "s7"])],
    4: [("siti", "15:00", "16:30", "Ruang A", ["s1", "s2", "s3"]), ("dewi", "13:00", "14:30", "Ruang B", ["s5", "s6", "s7"])],
}

MATERI = {
    "siti": ["Limit fungsi aljabar", "Turunan fungsi & aplikasinya", "Integral tak tentu", "Barisan & deret", "Peluang kejadian majemuk", "Statistika data berkelompok", "Matriks & determinan", "Trigonometri lanjutan", "Pembahasan soal UTBK TPS kuantitatif"],
    "andi": ["Kinematika gerak lurus", "Hukum Newton", "Usaha & energi", "Momentum & impuls", "Fluida statis", "Listrik dinamis", "Gelombang mekanik", "Optik geometri"],
    "dewi": ["Simple past vs present perfect", "Reading comprehension: narrative text", "Descriptive text", "Conditional sentences", "Passive voice", "Vocabulary building", "Listening practice", "Procedure text"],
    "rizky": ["Sel & organel", "Sistem pencernaan", "Sistem peredaran darah", "Genetika Mendel", "Evolusi", "Ekosistem", "Bioteknologi", "Sistem saraf"],
}
STATUSES = ["Hadir", "Hadir", "Hadir", "Hadir", "Hadir", "Izin", "Hadir", "Sakit", "Hadir", "Hadir", "Alpha", "Hadir"]


async def main():
    for c in COLLECTIONS:
        await db[c].drop()
    await ensure_indexes()

    t = date.fromisoformat(today())
    month = t.strftime("%Y-%m")
    first = t.replace(day=1)
    last = t.replace(day=cal.monthrange(t.year, t.month)[1])

    await db.users.insert_one({
        "id": new_id(), "email": "admin@bimbel.id", "name": "Budi Santoso", "role": "admin", "subject": None,
        "phone": "0812-1111-0000", "rate_per_session": 0, "password_hash": hash_password("admin123"),
        "active": True, "created_at": now_iso(),
    })
    tid = {}
    for key, name, email, subject, rate in TENTORS:
        tid[key] = {"id": new_id(), "name": name}
        await db.users.insert_one({
            "id": tid[key]["id"], "email": email, "name": name, "role": "tentor", "subject": subject,
            "phone": "0813-2222-" + str(rate)[:4], "rate_per_session": rate, "password_hash": hash_password("tentor123"),
            "active": True, "created_at": now_iso(),
        })
    subject_of = {k: s for k, _, _, s, _ in TENTORS}

    sid = {}
    issued = (first - timedelta(days=3)).isoformat()
    for i, (key, name, jenjang, program, school, parent, pkg, paid) in enumerate(STUDENTS, start=1):
        sid[key] = {"id": new_id(), "name": name}
        await db.students.insert_one({
            "id": sid[key]["id"], "name": name, "jenjang": jenjang, "program": program, "school": school,
            "phone": f"0857-{1000 + i}-{2000 + i}", "parent_name": parent, "parent_phone": f"0811-{3000 + i}-{4000 + i}",
            "package": pkg, "status": "Aktif" if paid else "Belum Aktif", "created_at": now_iso(),
        })
        # Belum bayar: Irfan lewat tempo 1 hari, Jasmine jatuh tempo besok (contoh pengingat)
        inv_issued = issued if paid else (t - timedelta(days=8 if key == "s9" else 6)).isoformat()
        await db.invoices.insert_one({
            "id": new_id(), "code": f"INV-{inv_issued[:4]}{inv_issued[5:7]}-{i:04d}", "student_id": sid[key]["id"],
            "student_name": name, "package": pkg, "package_label": PACKAGES[pkg]["label"], "amount": PACKAGES[pkg]["price"],
            "issued_date": inv_issued, "due_date": (date.fromisoformat(inv_issued) + timedelta(days=7)).isoformat(),
            "status": "Lunas" if paid else "Belum Bayar", "paid_date": first.isoformat() if paid else None,
            "method": "Transfer Bank" if paid else None,
        })

    # Agenda: hari libur & try out
    holiday = first + timedelta(days=(2 - first.weekday()) % 7 + 14)  # 3rd Wednesday
    if holiday == t:
        holiday += timedelta(days=7) if holiday + timedelta(days=7) <= last else timedelta(days=-7)
    tryout = first + timedelta(days=(5 - first.weekday()) % 7 + 7)  # 2nd Saturday
    await db.events.insert_many([
        {"id": new_id(), "date": holiday.isoformat(), "title": "Libur Bimbel", "type": "libur", "note": "Kegiatan belajar diliburkan"},
        {"id": new_id(), "date": tryout.isoformat(), "title": "Try Out UTBK #1", "type": "tryout", "note": "08:00–12:00, Aula"},
        {"id": new_id(), "date": (tryout + timedelta(days=14)).isoformat() if tryout + timedelta(days=14) <= last else (tryout - timedelta(days=7)).isoformat(),
         "title": "Try Out ANBK SMP", "type": "tryout", "note": "09:00–11:00, Ruang A & B"},
    ])

    # Jadwal sebulan + jurnal untuk sesi lampau
    jadwal_docs, jurnal_docs = [], []
    materi_idx = {k: 0 for k in tid}
    status_idx = 0
    d = first
    while d <= last:
        slots = list(PATTERN.get(d.weekday(), [])) if d != holiday else []
        if d == t and not any(s[0] == "siti" for s in slots):
            slots.append(("siti", "13:00", "14:30", "Ruang C", ["s1", "s2", "s3"]))
        for tk, start, end, room, studs in slots:
            j = {
                "id": new_id(), "date": d.isoformat(), "start": start, "end": end, "room": room,
                "subject": subject_of[tk], "tentor_id": tid[tk]["id"], "tentor_name": tid[tk]["name"],
                "student_ids": [sid[s]["id"] for s in studs], "student_names": [sid[s]["name"] for s in studs],
            }
            jadwal_docs.append(j)
            if d < t:
                att = []
                for s in studs:
                    att.append({"student_id": sid[s]["id"], "student_name": sid[s]["name"], "status": STATUSES[status_idx % len(STATUSES)]})
                    status_idx += 1
                m = MATERI[tk][materi_idx[tk] % len(MATERI[tk])]
                materi_idx[tk] += 1
                validated = (t - d).days > 3
                jurnal_docs.append({
                    "id": new_id(), "jadwal_id": j["id"], "date": j["date"], "start": start, "end": end, "room": room,
                    "subject": j["subject"], "tentor_id": j["tentor_id"], "tentor_name": j["tentor_name"], "attendance": att,
                    "materi": m, "catatan": f"Kelas cukup aktif membahas {m.lower()}. Perlu latihan soal tambahan di rumah.",
                    "status": "Tervalidasi" if validated else "Terkirim", "submitted_at": now_iso(),
                    "validated_at": now_iso() if validated else None,
                })
        d += timedelta(days=1)

    # Sisakan satu sesi lampau Siti tanpa jurnal (contoh "Belum Diisi")
    siti_past = [j for j in jurnal_docs if j["tentor_id"] == tid["siti"]["id"]]
    if siti_past:
        jurnal_docs.remove(siti_past[-1])
    if jadwal_docs:
        await db.jadwal.insert_many(jadwal_docs)
    if jurnal_docs:
        await db.jurnal.insert_many(jurnal_docs)

    # Rapor contoh
    from lib.common import attendance_summary
    rapors = [
        ("s1", "siti", 86, 82, 90, "Diterbitkan", "Pemahaman konsep limit & turunan sangat baik. Teliti dalam perhitungan.", "Perbanyak latihan soal HOTS."),
        ("s2", "siti", 74, 70, 80, "Draft", "Sudah memahami konsep dasar, masih ragu pada soal cerita.", "Latihan soal cerita 3x seminggu."),
        ("s5", "dewi", 88, 85, 92, "Diterbitkan", "Grammar dan vocabulary berkembang pesat. Percaya diri saat speaking.", "Mulai latihan reading teks panjang."),
    ]
    for skey, tk, p, k, a, status, catatan, rek in rapors:
        st = next(x for x in STUDENTS if x[0] == skey)
        keh = await attendance_summary(sid[skey]["id"], first.isoformat(), last.isoformat())
        await db.rapor.insert_one({
            "id": new_id(), "student_id": sid[skey]["id"], "student_name": st[1], "jenjang": st[2], "program": st[3],
            "tentor_id": tid[tk]["id"], "tentor_name": tid[tk]["name"], "subject": subject_of[tk], "period": month,
            "label": "Rapor Bulanan", "nilai_pemahaman": p, "nilai_kuis": k, "nilai_keaktifan": a,
            "rata_rata": round((p + k + a) / 3, 1), "kehadiran": keh.model_dump(), "catatan": catatan, "rekomendasi": rek,
            "status": status, "created_at": now_iso(), "published_at": now_iso() if status == "Diterbitkan" else None,
        })

    # Riwayat rapor 3 bulan sebelumnya (untuk grafik perkembangan nilai)
    history = {
        "s1": ("siti", [(72, 68, 80, 85.0), (78, 75, 84, 90.0), (81, 79, 88, 92.0)]),
        "s5": ("dewi", [(75, 70, 82, 80.0), (80, 78, 86, 88.0), (84, 82, 90, 93.0)]),
    }
    for skey, (tk, points) in history.items():
        st = next(x for x in STUDENTS if x[0] == skey)
        for back, (p, k, a, pct) in zip((3, 2, 1), points):
            y, m = t.year, t.month - back
            while m <= 0:
                y, m = y - 1, m + 12
            total = 12
            hadir = round(total * pct / 100)
            await db.rapor.insert_one({
                "id": new_id(), "student_id": sid[skey]["id"], "student_name": st[1], "jenjang": st[2], "program": st[3],
                "tentor_id": tid[tk]["id"], "tentor_name": tid[tk]["name"], "subject": subject_of[tk], "period": f"{y}-{m:02d}",
                "label": "Rapor Bulanan", "nilai_pemahaman": p, "nilai_kuis": k, "nilai_keaktifan": a,
                "rata_rata": round((p + k + a) / 3, 1),
                "kehadiran": {"hadir": hadir, "izin": total - hadir, "sakit": 0, "alpha": 0, "total": total, "persen": round(hadir / total * 100, 1)},
                "catatan": "Perkembangan stabil.", "rekomendasi": "", "status": "Diterbitkan",
                "created_at": f"{y}-{m:02d}-28T10:00:00+00:00", "published_at": f"{y}-{m:02d}-28T10:00:00+00:00",
            })

    await db.notifications.insert_one({
        "id": new_id(), "user_id": tid["siti"]["id"], "kind": "jadwal", "title": "Perubahan jadwal",
        "message": "Contoh: sesi Matematika dipindah ke Ruang A pukul 15:00–16:30", "created_at": now_iso(), "read": False,
    })

    print(f"Seeded: {len(jadwal_docs)} jadwal, {len(jurnal_docs)} jurnal, {len(STUDENTS)} siswa, {len(TENTORS)} tentor. Today={t}")


if __name__ == "__main__":
    asyncio.run(main())

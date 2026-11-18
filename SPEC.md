# Bimbel Bersinar — Administrasi Bimbel (SPEC)

UI language: Bahasa Indonesia. "Today" is server-anchored (APP_TZ=Asia/Jakarta, `GET /api/today`).

## Roles & auth
- Email + password login, httpOnly cookie `bimbel_session` (POST /api/auth/login, /logout, GET /api/auth/me).
- **Admin**: everything. **Tentor**: own schedule/journals/rapor; laporan for students in own jadwal. Tentor NEVER receives money data (rate, invoices, payroll) — backend gates with require_admin (403).
- Tentor sees journal status only as `Terkirim` (Tervalidasi masked server-side).

## Data model (Mongo, string uuid `id`)
- users {id,email,name,role,subject,phone,rate_per_session,password_hash}
- students {id,name,jenjang SD/SMP/SMA/Alumni,program,school,phone,parent_name,parent_phone,package bulanan|8x,status Aktif|Belum Aktif}
- invoices {id,code INV-YYYYMM-NNNN,student_id,package,amount,issued_date,due_date(+7d),status Belum Bayar|Lunas,paid_date,method}
- jadwal {id,date,start,end,room,subject,tentor_id,student_ids,student_names}
- events {id,date,title,type tryout|libur,note}
- jurnal {id,jadwal_id(unique),date,...,attendance[{student_id,status Hadir/Izin/Sakit/Alpha}],materi,catatan,status Terkirim|Tervalidasi}
- rapor {id,student_id,tentor_id,period YYYY-MM,label,nilai_pemahaman/kuis/keaktifan,rata_rata,kehadiran{...persen},catatan,rekomendasi,status Draft|Diterbitkan}

## Key flows
1. Admin adds student (POST /api/students) → invoice auto (Belum Bayar). POST /api/invoices/{id}/lunas → student Aktif. Renewal: POST /api/students/{id}/invoice.
2. Admin adds tentor with secret rate (/api/tentors). POST /api/jadwal blocks (409) on tentor or room overlap same date; only Aktif students allowed (400). GET /api/calendar?month= → admin: all sessions + events; tentor: own sessions only, no events.
3. Tentor POST /api/jurnal (own jadwal, date <= today, once). Admin POST /api/jurnal/{id}/validasi. GET /api/payroll?month= → sesi_sah × rate.
4. GET /api/laporan/{student_id}?date_from&date_to (from journals). Rapor: tentor POST/PUT /api/rapor (Draft), attendance auto from journals of that month; admin POST /api/rapor/{id}/terbitkan.
- Print pages: /cetak/invoice/:id, /cetak/payroll?month=, /cetak/laporan/:id?from&to, /cetak/rapor/:id (browser print / Save as PDF). WA text copy on Laporan & Rapor (admin).

## Seed (cd /app/backend && python seed.py — drops & reseeds, relative to today)
- Admin Budi Santoso; tentors Siti Rahma (Matematika, 85k), Andi Pratama (Fisika, 90k), Dewi Lestari (B. Inggris, 75k), Rizky Hidayat (Biologi, 80k).
- 10 students: 8 Aktif (Lunas), Irfan Maulana & Jasmine Aulia Belum Aktif (Belum Bayar, issued today).
- Weekday sessions for the current month; Siti always has a session TODAY (Ruang A 15:00 or Ruang C 13:00). Past sessions have journals (older than 3 days Tervalidasi, else Terkirim), except Siti's most recent past session (Belum Diisi).
- Events: Libur Bimbel (a Wednesday), Try Out UTBK #1, Try Out ANBK SMP.
- Rapor: Aditya (Siti, Diterbitkan), Bunga (Siti, Draft), Eka (Dewi, Diterbitkan).

## Iteration 2 additions
- **Due reminders**: cron `.emergent/crons.yml` `due-reminder` 07:00 Asia/Jakarta → POST /api/cron/due-reminder (Bearer WEBHOOK_CRON_SECRET, idempotent via X-Webhook-Id, 202 + background task). Logic lib/reminders.py: unpaid invoices due today/tomorrow (H-1) + overdue → in-app notification to all admins + email (Emergent managed Resend, lib/email.py) to settings.reminder_email. Manual: POST /api/reminders/run (admin). History: reminder_runs.
- **Settings** (admin, /pengaturan): GET /api/settings, PUT /api/settings/reminder {reminder_email}, PUT /api/settings/packages/{key} {price} → updates price for new invoices AND all `Belum Bayar` invoices of that package.
- **Edit siswa**: PUT /api/students/{id} (denormalised names synced).
- **Notifications**: GET /api/notifications, POST /api/notifications/read-all; bell in sidebar. Tentor gets notified on jadwal create / PUT /api/jadwal/{id} (edit, conflict-checked, blocked if journal exists, sets changed_at → "Diubah Admin" badge) / delete.
- **Jurnal form**: "Semua Hadir" button, counts summary, larger toggles.
- **Rapor print chart**: GET /api/rapor/{id}/riwayat → same student+subject, published rapor up to this period. Seed adds 3 previous months for Aditya (Matematika) and Eka (B. Inggris).
- Seed: Irfan invoice overdue 1 day, Jasmine due tomorrow; settings.reminder_email empty by default.

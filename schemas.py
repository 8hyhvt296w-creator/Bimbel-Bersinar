"""All request/response models. Mirrored by hand in frontend/src/lib/types.ts."""

from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field

Role = Literal["admin", "tentor"]
Jenjang = Literal["SD", "SMP", "SMA", "Alumni"]
PackageKey = Literal["bulanan", "8x"]
InvoiceStatus = Literal["Belum Bayar", "Lunas"]
StudentStatus = Literal["Aktif", "Belum Aktif"]
AttendanceStatus = Literal["Hadir", "Izin", "Sakit", "Alpha"]
JournalStatus = Literal["Terkirim", "Tervalidasi"]
JadwalJournalStatus = Literal["Belum Diisi", "Terkirim", "Tervalidasi"]
EventType = Literal["tryout", "libur"]
RaporStatus = Literal["Draft", "Diterbitkan"]

DATE_RE = r"^\d{4}-\d{2}-\d{2}$"
TIME_RE = r"^\d{2}:\d{2}$"
MONTH_RE = r"^\d{4}-\d{2}$"


# ---------- auth ----------
class LoginIn(BaseModel):
    email: str
    password: str


class Me(BaseModel):
    id: str
    email: str
    name: str
    role: Role
    subject: Optional[str] = None


# ---------- packages / students / invoices ----------
class PackageInfo(BaseModel):
    key: PackageKey
    label: str
    price: int
    meetings: Optional[int] = None


class StudentIn(BaseModel):
    name: str = Field(min_length=1)
    jenjang: Jenjang
    program: str = Field(min_length=1)
    school: str = ""
    phone: str = ""
    parent_name: str = ""
    parent_phone: str = ""
    package: PackageKey
    amount: Optional[int] = Field(default=None, ge=0)


class Student(BaseModel):
    id: str
    name: str
    jenjang: Jenjang
    program: str
    school: str = ""
    phone: str = ""
    parent_name: str = ""
    parent_phone: str = ""
    package: PackageKey
    status: StudentStatus
    created_at: str


class Invoice(BaseModel):
    id: str
    code: str
    student_id: str
    student_name: str
    package: PackageKey
    package_label: str
    amount: int
    issued_date: str
    due_date: str
    status: InvoiceStatus
    paid_date: Optional[str] = None
    method: Optional[str] = None


class StudentCreated(BaseModel):
    student: Student
    invoice: Invoice


class StudentUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1)
    jenjang: Optional[Jenjang] = None
    program: Optional[str] = Field(default=None, min_length=1)
    school: Optional[str] = None
    phone: Optional[str] = None
    parent_name: Optional[str] = None
    parent_phone: Optional[str] = None
    package: Optional[PackageKey] = None


class PackagePriceIn(BaseModel):
    price: int = Field(ge=0)


class PackagePriceOut(BaseModel):
    package: PackageInfo
    invoices_updated: int


class ReminderSettingsIn(BaseModel):
    reminder_email: Optional[EmailStr] = None


class ReminderRun(BaseModel):
    id: str
    date: str
    ran_at: str
    trigger: Literal["cron", "manual"]
    due_soon: int
    overdue: int
    email_status: Literal["Terkirim", "Email belum diatur", "Gagal", "Tidak ada tagihan"]
    detail: str = ""


class AppSettings(BaseModel):
    reminder_email: Optional[str] = None
    packages: list[PackageInfo]
    last_reminder: Optional[ReminderRun] = None


class Notification(BaseModel):
    id: str
    kind: Literal["jatuh_tempo", "jadwal"]
    title: str
    message: str
    created_at: str
    read: bool = False


class NotificationList(BaseModel):
    unread: int
    items: list[Notification]


class InvoicePayIn(BaseModel):
    method: str = "Transfer Bank"
    paid_date: Optional[str] = Field(default=None, pattern=DATE_RE)


class InvoiceRenewIn(BaseModel):
    package: Optional[PackageKey] = None
    amount: Optional[int] = Field(default=None, ge=0)


# ---------- tentors ----------
class TentorIn(BaseModel):
    name: str = Field(min_length=1)
    email: str = Field(min_length=3)
    password: str = Field(min_length=6)
    subject: str = Field(min_length=1)
    phone: str = ""
    rate_per_session: int = Field(ge=0)


class TentorUpdate(BaseModel):
    name: Optional[str] = None
    subject: Optional[str] = None
    phone: Optional[str] = None
    rate_per_session: Optional[int] = Field(default=None, ge=0)
    password: Optional[str] = Field(default=None, min_length=6)


class TentorAdmin(BaseModel):
    """Admin-only view: includes the confidential honor rate."""
    id: str
    name: str
    email: str
    subject: str
    phone: str = ""
    rate_per_session: int


# ---------- jadwal / calendar ----------
class JadwalIn(BaseModel):
    date: str = Field(pattern=DATE_RE)
    start: str = Field(pattern=TIME_RE)
    end: str = Field(pattern=TIME_RE)
    room: str = Field(min_length=1)
    subject: str = Field(min_length=1)
    tentor_id: str
    student_ids: list[str] = Field(min_length=1)


class Jadwal(BaseModel):
    id: str
    date: str
    start: str
    end: str
    room: str
    subject: str
    tentor_id: str
    tentor_name: str
    student_ids: list[str]
    student_names: list[str]
    journal_status: JadwalJournalStatus = "Belum Diisi"
    changed_at: Optional[str] = None


class EventIn(BaseModel):
    date: str = Field(pattern=DATE_RE)
    title: str = Field(min_length=1)
    type: EventType
    note: str = ""


class Event(BaseModel):
    id: str
    date: str
    title: str
    type: EventType
    note: str = ""


class CalendarOut(BaseModel):
    month: str
    sessions: list[Jadwal]
    events: list[Event]


# ---------- jurnal ----------
class AttendanceItem(BaseModel):
    student_id: str
    student_name: str = ""
    status: AttendanceStatus


class JurnalIn(BaseModel):
    jadwal_id: str
    attendance: list[AttendanceItem] = Field(min_length=1)
    materi: str = Field(min_length=1)
    catatan: str = ""


class Jurnal(BaseModel):
    id: str
    jadwal_id: str
    date: str
    start: str
    end: str
    room: str
    subject: str
    tentor_id: str
    tentor_name: str
    attendance: list[AttendanceItem]
    materi: str
    catatan: str = ""
    status: JournalStatus
    submitted_at: str
    validated_at: Optional[str] = None


# ---------- dashboards ----------
class AdminDashboard(BaseModel):
    today: str
    total_siswa: int
    siswa_aktif: int
    siswa_belum_aktif: int
    tentor_count: int
    invoice_belum_bayar: int
    invoice_belum_bayar_total: int
    invoice_lewat_tempo: int
    invoice_hampir_tempo: int
    pendapatan_bulan_ini: int
    jurnal_menunggu: int
    sesi_hari_ini: list[Jadwal]
    invoice_jatuh_tempo: list[Invoice]


class TentorDashboard(BaseModel):
    today: str
    sesi_hari_ini: list[Jadwal]
    jurnal_belum_diisi: list[Jadwal]
    jurnal_terkirim_bulan_ini: int
    siswa_diajar: int


class TodayOut(BaseModel):
    today: str


# ---------- payroll ----------
class PayrollSession(BaseModel):
    date: str
    start: str
    end: str
    subject: str
    room: str


class PayrollRow(BaseModel):
    tentor_id: str
    name: str
    subject: str
    rate_per_session: int
    sesi_sah: int
    sesi_menunggu: int
    total: int
    details: list[PayrollSession]


class PayrollOut(BaseModel):
    month: str
    rows: list[PayrollRow]
    total_sesi_sah: int
    grand_total: int


# ---------- laporan & rapor ----------
class StudentBrief(BaseModel):
    id: str
    name: str
    jenjang: Jenjang
    program: str
    parent_name: str = ""
    parent_phone: str = ""


class AttendanceSummary(BaseModel):
    hadir: int = 0
    izin: int = 0
    sakit: int = 0
    alpha: int = 0
    total: int = 0
    persen: float = 0.0


class LaporanEntry(BaseModel):
    date: str
    start: str
    subject: str
    tentor_name: str
    materi: str
    catatan: str
    kehadiran: AttendanceStatus


class LaporanOut(BaseModel):
    student: StudentBrief
    date_from: str
    date_to: str
    entries: list[LaporanEntry]
    summary: AttendanceSummary


class RaporIn(BaseModel):
    student_id: str
    period: str = Field(pattern=MONTH_RE)
    label: str = "Rapor Bulanan"
    nilai_pemahaman: int = Field(ge=0, le=100)
    nilai_kuis: int = Field(ge=0, le=100)
    nilai_keaktifan: int = Field(ge=0, le=100)
    catatan: str = Field(min_length=1)
    rekomendasi: str = ""


class Rapor(BaseModel):
    id: str
    student_id: str
    student_name: str
    jenjang: Jenjang
    program: str
    tentor_id: str
    tentor_name: str
    subject: str
    period: str
    label: str
    nilai_pemahaman: int
    nilai_kuis: int
    nilai_keaktifan: int
    rata_rata: float
    kehadiran: AttendanceSummary
    catatan: str
    rekomendasi: str = ""
    status: RaporStatus
    created_at: str
    published_at: Optional[str] = None


class RaporPoint(BaseModel):
    period: str
    label: str
    nilai_pemahaman: int
    nilai_kuis: int
    nilai_keaktifan: int
    rata_rata: float
    kehadiran_persen: float

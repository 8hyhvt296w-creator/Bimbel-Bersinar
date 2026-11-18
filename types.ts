// Hand-written mirrors of backend/models/schemas.py — keep in sync.
export type Role = "admin" | "tentor";
export type Jenjang = "SD" | "SMP" | "SMA" | "Alumni";
export type PackageKey = "bulanan" | "8x";
export type InvoiceStatus = "Belum Bayar" | "Lunas";
export type StudentStatus = "Aktif" | "Belum Aktif";
export type AttendanceStatus = "Hadir" | "Izin" | "Sakit" | "Alpha";
export type JournalStatus = "Terkirim" | "Tervalidasi";
export type JadwalJournalStatus = "Belum Diisi" | "Terkirim" | "Tervalidasi";
export type EventType = "tryout" | "libur";
export type RaporStatus = "Draft" | "Diterbitkan";

export interface Me { id: string; email: string; name: string; role: Role; subject: string | null }

export interface PackageInfo { key: PackageKey; label: string; price: number; meetings: number | null }

export interface StudentIn {
  name: string; jenjang: Jenjang; program: string; school: string; phone: string;
  parent_name: string; parent_phone: string; package: PackageKey; amount: number | null;
}
export interface Student {
  id: string; name: string; jenjang: Jenjang; program: string; school: string; phone: string;
  parent_name: string; parent_phone: string; package: PackageKey; status: StudentStatus; created_at: string;
}
export interface Invoice {
  id: string; code: string; student_id: string; student_name: string; package: PackageKey; package_label: string;
  amount: number; issued_date: string; due_date: string; status: InvoiceStatus; paid_date: string | null; method: string | null;
}
export interface StudentCreated { student: Student; invoice: Invoice }
export interface StudentUpdate {
  name?: string; jenjang?: Jenjang; program?: string; school?: string; phone?: string;
  parent_name?: string; parent_phone?: string; package?: PackageKey;
}
export interface PackagePriceIn { price: number }
export interface PackagePriceOut { package: PackageInfo; invoices_updated: number }
export interface ReminderSettingsIn { reminder_email: string | null }
export interface ReminderRun {
  id: string; date: string; ran_at: string; trigger: "cron" | "manual"; due_soon: number; overdue: number;
  email_status: "Terkirim" | "Email belum diatur" | "Gagal" | "Tidak ada tagihan"; detail: string;
}
export interface AppSettings { reminder_email: string | null; packages: PackageInfo[]; last_reminder: ReminderRun | null }
export interface Notification { id: string; kind: "jatuh_tempo" | "jadwal"; title: string; message: string; created_at: string; read: boolean }
export interface NotificationList { unread: number; items: Notification[] }
export interface RaporPoint {
  period: string; label: string; nilai_pemahaman: number; nilai_kuis: number; nilai_keaktifan: number;
  rata_rata: number; kehadiran_persen: number;
}
export interface InvoicePayIn { method: string; paid_date: string | null }

export interface TentorIn { name: string; email: string; password: string; subject: string; phone: string; rate_per_session: number }
export interface TentorUpdate { name?: string; subject?: string; phone?: string; rate_per_session?: number; password?: string }
export interface TentorAdmin { id: string; name: string; email: string; subject: string; phone: string; rate_per_session: number }

export interface JadwalIn { date: string; start: string; end: string; room: string; subject: string; tentor_id: string; student_ids: string[] }
export interface Jadwal {
  id: string; date: string; start: string; end: string; room: string; subject: string; tentor_id: string;
  tentor_name: string; student_ids: string[]; student_names: string[]; journal_status: JadwalJournalStatus;
  changed_at: string | null;
}
export interface EventIn { date: string; title: string; type: EventType; note: string }
export interface CalEvent { id: string; date: string; title: string; type: EventType; note: string }
export interface CalendarOut { month: string; sessions: Jadwal[]; events: CalEvent[] }

export interface AttendanceItem { student_id: string; student_name: string; status: AttendanceStatus }
export interface JurnalIn { jadwal_id: string; attendance: AttendanceItem[]; materi: string; catatan: string }
export interface Jurnal {
  id: string; jadwal_id: string; date: string; start: string; end: string; room: string; subject: string;
  tentor_id: string; tentor_name: string; attendance: AttendanceItem[]; materi: string; catatan: string;
  status: JournalStatus; submitted_at: string; validated_at: string | null;
}

export interface AdminDashboard {
  today: string; total_siswa: number; siswa_aktif: number; siswa_belum_aktif: number; tentor_count: number;
  invoice_belum_bayar: number; invoice_belum_bayar_total: number; invoice_lewat_tempo: number; invoice_hampir_tempo: number;
  pendapatan_bulan_ini: number;
  jurnal_menunggu: number; sesi_hari_ini: Jadwal[]; invoice_jatuh_tempo: Invoice[];
}
export interface TentorDashboard {
  today: string; sesi_hari_ini: Jadwal[]; jurnal_belum_diisi: Jadwal[]; jurnal_terkirim_bulan_ini: number; siswa_diajar: number;
}
export interface TodayOut { today: string }

export interface PayrollSession { date: string; start: string; end: string; subject: string; room: string }
export interface PayrollRow {
  tentor_id: string; name: string; subject: string; rate_per_session: number; sesi_sah: number;
  sesi_menunggu: number; total: number; details: PayrollSession[];
}
export interface PayrollOut { month: string; rows: PayrollRow[]; total_sesi_sah: number; grand_total: number }

export interface StudentBrief { id: string; name: string; jenjang: Jenjang; program: string; parent_name: string; parent_phone: string }
export interface AttendanceSummary { hadir: number; izin: number; sakit: number; alpha: number; total: number; persen: number }
export interface LaporanEntry { date: string; start: string; subject: string; tentor_name: string; materi: string; catatan: string; kehadiran: AttendanceStatus }
export interface LaporanOut { student: StudentBrief; date_from: string; date_to: string; entries: LaporanEntry[]; summary: AttendanceSummary }

export interface RaporIn {
  student_id: string; period: string; label: string; nilai_pemahaman: number; nilai_kuis: number;
  nilai_keaktifan: number; catatan: string; rekomendasi: string;
}
export interface Rapor {
  id: string; student_id: string; student_name: string; jenjang: Jenjang; program: string; tentor_id: string;
  tentor_name: string; subject: string; period: string; label: string; nilai_pemahaman: number; nilai_kuis: number;
  nilai_keaktifan: number; rata_rata: number; kehadiran: AttendanceSummary; catatan: string; rekomendasi: string;
  status: RaporStatus; created_at: string; published_at: string | null;
}

import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, BellRing, BookOpenCheck, CalendarClock, GraduationCap, Receipt, Users, Wallet } from "lucide-react";
import { NotificationItem, useNotifications } from "@/components/NotificationBell";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState, PageHeader, StatCard, StatusBadge } from "@/components/common";
import JurnalDialog from "@/components/JurnalDialog";
import { apiGet } from "@/lib/api";
import { fmtDate, fmtLong, rupiah, useMe } from "@/lib/format";
import type { AdminDashboard as AdminDash, Jadwal, TentorDashboard as TentorDash } from "@/lib/types";

function SessionRow({ j, action }: { j: Jadwal; action?: React.ReactNode }) {
  return (
    <div data-testid={`today-session-${j.id}`} className="flex flex-col gap-3 rounded-lg border bg-card p-4 transition-colors duration-150 hover:bg-slate-50 sm:flex-row sm:items-center">
      <div className="w-28 shrink-0 font-mono text-sm font-semibold text-slate-900">{j.start}–{j.end}</div>
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-slate-900">
          {j.subject} <span className="font-normal text-slate-500">· {j.room}</span>
          {j.changed_at && <span data-testid={`session-changed-${j.id}`} className="ml-2 rounded bg-teal-100 px-1.5 py-0.5 text-[11px] font-semibold text-teal-800">Diubah Admin</span>}
        </div>
        <div className="truncate text-sm text-slate-600">{j.tentor_name} · {j.student_names.join(", ")}</div>
      </div>
      <div className="flex items-center gap-2">
        <StatusBadge status={j.journal_status} testId={`today-session-status-${j.id}`} />
        {action}
      </div>
    </div>
  );
}

function AdminDashboard() {
  const { data } = useQuery({ queryKey: ["dashboard", "admin"], queryFn: () => apiGet<AdminDash>("/dashboard/admin") });
  return (
    <div>
      <PageHeader title="Dashboard Admin" subtitle={data ? fmtLong(data.today) : "Ringkasan operasional bimbel"} />
      {data && (data.invoice_lewat_tempo > 0 || data.invoice_hampir_tempo > 0) && (
        <Link to="/invoice" data-testid="dashboard-due-banner" className="mb-6 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 transition-colors duration-150 hover:bg-red-100">
          <BellRing className="h-5 w-5 shrink-0 text-red-600" />
          <span className="flex-1">
            <b>{data.invoice_lewat_tempo}</b> invoice sudah lewat jatuh tempo · <b>{data.invoice_hampir_tempo}</b> jatuh tempo hari ini/besok
          </span>
          <span className="font-semibold">Tindak lanjuti →</span>
        </Link>
      )}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard testId="stat-siswa-aktif" label="Siswa Aktif" value={data?.siswa_aktif ?? "–"} hint={data ? `dari ${data.total_siswa} siswa terdaftar` : undefined} tone="green" icon={<GraduationCap className="h-5 w-5" />} />
        <StatCard testId="stat-invoice-belum-bayar" label="Invoice Belum Bayar" value={data?.invoice_belum_bayar ?? "–"} hint={data ? rupiah(data.invoice_belum_bayar_total) : undefined} tone="red" icon={<Receipt className="h-5 w-5" />} />
        <StatCard testId="stat-pendapatan" label="Pemasukan Bulan Ini" value={data ? rupiah(data.pendapatan_bulan_ini) : "–"} tone="blue" icon={<Wallet className="h-5 w-5" />} />
        <StatCard testId="stat-jurnal-menunggu" label="Jurnal Menunggu" value={data?.jurnal_menunggu ?? "–"} hint={data ? `${data.tentor_count} tentor terdaftar` : undefined} tone="amber" icon={<BookOpenCheck className="h-5 w-5" />} />
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold"><CalendarClock className="h-5 w-5 text-blue-600" /> Jadwal Hari Ini</h2>
            <Link to="/jadwal" data-testid="dashboard-link-jadwal" className={buttonVariants({ variant: "ghost", size: "sm" })}>Lihat kalender</Link>
          </div>
          <div className="space-y-2">
            {data?.sesi_hari_ini.map((j) => <SessionRow key={j.id} j={j} />)}
            {data && data.sesi_hari_ini.length === 0 && <EmptyState text="Tidak ada sesi hari ini." testId="dashboard-today-empty" />}
          </div>
        </section>
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold"><AlertCircle className="h-5 w-5 text-red-600" /> Tagihan Belum Lunas</h2>
            <Link to="/invoice" data-testid="dashboard-link-invoice" className={buttonVariants({ variant: "ghost", size: "sm" })}>Semua</Link>
          </div>
          <div className="divide-y rounded-lg border bg-card">
            {data?.invoice_jatuh_tempo.map((i) => (
              <div key={i.id} data-testid={`dashboard-invoice-${i.id}`} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{i.student_name}</div>
                  <div className="font-mono text-xs text-slate-500">{i.code} · jatuh tempo {fmtDate(i.due_date)}</div>
                </div>
                <div className="text-right text-sm font-semibold">{rupiah(i.amount)}</div>
              </div>
            ))}
            {data && data.invoice_jatuh_tempo.length === 0 && <div className="p-6 text-center text-sm text-slate-500">Semua invoice sudah lunas.</div>}
          </div>
          {data && data.jurnal_menunggu > 0 && (
            <Link to="/jurnal" data-testid="dashboard-link-validasi" className="mt-4 flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 transition-colors duration-150 hover:bg-amber-100">
              <span><b>{data.jurnal_menunggu}</b> jurnal menunggu validasi</span>
              <span className="font-semibold">Validasi →</span>
            </Link>
          )}
        </section>
      </div>
    </div>
  );
}

function TentorDashboard() {
  const { data: me } = useMe();
  const { data } = useQuery({ queryKey: ["dashboard", "tentor"], queryFn: () => apiGet<TentorDash>("/dashboard/tentor") });
  const [active, setActive] = useState<Jadwal | null>(null);
  const { data: notifs } = useNotifications();
  const jadwalNotifs = (notifs?.items ?? []).filter((n) => n.kind === "jadwal").slice(0, 5);
  const isiBtn = (j: Jadwal) =>
    j.journal_status === "Belum Diisi" ? (
      <Button size="sm" data-testid="btn-isi-jurnal" onClick={() => setActive(j)}>Isi Jurnal</Button>
    ) : null;

  return (
    <div>
      <PageHeader title={`Halo, ${me?.name ?? "Tentor"}`} subtitle={data ? fmtLong(data.today) : "Portal tentor"} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard testId="stat-sesi-hari-ini" label="Sesi Hari Ini" value={data?.sesi_hari_ini.length ?? "–"} tone="teal" icon={<CalendarClock className="h-5 w-5" />} />
        <StatCard testId="stat-jurnal-belum" label="Jurnal Belum Diisi" value={data?.jurnal_belum_diisi.length ?? "–"} tone="amber" icon={<BookOpenCheck className="h-5 w-5" />} />
        <StatCard testId="stat-siswa-diajar" label="Siswa Diajar" value={data?.siswa_diajar ?? "–"} hint={data ? `${data.jurnal_terkirim_bulan_ini} jurnal terkirim bulan ini` : undefined} tone="blue" icon={<Users className="h-5 w-5" />} />
      </div>
      <section className="mt-8">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <span className="h-2 w-2 animate-pulse-dot rounded-full bg-teal-500" /> Jadwal Hari Ini
        </h2>
        <div className="space-y-2">
          {data?.sesi_hari_ini.map((j) => <SessionRow key={j.id} j={j} action={isiBtn(j)} />)}
          {data && data.sesi_hari_ini.length === 0 && <EmptyState text="Tidak ada jadwal mengajar hari ini." testId="tentor-today-empty" />}
        </div>
      </section>
      {data && data.jurnal_belum_diisi.filter((j) => j.date !== data.today).length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">Jurnal Sesi Sebelumnya yang Belum Diisi</h2>
          <div className="space-y-2">
            {data.jurnal_belum_diisi.filter((j) => j.date !== data.today).map((j) => (
              <div key={j.id}>
                <div className="mb-1 text-xs font-medium text-slate-500">{fmtLong(j.date)}</div>
                <SessionRow j={j} action={isiBtn(j)} />
              </div>
            ))}
          </div>
        </section>
      )}
      {jadwalNotifs.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold"><CalendarClock className="h-5 w-5 text-teal-600" /> Perubahan Jadwal dari Admin</h2>
          <div className="divide-y overflow-hidden rounded-xl border bg-card" data-testid="tentor-jadwal-changes">
            {jadwalNotifs.map((n) => <NotificationItem key={n.id} n={n} />)}
          </div>
        </section>
      )}
      <JurnalDialog jadwal={active} onClose={() => setActive(null)} />
    </div>
  );
}

export default function Dashboard() {
  const { data: me } = useMe();
  return me?.role === "tentor" ? <TentorDashboard /> : <AdminDashboard />;
}

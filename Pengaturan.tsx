import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BellRing, Mail, Save, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/common";
import { apiGet, apiPost, apiPut } from "@/lib/api";
import { errMsg, rupiah } from "@/lib/format";
import type { AppSettings, PackageInfo, PackagePriceIn, PackagePriceOut, ReminderRun, ReminderSettingsIn } from "@/lib/types";

function PackageRow({ p }: { p: PackageInfo }) {
  const qc = useQueryClient();
  const [price, setPrice] = useState(String(p.price));
  const save = useMutation({
    mutationFn: (body: PackagePriceIn) => apiPut<PackagePriceOut>(`/settings/packages/${p.key}`, body),
    onSuccess: (r) => {
      toast.success(`${r.package.label} kini ${rupiah(r.package.price)} · ${r.invoices_updated} invoice belum bayar ikut diperbarui`);
      for (const k of ["settings", "packages", "invoices", "dashboard"]) void qc.invalidateQueries({ queryKey: [k] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <form
      data-testid={`package-row-${p.key}`}
      className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-end"
      onSubmit={(e) => { e.preventDefault(); save.mutate({ price: Number(price) }); }}
    >
      <div className="flex-1">
        <div className="font-semibold">{p.label}</div>
        <div className="text-xs text-slate-500">{p.meetings ? `${p.meetings} pertemuan` : "Per bulan"} · saat ini {rupiah(p.price)}</div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`price-${p.key}`}>Harga baru</Label>
        <Input id={`price-${p.key}`} type="number" min={0} required className="w-44" data-testid={`package-price-input-${p.key}`} value={price} onChange={(e) => setPrice(e.target.value)} />
      </div>
      <Button type="submit" data-testid={`package-save-${p.key}`} disabled={save.isPending || Number(price) === p.price}>
        <Save className="mr-1 h-4 w-4" /> Simpan
      </Button>
    </form>
  );
}

function ReminderCard({ s }: { s: AppSettings }) {
  const qc = useQueryClient();
  const [email, setEmail] = useState(s.reminder_email ?? "");
  const saveEmail = useMutation({
    mutationFn: (body: ReminderSettingsIn) => apiPut<AppSettings>("/settings/reminder", body),
    onSuccess: () => { toast.success("Email penerima pengingat disimpan"); void qc.invalidateQueries({ queryKey: ["settings"] }); },
    onError: (e) => toast.error(errMsg(e, "Email tidak valid")),
  });
  const runNow = useMutation({
    mutationFn: () => apiPost<ReminderRun>("/reminders/run"),
    onSuccess: (r) => {
      toast.success(`Pengingat dijalankan: ${r.overdue} lewat tempo, ${r.due_soon} segera jatuh tempo · Email: ${r.email_status}`);
      void qc.invalidateQueries({ queryKey: ["settings"] });
      void qc.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const last = s.last_reminder;
  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="flex items-center gap-2 text-lg font-semibold"><BellRing className="h-5 w-5 text-red-600" /> Pengingat Jatuh Tempo</h2>
      <p className="mt-1 text-sm text-slate-600">
        Setiap pagi pukul <b>07:00 WIB</b> sistem mengirim email ringkasan invoice yang <b>jatuh tempo hari ini/besok (H-1)</b> dan yang
        <b> sudah lewat jatuh tempo</b>, serta notifikasi di lonceng Admin.
      </p>
      <form className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={(e) => { e.preventDefault(); saveEmail.mutate({ reminder_email: email.trim() || null }); }}>
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="reminder-email">Email penerima (Admin)</Label>
          <Input id="reminder-email" type="email" placeholder="admin@email-anda.com" data-testid="reminder-email-input" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <Button type="submit" variant="outline" data-testid="reminder-email-save" disabled={saveEmail.isPending}><Mail className="mr-1 h-4 w-4" /> Simpan Email</Button>
        <Button type="button" data-testid="reminder-run-now" disabled={runNow.isPending} onClick={() => runNow.mutate()}>
          {runNow.isPending ? "Menjalankan..." : "Kirim Pengingat Sekarang"}
        </Button>
      </form>
      {!s.reminder_email && <p className="mt-2 text-xs text-amber-700">Email belum diatur — pengingat hanya muncul sebagai notifikasi di aplikasi.</p>}
      <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm" data-testid="reminder-last-run">
        {last ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-500">Terakhir dijalankan {new Date(last.ran_at).toLocaleString("id-ID")} ({last.trigger === "cron" ? "otomatis" : "manual"}):</span>
            <span>{last.overdue} lewat tempo · {last.due_soon} segera</span>
            <span data-testid="reminder-last-status" className="rounded-md border bg-white px-2 py-0.5 font-mono text-[11px] uppercase">{last.email_status}</span>
            {last.detail && <span className="text-xs text-slate-500">{last.detail}</span>}
          </div>
        ) : <span className="text-slate-500">Belum pernah dijalankan.</span>}
      </div>
    </section>
  );
}

export default function Pengaturan() {
  const { data } = useQuery({ queryKey: ["settings"], queryFn: () => apiGet<AppSettings>("/settings") });
  return (
    <div>
      <PageHeader title="Pengaturan" subtitle="Harga paket dan pengingat tagihan otomatis." />
      <div className="grid gap-6">
        {data && <ReminderCard key={data.reminder_email ?? "none"} s={data} />}
        <section className="rounded-xl border bg-card p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><Tag className="h-5 w-5 text-blue-600" /> Harga Paket</h2>
          <p className="mt-1 text-sm text-slate-600">Harga baru berlaku untuk invoice baru <b>dan</b> semua invoice paket ini yang masih Belum Bayar.</p>
          <div className="mt-4 space-y-3">
            {data?.packages.map((p) => <PackageRow key={`${p.key}-${p.price}`} p={p} />)}
          </div>
        </section>
      </div>
    </div>
  );
}

import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Pencil, Plus, Printer, Send } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, PageHeader, StatusBadge } from "@/components/common";
import { apiGet, apiPost, apiPut } from "@/lib/api";
import { errMsg, monthLabel, useMe, useToday } from "@/lib/format";
import { copyText, raporWaText } from "@/lib/exportText";
import type { AttendanceSummary, Rapor as R, RaporIn, StudentBrief } from "@/lib/types";

const LABELS = ["Rapor Bulanan", "Evaluasi Try Out"];

function RaporDialog({ editing, onClose, period }: { editing: R | null; onClose: () => void; period: string }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<RaporIn>(
    editing
      ? { student_id: editing.student_id, period: editing.period, label: editing.label, nilai_pemahaman: editing.nilai_pemahaman,
          nilai_kuis: editing.nilai_kuis, nilai_keaktifan: editing.nilai_keaktifan, catatan: editing.catatan, rekomendasi: editing.rekomendasi }
      : { student_id: "", period, label: "Rapor Bulanan", nilai_pemahaman: 80, nilai_kuis: 80, nilai_keaktifan: 80, catatan: "", rekomendasi: "" },
  );
  const set = <K extends keyof RaporIn>(k: K, v: RaporIn[K]) => setForm((f) => ({ ...f, [k]: v }));
  const { data: students = [] } = useQuery({ queryKey: ["laporan-students"], queryFn: () => apiGet<StudentBrief[]>("/laporan/students") });
  const { data: keh } = useQuery({
    queryKey: ["rapor-kehadiran", form.student_id, form.period],
    queryFn: () => apiGet<AttendanceSummary>(`/rapor/kehadiran?student_id=${form.student_id}&period=${form.period}`),
    enabled: !!form.student_id && /^\d{4}-\d{2}$/.test(form.period),
  });
  const save = useMutation({
    mutationFn: () => (editing ? apiPut<R>(`/rapor/${editing.id}`, form) : apiPost<R>("/rapor", form)),
    onSuccess: () => {
      toast.success("Rapor tersimpan & dikirim ke Admin untuk ditinjau");
      void qc.invalidateQueries({ queryKey: ["rapor"] });
      onClose();
    },
    onError: (e) => toast.error(errMsg(e, "Gagal menyimpan rapor")),
  });
  const nameOf = (id: string) => students.find((s) => s.id === id)?.name ?? "Pilih siswa";
  const score = (k: "nilai_pemahaman" | "nilai_kuis" | "nilai_keaktifan", label: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={k}>{label}</Label>
      <Input id={k} type="number" min={0} max={100} required data-testid={`rapor-${k}-input`} value={form[k]} onChange={(e) => set(k, Number(e.target.value))} />
    </div>
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Ubah Rapor" : "Isi Report Siswa"}</DialogTitle>
          <DialogDescription>Persentase kehadiran ditarik otomatis dari absensi Jurnal Tentor.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Siswa yang Diajar</Label>
              <Select value={form.student_id} onValueChange={(v: string) => set("student_id", v)} disabled={!!editing}>
                <SelectTrigger className="w-full" data-testid="rapor-student-select"><SelectValue>{(v) => nameOf(v as string)}</SelectValue></SelectTrigger>
                <SelectContent>{students.map((s, i) => <SelectItem key={s.id} value={s.id} data-testid={`rapor-student-option-${i}`}>{s.name} ({s.jenjang})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-period">Periode</Label>
              <Input id="r-period" type="month" required data-testid="rapor-period-input" value={form.period} onChange={(e) => set("period", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Jenis</Label>
              <Select value={form.label} onValueChange={(v: string) => set("label", v)}>
                <SelectTrigger className="w-full" data-testid="rapor-label-select"><SelectValue /></SelectTrigger>
                <SelectContent>{LABELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {score("nilai_pemahaman", "Pemahaman Materi")}
            {score("nilai_kuis", "Nilai Kuis / Tugas")}
            {score("nilai_keaktifan", "Keaktifan")}
          </div>
          <div data-testid="rapor-kehadiran-preview" className="rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm text-teal-900">
            {keh ? <>Kehadiran otomatis: <b>{keh.persen}%</b> (Hadir {keh.hadir} dari {keh.total} sesi · Izin {keh.izin} · Sakit {keh.sakit} · Alpha {keh.alpha})</> : "Pilih siswa untuk melihat persentase kehadiran."}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="r-catatan">Catatan Akademik</Label>
            <Textarea id="r-catatan" required data-testid="rapor-catatan-input" value={form.catatan} onChange={(e) => set("catatan", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="r-rek">Rekomendasi</Label>
            <Textarea id="r-rek" data-testid="rapor-rekomendasi-input" value={form.rekomendasi} onChange={(e) => set("rekomendasi", e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="submit" data-testid="rapor-submit-button" disabled={save.isPending || !form.student_id || !form.catatan.trim()}>
              {save.isPending ? "Menyimpan..." : "Simpan Rapor"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RaporCard({ r, isAdmin, onEdit, onPublish, publishing }: { r: R; isAdmin: boolean; onEdit: () => void; onPublish: () => void; publishing: boolean }) {
  return (
    <div data-testid={`rapor-card-${r.id}`} className="animate-rise rounded-xl border bg-card p-5 transition-shadow duration-200 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-heading text-lg font-semibold">{r.student_name}</div>
          <div className="text-xs text-slate-500">{r.jenjang} · {r.program}</div>
        </div>
        <StatusBadge status={r.status} testId={`rapor-status-${r.id}`} />
      </div>
      <div className="mt-2 text-sm text-slate-600">{r.label} · <span className="capitalize">{monthLabel(r.period)}</span> · {r.subject} ({r.tentor_name})</div>
      <div className="mt-4 grid grid-cols-4 gap-2 text-center">
        {[["Paham", r.nilai_pemahaman], ["Kuis", r.nilai_kuis], ["Aktif", r.nilai_keaktifan], ["Hadir", `${r.kehadiran.persen}%`]].map(([l, v]) => (
          <div key={String(l)} className="rounded-lg bg-slate-50 py-2">
            <div className="font-heading text-lg font-bold">{v}</div>
            <div className="text-[11px] uppercase tracking-wider text-slate-500">{l}</div>
          </div>
        ))}
      </div>
      <p className="mt-3 line-clamp-2 text-sm text-slate-600">{r.catatan}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {!isAdmin && r.status === "Draft" && (
          <Button variant="outline" size="sm" data-testid={`rapor-edit-${r.id}`} onClick={onEdit}><Pencil className="mr-1 h-3.5 w-3.5" /> Ubah</Button>
        )}
        {isAdmin && r.status === "Draft" && (
          <Button size="sm" data-testid="btn-terbitkan-rapor" disabled={publishing} onClick={onPublish}><Send className="mr-1 h-3.5 w-3.5" /> Terbitkan</Button>
        )}
        {isAdmin && (
          <>
            <Link to={`/cetak/rapor/${r.id}`} data-testid={`rapor-print-${r.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              <Printer className="mr-1 h-3.5 w-3.5" /> Cetak
            </Link>
            <Button variant="ghost" size="sm" data-testid={`rapor-copy-${r.id}`} onClick={async () => {
              if (await copyText(raporWaText(r))) toast.success("Teks rapor disalin untuk WhatsApp");
            }}>
              <Copy className="mr-1 h-3.5 w-3.5" /> Salin WA
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export default function Rapor() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const isAdmin = me?.role === "admin";
  const { data: today } = useToday();
  const [tab, setTab] = useState("semua");
  const [dialog, setDialog] = useState<{ editing: R | null } | null>(null);
  const { data: rapor = [] } = useQuery({ queryKey: ["rapor"], queryFn: () => apiGet<R[]>("/rapor") });
  const publish = useMutation({
    mutationFn: (id: string) => apiPost<R>(`/rapor/${id}/terbitkan`),
    onSuccess: (r) => { toast.success(`Rapor ${r.student_name} diterbitkan`); void qc.invalidateQueries({ queryKey: ["rapor"] }); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const list = rapor.filter((r) => tab === "semua" || r.status === tab);

  return (
    <div>
      <PageHeader
        title="Report Siswa (Rapor)"
        subtitle={isAdmin ? "Tinjau rapor dari tentor, terbitkan, lalu cetak/bagikan ke orang tua." : "Isi nilai evaluasi & catatan akademik siswa yang Anda ajar."}
        actions={!isAdmin && <Button data-testid="btn-isi-rapor" onClick={() => setDialog({ editing: null })}><Plus className="mr-1 h-4 w-4" /> Isi Rapor</Button>}
      />
      <Tabs value={tab} onValueChange={(v) => setTab(String(v))} className="mb-4">
        <TabsList>
          <TabsTrigger value="semua" data-testid="rapor-tab-semua">Semua</TabsTrigger>
          <TabsTrigger value="Draft" data-testid="rapor-tab-draft">Menunggu Terbit</TabsTrigger>
          <TabsTrigger value="Diterbitkan" data-testid="rapor-tab-terbit">Diterbitkan</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {list.map((r) => (
          <RaporCard key={r.id} r={r} isAdmin={isAdmin} onEdit={() => setDialog({ editing: r })} onPublish={() => publish.mutate(r.id)} publishing={publish.isPending} />
        ))}
      </div>
      {list.length === 0 && <EmptyState text="Belum ada rapor." testId="rapor-empty" />}
      {dialog && <RaporDialog editing={dialog.editing} period={today?.today.slice(0, 7) ?? ""} onClose={() => setDialog(null)} />}
    </div>
  );
}

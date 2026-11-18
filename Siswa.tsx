import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, Receipt, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, PageHeader, StatusBadge } from "@/components/common";
import { apiGet, apiPost, apiPut } from "@/lib/api";
import { errMsg, rupiah } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Invoice, Jenjang, PackageInfo, PackageKey, Student, StudentCreated, StudentIn, StudentUpdate } from "@/lib/types";

const JENJANG: Jenjang[] = ["SD", "SMP", "SMA", "Alumni"];
const EMPTY: StudentIn = { name: "", jenjang: "SMA", program: "", school: "", phone: "", parent_name: "", parent_phone: "", package: "bulanan", amount: null };

function StudentDialog({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (o: boolean) => void; editing: Student | null }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<StudentIn>(editing ? { ...editing, amount: null } : EMPTY);
  const { data: packages = [] } = useQuery({ queryKey: ["packages"], queryFn: () => apiGet<PackageInfo[]>("/packages") });
  const pkg = packages.find((p) => p.key === form.package);
  const set = <K extends keyof StudentIn>(k: K, v: StudentIn[K]) => setForm((f) => ({ ...f, [k]: v }));

  const create = useMutation({
    mutationFn: (body: StudentIn) => apiPost<StudentCreated>("/students", body),
    onSuccess: (res) => {
      toast.success(`Siswa terdaftar. Invoice ${res.invoice.code} diterbitkan (Belum Bayar).`);
      void qc.invalidateQueries({ queryKey: ["students"] });
      void qc.invalidateQueries({ queryKey: ["invoices"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      setForm(EMPTY);
      onOpenChange(false);
    },
    onError: (e) => toast.error(errMsg(e, "Gagal menyimpan siswa")),
  });
  const update = useMutation({
    mutationFn: (body: StudentUpdate) => apiPut<Student>(`/students/${editing?.id}`, body),
    onSuccess: (s) => {
      toast.success(`Biodata ${s.name} diperbarui`);
      for (const k of ["students", "invoices", "laporan-students", "rapor", "calendar"]) void qc.invalidateQueries({ queryKey: [k] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(errMsg(e, "Gagal menyimpan siswa")),
  });
  const pending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Ubah Biodata Siswa" : "Pendaftaran Siswa Baru"}</DialogTitle>
          <DialogDescription>
            {editing ? "Perubahan paket berlaku untuk invoice berikutnya." : "Invoice akan diterbitkan otomatis dengan status Belum Bayar."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (editing) {
              const { amount: _a, ...rest } = form;
              update.mutate(rest);
            } else create.mutate(form);
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="s-name">Nama Lengkap</Label>
              <Input id="s-name" data-testid="siswa-name-input" required value={form.name} onChange={(e) => set("name", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Jenjang</Label>
              <Select value={form.jenjang} onValueChange={(v: string) => set("jenjang", v as Jenjang)}>
                <SelectTrigger className="w-full" data-testid="siswa-jenjang-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {JENJANG.map((j) => <SelectItem key={j} value={j} data-testid={`siswa-jenjang-${j}`}>{j}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-program">Program Belajar</Label>
              <Input id="s-program" data-testid="siswa-program-input" required placeholder="mis. Intensif UTBK" value={form.program} onChange={(e) => set("program", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-school">Asal Sekolah</Label>
              <Input id="s-school" data-testid="siswa-school-input" value={form.school} onChange={(e) => set("school", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-phone">No. HP Siswa</Label>
              <Input id="s-phone" data-testid="siswa-phone-input" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-parent">Nama Orang Tua</Label>
              <Input id="s-parent" data-testid="siswa-parent-input" value={form.parent_name} onChange={(e) => set("parent_name", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-pphone">No. HP Orang Tua</Label>
              <Input id="s-pphone" data-testid="siswa-parent-phone-input" value={form.parent_phone} onChange={(e) => set("parent_phone", e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="mb-2 block">Paket Biaya</Label>
            <div className="grid gap-3 sm:grid-cols-2">
              {packages.map((p) => (
                <button
                  type="button"
                  key={p.key}
                  data-testid={`siswa-paket-${p.key}`}
                  onClick={() => setForm((f) => ({ ...f, package: p.key as PackageKey, amount: null }))}
                  className={cn(
                    "rounded-lg border p-4 text-left transition-colors duration-150",
                    form.package === p.key ? "border-blue-600 bg-blue-50 ring-1 ring-blue-600" : "hover:bg-slate-50",
                  )}
                >
                  <div className="font-semibold">{p.label}</div>
                  <div className="mt-1 font-heading text-xl font-bold text-blue-700">{rupiah(p.price)}</div>
                  <div className="text-xs text-slate-500">{p.meetings ? `${p.meetings} pertemuan` : "Per bulan, tanpa batas sesi"}</div>
                </button>
              ))}
            </div>
            {!editing && (
            <div className="mt-3 grid gap-1.5 sm:max-w-xs">
              <Label htmlFor="s-amount">Nominal Invoice (bisa disesuaikan)</Label>
              <Input
                id="s-amount" type="number" min={0} data-testid="siswa-amount-input"
                value={form.amount ?? pkg?.price ?? ""}
                onChange={(e) => set("amount", e.target.value === "" ? null : Number(e.target.value))}
              />
            </div>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" data-testid="siswa-submit-button" disabled={pending}>
              {pending ? "Menyimpan..." : editing ? "Simpan Perubahan" : "Simpan & Terbitkan Invoice"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Siswa() {
  const qc = useQueryClient();
  const [dialog, setDialog] = useState<{ open: boolean; editing: Student | null }>({ open: false, editing: null });
  const [q, setQ] = useState("");
  const { data: students, isError } = useQuery({ queryKey: ["students"], queryFn: () => apiGet<Student[]>("/students") });
  const renew = useMutation({
    mutationFn: (id: string) => apiPost<Invoice>(`/students/${id}/invoice`, {}),
    onSuccess: (inv) => {
      toast.success(`Invoice ${inv.code} diterbitkan untuk ${inv.student_name}`);
      void qc.invalidateQueries({ queryKey: ["invoices"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const list = (students ?? []).filter((s) => s.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <PageHeader
        title="Data Siswa"
        subtitle="Siswa otomatis Aktif setelah invoice dilunasi."
        actions={<Button data-testid="btn-tambah-siswa" onClick={() => setDialog({ open: true, editing: null })}><Plus className="mr-1 h-4 w-4" /> Tambah Siswa</Button>}
      />
      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input data-testid="siswa-search-input" className="pl-9" placeholder="Cari nama siswa..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Jenjang / Program</TableHead>
              <TableHead className="hidden md:table-cell">Orang Tua</TableHead>
              <TableHead>Paket</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((s) => (
              <TableRow key={s.id} data-testid={`siswa-row-${s.id}`} className="transition-colors duration-150 hover:bg-slate-50">
                <TableCell>
                  <div className="font-semibold">{s.name}</div>
                  <div className="text-xs text-slate-500">{s.school}</div>
                </TableCell>
                <TableCell><span className="font-mono text-xs">{s.jenjang}</span> · {s.program}</TableCell>
                <TableCell className="hidden md:table-cell">
                  <div>{s.parent_name || "–"}</div>
                  <div className="text-xs text-slate-500">{s.parent_phone}</div>
                </TableCell>
                <TableCell className="text-sm">{s.package === "bulanan" ? "Bulanan" : "8x Pertemuan"}</TableCell>
                <TableCell><StatusBadge status={s.status} testId={`siswa-status-${s.id}`} /></TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" data-testid={`siswa-edit-${s.id}`} onClick={() => setDialog({ open: true, editing: s })}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="outline" size="sm" data-testid={`siswa-renew-${s.id}`} disabled={renew.isPending} onClick={() => renew.mutate(s.id)}>
                      <Receipt className="mr-1 h-3.5 w-3.5" /> Terbitkan Invoice
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {students && list.length === 0 && <div className="p-6"><EmptyState text="Belum ada siswa." /></div>}
        {isError && <div className="p-6"><EmptyState text="Data siswa belum dapat dimuat." /></div>}
      </div>
      {dialog.open && (
        <StudentDialog key={dialog.editing?.id ?? "new"} open editing={dialog.editing} onOpenChange={(o) => !o && setDialog({ open: false, editing: null })} />
      )}
    </div>
  );
}

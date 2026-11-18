import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Lock, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, PageHeader } from "@/components/common";
import { apiGet, apiPatch, apiPost } from "@/lib/api";
import { errMsg, rupiah } from "@/lib/format";
import type { TentorAdmin, TentorIn, TentorUpdate } from "@/lib/types";

const EMPTY: TentorIn = { name: "", email: "", password: "", subject: "", phone: "", rate_per_session: 75000 };

function TentorDialog({ editing, open, onClose }: { editing: TentorAdmin | null; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<TentorIn>(editing ? { ...editing, password: "" } : EMPTY);
  const set = <K extends keyof TentorIn>(k: K, v: TentorIn[K]) => setForm((f) => ({ ...f, [k]: v }));
  const save = useMutation({
    mutationFn: () => {
      if (!editing) return apiPost<TentorAdmin>("/tentors", form);
      const body: TentorUpdate = { name: form.name, subject: form.subject, phone: form.phone, rate_per_session: form.rate_per_session };
      if (form.password) body.password = form.password;
      return apiPatch<TentorAdmin>(`/tentors/${editing.id}`, body);
    },
    onSuccess: () => {
      toast.success(editing ? "Data tentor diperbarui" : "Akun tentor dibuat");
      void qc.invalidateQueries({ queryKey: ["tentors"] });
      void qc.invalidateQueries({ queryKey: ["payroll"] });
      onClose();
    },
    onError: (e) => toast.error(errMsg(e, "Gagal menyimpan tentor")),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Ubah Data Tentor" : "Daftarkan Tentor"}</DialogTitle>
          <DialogDescription>Tentor login memakai email & password ini.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="t-name">Nama</Label>
              <Input id="t-name" data-testid="tentor-name-input" required value={form.name} onChange={(e) => set("name", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-email">Email</Label>
              <Input id="t-email" type="email" data-testid="tentor-email-input" required disabled={!!editing} value={form.email} onChange={(e) => set("email", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-pass">{editing ? "Password baru (opsional)" : "Password"}</Label>
              <Input id="t-pass" type="password" minLength={6} data-testid="tentor-password-input" required={!editing} value={form.password} onChange={(e) => set("password", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-subject">Mata Pelajaran</Label>
              <Input id="t-subject" data-testid="tentor-subject-input" required value={form.subject} onChange={(e) => set("subject", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-phone">No. HP</Label>
              <Input id="t-phone" data-testid="tentor-phone-input" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </div>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <Label htmlFor="t-rate" className="flex items-center gap-1.5 text-amber-900"><Lock className="h-3.5 w-3.5" /> Tarif Honor Per Sesi (Rahasia)</Label>
            <Input id="t-rate" type="number" min={0} className="mt-2 bg-white" data-testid="tentor-rate-input" required value={form.rate_per_session} onChange={(e) => set("rate_per_session", Number(e.target.value))} />
            <p className="mt-1.5 text-xs text-amber-800">Hanya terlihat di layar Admin. Tentor tidak pernah melihat nominal ini.</p>
          </div>
          <DialogFooter>
            <Button type="submit" data-testid="tentor-submit-button" disabled={save.isPending}>{save.isPending ? "Menyimpan..." : "Simpan"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Tentor() {
  const [dialog, setDialog] = useState<{ open: boolean; editing: TentorAdmin | null }>({ open: false, editing: null });
  const { data: tentors, isError } = useQuery({ queryKey: ["tentors"], queryFn: () => apiGet<TentorAdmin[]>("/tentors") });
  return (
    <div>
      <PageHeader
        title="Data Tentor"
        subtitle="Kelola akun tentor dan tarif honor per sesi."
        actions={<Button data-testid="btn-tambah-tentor" onClick={() => setDialog({ open: true, editing: null })}><Plus className="mr-1 h-4 w-4" /> Tambah Tentor</Button>}
      />
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Mata Pelajaran</TableHead>
              <TableHead className="hidden md:table-cell">Kontak</TableHead>
              <TableHead>Tarif / Sesi</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tentors?.map((t) => (
              <TableRow key={t.id} data-testid={`tentor-row-${t.id}`} className="transition-colors duration-150 hover:bg-slate-50">
                <TableCell className="font-semibold">{t.name}</TableCell>
                <TableCell>{t.subject}</TableCell>
                <TableCell className="hidden md:table-cell">
                  <div className="text-sm">{t.email}</div>
                  <div className="text-xs text-slate-500">{t.phone}</div>
                </TableCell>
                <TableCell>
                  <span data-testid={`tentor-rate-${t.id}`} className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-sm font-semibold text-amber-900">
                    <Lock className="h-3 w-3" /> {rupiah(t.rate_per_session)}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" data-testid={`tentor-edit-${t.id}`} onClick={() => setDialog({ open: true, editing: t })}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {tentors && tentors.length === 0 && <div className="p-6"><EmptyState text="Belum ada tentor." /></div>}
        {isError && <div className="p-6"><EmptyState text="Data tentor belum dapat dimuat." /></div>}
      </div>
      {dialog.open && (
        <TentorDialog key={dialog.editing?.id ?? "new"} editing={dialog.editing} open={dialog.open} onClose={() => setDialog({ open: false, editing: null })} />
      )}
    </div>
  );
}

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, PageHeader, StatusBadge } from "@/components/common";
import JurnalDialog from "@/components/JurnalDialog";
import { apiGet, apiPost } from "@/lib/api";
import { errMsg, fmtLong, useMe } from "@/lib/format";
import type { Jadwal, Jurnal as JurnalT, TentorDashboard } from "@/lib/types";

function JurnalCard({ j, isAdmin, onView, onValidate, validating }: {
  j: JurnalT; isAdmin: boolean; onView: () => void; onValidate?: () => void; validating?: boolean;
}) {
  const hadir = j.attendance.filter((a) => a.status === "Hadir").length;
  return (
    <div data-testid={`jurnal-card-${j.id}`} className="animate-rise flex flex-col gap-3 rounded-xl border bg-card p-4 transition-shadow duration-200 hover:shadow-md md:flex-row md:items-center">
      <div className="w-44 shrink-0">
        <div className="text-sm font-semibold capitalize">{fmtLong(j.date)}</div>
        <div className="font-mono text-xs text-slate-500">{j.start}–{j.end} · {j.room}</div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-semibold">{j.subject} {isAdmin && <span className="font-normal text-slate-500">· {j.tentor_name}</span>}</div>
        <div className="truncate text-sm text-slate-600">{j.materi}</div>
        <div className="text-xs text-slate-500">Hadir {hadir}/{j.attendance.length} siswa</div>
      </div>
      <div className="flex items-center gap-2">
        <StatusBadge status={j.status} testId={`jurnal-status-${j.id}`} />
        <Button variant="outline" size="sm" data-testid={`jurnal-view-${j.id}`} onClick={onView}><Eye className="h-3.5 w-3.5" /></Button>
        {isAdmin && j.status === "Terkirim" && (
          <Button size="sm" data-testid="btn-validasi-jurnal" disabled={validating} onClick={onValidate}>
            <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Validasi
          </Button>
        )}
      </div>
    </div>
  );
}

function DetailDialog({ j, onClose, isAdmin, onValidate }: { j: JurnalT | null; onClose: () => void; isAdmin: boolean; onValidate: (id: string) => void }) {
  return (
    <Dialog open={!!j} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        {j && (
          <>
            <DialogHeader>
              <DialogTitle>Jurnal {j.subject}</DialogTitle>
              <DialogDescription>{fmtLong(j.date)} · {j.start}–{j.end} · {j.room} · {j.tentor_name}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 text-sm">
              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Daftar Hadir</div>
                <div className="divide-y rounded-lg border">
                  {j.attendance.map((a) => (
                    <div key={a.student_id} className="flex items-center justify-between px-3 py-2">
                      <span>{a.student_name}</span><StatusBadge status={a.status} />
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Materi</div>
                <p data-testid="jurnal-detail-materi">{j.materi}</p>
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Catatan Perkembangan</div>
                <p>{j.catatan || "–"}</p>
              </div>
            </div>
            {isAdmin && j.status === "Terkirim" && (
              <DialogFooter>
                <Button data-testid="jurnal-detail-validasi" onClick={() => { onValidate(j.id); onClose(); }}>
                  <CheckCircle2 className="mr-1 h-4 w-4" /> Validasi (1 Sesi Sah)
                </Button>
              </DialogFooter>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function Jurnal() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const isAdmin = me?.role === "admin";
  const [tab, setTab] = useState(isAdmin ? "Terkirim" : "belum");
  const [view, setView] = useState<JurnalT | null>(null);
  const [fill, setFill] = useState<Jadwal | null>(null);

  const { data: journals = [] } = useQuery({ queryKey: ["jurnal"], queryFn: () => apiGet<JurnalT[]>("/jurnal") });
  const { data: tdash } = useQuery({
    queryKey: ["dashboard", "tentor"], queryFn: () => apiGet<TentorDashboard>("/dashboard/tentor"), enabled: me?.role === "tentor",
  });
  const validate = useMutation({
    mutationFn: (id: string) => apiPost<JurnalT>(`/jurnal/${id}/validasi`),
    onSuccess: () => {
      toast.success("Jurnal tervalidasi — tercatat 1 sesi sah");
      void qc.invalidateQueries({ queryKey: ["jurnal"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      void qc.invalidateQueries({ queryKey: ["payroll"] });
      void qc.invalidateQueries({ queryKey: ["calendar"] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const pending = tdash?.jurnal_belum_diisi ?? [];
  const adminList = journals.filter((j) => j.status === tab);

  return (
    <div>
      <PageHeader
        title={isAdmin ? "Validasi Jurnal" : "Jurnal Tentor"}
        subtitle={isAdmin ? "Setiap jurnal tervalidasi dihitung sebagai 1 sesi sah untuk payroll." : "Isi jurnal setelah selesai mengajar."}
      />
      <Tabs value={tab} onValueChange={(v) => setTab(String(v))} className="mb-4">
        <TabsList>
          {isAdmin ? (
            <>
              <TabsTrigger value="Terkirim" data-testid="jurnal-tab-menunggu">Menunggu Validasi ({journals.filter((j) => j.status === "Terkirim").length})</TabsTrigger>
              <TabsTrigger value="Tervalidasi" data-testid="jurnal-tab-tervalidasi">Tervalidasi</TabsTrigger>
            </>
          ) : (
            <>
              <TabsTrigger value="belum" data-testid="jurnal-tab-belum">Belum Diisi ({pending.length})</TabsTrigger>
              <TabsTrigger value="riwayat" data-testid="jurnal-tab-riwayat">Riwayat Terkirim</TabsTrigger>
            </>
          )}
        </TabsList>
      </Tabs>

      <div className="space-y-2">
        {isAdmin && adminList.map((j) => (
          <JurnalCard key={j.id} j={j} isAdmin onView={() => setView(j)} onValidate={() => validate.mutate(j.id)} validating={validate.isPending} />
        ))}
        {isAdmin && adminList.length === 0 && <EmptyState text="Tidak ada jurnal di daftar ini." testId="jurnal-empty" />}

        {!isAdmin && tab === "belum" && pending.map((s) => (
          <div key={s.id} data-testid={`jurnal-pending-${s.id}`} className="flex flex-col gap-3 rounded-xl border bg-card p-4 md:flex-row md:items-center">
            <div className="w-44 shrink-0">
              <div className="text-sm font-semibold capitalize">{fmtLong(s.date)}</div>
              <div className="font-mono text-xs text-slate-500">{s.start}–{s.end} · {s.room}</div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{s.subject}</div>
              <div className="truncate text-sm text-slate-600">{s.student_names.join(", ")}</div>
            </div>
            <Button size="sm" data-testid="btn-isi-jurnal" onClick={() => setFill(s)}>Isi Jurnal</Button>
          </div>
        ))}
        {!isAdmin && tab === "belum" && pending.length === 0 && <EmptyState text="Semua jurnal sudah terkirim. Terima kasih!" testId="jurnal-empty" />}
        {!isAdmin && tab === "riwayat" && journals.map((j) => <JurnalCard key={j.id} j={j} isAdmin={false} onView={() => setView(j)} />)}
        {!isAdmin && tab === "riwayat" && journals.length === 0 && <EmptyState text="Belum ada jurnal terkirim." />}
      </div>
      <DetailDialog j={view} onClose={() => setView(null)} isAdmin={isAdmin} onValidate={(id) => validate.mutate(id)} />
      <JurnalDialog jadwal={fill} onClose={() => setFill(null)} />
    </div>
  );
}

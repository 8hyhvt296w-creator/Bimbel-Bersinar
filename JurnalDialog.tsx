import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCheck } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiPost } from "@/lib/api";
import { errMsg, fmtLong } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AttendanceStatus, Jadwal, Jurnal, JurnalIn } from "@/lib/types";

const OPTIONS: { value: AttendanceStatus; cls: string }[] = [
  { value: "Hadir", cls: "data-[on=true]:bg-green-600 data-[on=true]:border-green-600" },
  { value: "Izin", cls: "data-[on=true]:bg-sky-600 data-[on=true]:border-sky-600" },
  { value: "Sakit", cls: "data-[on=true]:bg-violet-600 data-[on=true]:border-violet-600" },
  { value: "Alpha", cls: "data-[on=true]:bg-red-600 data-[on=true]:border-red-600" },
];

function JurnalForm({ jadwal, onDone }: { jadwal: Jadwal; onDone: () => void }) {
  const qc = useQueryClient();
  const [att, setAtt] = useState<Record<string, AttendanceStatus>>(
    () => Object.fromEntries(jadwal.student_ids.map((id) => [id, "Hadir" as AttendanceStatus])),
  );
  const [materi, setMateri] = useState("");
  const [catatan, setCatatan] = useState("");

  const submit = useMutation({
    mutationFn: (body: JurnalIn) => apiPost<Jurnal>("/jurnal", body),
    onSuccess: () => {
      toast.success("Jurnal terkirim");
      void qc.invalidateQueries({ queryKey: ["jurnal"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      void qc.invalidateQueries({ queryKey: ["calendar"] });
      onDone();
    },
    onError: (e) => toast.error(errMsg(e, "Gagal mengirim jurnal")),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit.mutate({
          jadwal_id: jadwal.id, materi, catatan,
          attendance: jadwal.student_ids.map((id, i) => ({ student_id: id, student_name: jadwal.student_names[i], status: att[id] })),
        });
      }}
      className="space-y-5"
    >
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <Label>Daftar Hadir Siswa</Label>
          <Button type="button" variant="outline" size="xs" data-testid="jurnal-all-hadir" onClick={() => setAtt(Object.fromEntries(jadwal.student_ids.map((id) => [id, "Hadir" as AttendanceStatus])))}>
            <CheckCheck className="mr-1 h-3.5 w-3.5" /> Semua Hadir
          </Button>
        </div>
        <div data-testid="jurnal-att-summary" className="mb-2 flex flex-wrap gap-1.5">
          {OPTIONS.map((o) => (
            <span key={o.value} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
              {o.value}: <b>{Object.values(att).filter((v) => v === o.value).length}</b>
            </span>
          ))}
        </div>
        <div className="space-y-2">
          {jadwal.student_ids.map((id, i) => (
            <div key={id} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm font-medium">{i + 1}. {jadwal.student_names[i]}</span>
              <div className="grid grid-cols-4 gap-1 sm:flex">
                {OPTIONS.map((o) => (
                  <button
                    type="button"
                    key={o.value}
                    data-on={att[id] === o.value}
                    aria-pressed={att[id] === o.value}
                    data-testid={`jurnal-att-${i}-${o.value.toLowerCase()}`}
                    onClick={() => setAtt((s) => ({ ...s, [id]: o.value }))}
                    className={cn(
                      "rounded-md border px-3 py-2 text-sm font-medium text-slate-600 transition-colors duration-150 hover:bg-slate-50 data-[on=true]:text-white",
                      o.cls,
                    )}
                  >
                    {o.value}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="materi">Materi yang Diajarkan</Label>
        <Textarea id="materi" data-testid="jurnal-materi-input" required value={materi} onChange={(e) => setMateri(e.target.value)} placeholder="Contoh: Turunan fungsi trigonometri & latihan soal" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="catatan">Catatan Perkembangan Kelas</Label>
        <Textarea id="catatan" data-testid="jurnal-catatan-input" value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="Bagaimana pemahaman & keaktifan siswa hari ini?" />
      </div>
      <DialogFooter>
        <Button type="submit" data-testid="jurnal-submit-button" disabled={submit.isPending || !materi.trim()}>
          {submit.isPending ? "Mengirim..." : "Kirim Jurnal"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export default function JurnalDialog({ jadwal, onClose }: { jadwal: Jadwal | null; onClose: () => void }) {
  return (
    <Dialog open={!!jadwal} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        {jadwal && (
          <>
            <DialogHeader>
              <DialogTitle>Isi Jurnal Mengajar</DialogTitle>
              <DialogDescription>
                {jadwal.subject} · {fmtLong(jadwal.date)} · {jadwal.start}–{jadwal.end} · {jadwal.room}
              </DialogDescription>
            </DialogHeader>
            <JurnalForm key={jadwal.id} jadwal={jadwal} onDone={onClose} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

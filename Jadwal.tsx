import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { addDays, addMonths, endOfMonth, endOfWeek, format, parseISO, startOfMonth, startOfWeek } from "date-fns";
import { AlertTriangle, CalendarPlus, ChevronLeft, ChevronRight, Flag, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, StatusBadge } from "@/components/common";
import JurnalDialog from "@/components/JurnalDialog";
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api";
import { ROOMS, errMsg, fmtLong, monthLabel, useMe, useToday } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CalEvent, CalendarOut, EventIn, EventType, Jadwal as J, JadwalIn, Student, TentorAdmin } from "@/lib/types";

const WEEKDAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
type Filter = "semua" | "sesi" | "tryout" | "libur";

function JadwalDialog({ open, onClose, defaultDate, editing }: { open: boolean; onClose: () => void; defaultDate: string; editing: J | null }) {
  const qc = useQueryClient();
  const { data: tentors = [] } = useQuery({ queryKey: ["tentors"], queryFn: () => apiGet<TentorAdmin[]>("/tentors") });
  const { data: students = [] } = useQuery({ queryKey: ["students", "Aktif"], queryFn: () => apiGet<Student[]>("/students?status=Aktif") });
  const [form, setForm] = useState<JadwalIn>(
    editing
      ? { date: editing.date, start: editing.start, end: editing.end, room: editing.room, subject: editing.subject, tentor_id: editing.tentor_id, student_ids: editing.student_ids }
      : { date: defaultDate, start: "15:00", end: "16:30", room: "Ruang A", subject: "", tentor_id: "", student_ids: [] },
  );
  const [conflict, setConflict] = useState("");
  const set = <K extends keyof JadwalIn>(k: K, v: JadwalIn[K]) => { setConflict(""); setForm((f) => ({ ...f, [k]: v })); };
  const tentorName = (id: string) => tentors.find((t) => t.id === id)?.name ?? "Pilih tentor";

  const create = useMutation({
    mutationFn: () => (editing ? apiPut<J>(`/jadwal/${editing.id}`, form) : apiPost<J>("/jadwal", form)),
    onSuccess: () => {
      toast.success(editing ? "Jadwal diubah — tentor mendapat notifikasi" : "Jadwal ditambahkan — tentor mendapat notifikasi");
      void qc.invalidateQueries({ queryKey: ["calendar"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      onClose();
    },
    onError: (e) => setConflict(errMsg(e, "Gagal menyimpan jadwal")),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Ubah Jadwal Sesi" : "Tambah Jadwal Sesi"}</DialogTitle>
          <DialogDescription>Sistem otomatis menolak jadwal tentor atau ruangan yang bentrok.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="j-date">Tanggal</Label>
              <Input id="j-date" type="date" required data-testid="jadwal-date-input" value={form.date} onChange={(e) => set("date", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="j-start">Mulai</Label>
              <Input id="j-start" type="time" required data-testid="jadwal-start-input" value={form.start} onChange={(e) => set("start", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="j-end">Selesai</Label>
              <Input id="j-end" type="time" required data-testid="jadwal-end-input" value={form.end} onChange={(e) => set("end", e.target.value)} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Ruang Kelas</Label>
              <Select value={form.room} onValueChange={(v: string) => set("room", v)}>
                <SelectTrigger className="w-full" data-testid="jadwal-room-select"><SelectValue /></SelectTrigger>
                <SelectContent>{ROOMS.map((r) => <SelectItem key={r} value={r} data-testid={`jadwal-room-${r.replace(/\s/g, "-").toLowerCase()}`}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tentor</Label>
              <Select
                value={form.tentor_id}
                onValueChange={(v: string) => {
                  const t = tentors.find((x) => x.id === v);
                  setConflict("");
                  setForm((f) => ({ ...f, tentor_id: v, subject: f.subject || t?.subject || "" }));
                }}
              >
                <SelectTrigger className="w-full" data-testid="jadwal-tentor-select"><SelectValue>{(v) => tentorName(v as string)}</SelectValue></SelectTrigger>
                <SelectContent>{tentors.map((t, i) => <SelectItem key={t.id} value={t.id} data-testid={`jadwal-tentor-option-${i}`}>{t.name} · {t.subject}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="j-subject">Mata Pelajaran / Materi Kelas</Label>
            <Input id="j-subject" required data-testid="jadwal-subject-input" value={form.subject} onChange={(e) => set("subject", e.target.value)} />
          </div>
          <div>
            <Label className="mb-2 block">Siswa (hanya siswa Aktif)</Label>
            <div className="grid max-h-48 gap-1 overflow-y-auto rounded-lg border p-2 sm:grid-cols-2">
              {students.map((s, i) => (
                <label key={s.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors duration-150 hover:bg-slate-50">
                  <Checkbox
                    data-testid={`jadwal-student-${i}`}
                    checked={form.student_ids.includes(s.id)}
                    onCheckedChange={(c) => set("student_ids", c ? [...form.student_ids, s.id] : form.student_ids.filter((x) => x !== s.id))}
                  />
                  <span>{s.name} <span className="text-xs text-slate-500">({s.jenjang})</span></span>
                </label>
              ))}
            </div>
          </div>
          {conflict && (
            <div data-testid="jadwal-conflict-alert" className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {conflict}
            </div>
          )}
          <DialogFooter>
            <Button type="submit" data-testid="jadwal-submit-button" disabled={create.isPending || !form.tentor_id || form.student_ids.length === 0}>
              {create.isPending ? "Menyimpan..." : "Simpan Jadwal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EventDialog({ open, onClose, defaultDate }: { open: boolean; onClose: () => void; defaultDate: string }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<EventIn>({ date: defaultDate, title: "", type: "tryout", note: "" });
  const create = useMutation({
    mutationFn: () => apiPost<CalEvent>("/events", form),
    onSuccess: () => {
      toast.success("Agenda ditambahkan");
      void qc.invalidateQueries({ queryKey: ["calendar"] });
      onClose();
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tambah Agenda</DialogTitle>
          <DialogDescription>Jadwal Try Out atau hari libur bimbel.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
          <div className="grid grid-cols-2 gap-2">
            {(["tryout", "libur"] as EventType[]).map((t) => (
              <button type="button" key={t} data-testid={`event-type-${t}`} onClick={() => setForm((f) => ({ ...f, type: t }))}
                className={cn("rounded-lg border p-3 text-sm font-semibold transition-colors duration-150",
                  form.type === t ? (t === "tryout" ? "border-amber-500 bg-amber-50 text-amber-900" : "border-rose-500 bg-rose-50 text-rose-900") : "hover:bg-slate-50")}>
                {t === "tryout" ? "Try Out" : "Hari Libur"}
              </button>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="e-date">Tanggal</Label>
              <Input id="e-date" type="date" required data-testid="event-date-input" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-title">Judul</Label>
              <Input id="e-title" required data-testid="event-title-input" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="e-note">Keterangan</Label>
            <Input id="e-note" data-testid="event-note-input" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
          </div>
          <DialogFooter>
            <Button type="submit" data-testid="event-submit-button" disabled={create.isPending}>Simpan Agenda</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Jadwal() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const isAdmin = me?.role === "admin";
  const { data: todayData } = useToday();
  const today = todayData?.today ?? "";
  const [monthState, setMonthState] = useState<string | null>(null);
  const month = monthState ?? (today ? today.slice(0, 7) : "");
  const [selected, setSelected] = useState<string | null>(null);
  const day = selected ?? today;
  const [filter, setFilter] = useState<Filter>("semua");
  const [dlg, setDlg] = useState<"jadwal" | "event" | null>(null);
  const [jurnalFor, setJurnalFor] = useState<J | null>(null);
  const [editing, setEditing] = useState<J | null>(null);

  const { data } = useQuery({
    queryKey: ["calendar", month],
    queryFn: () => apiGet<CalendarOut>(`/calendar?month=${month}`),
    enabled: !!month,
  });

  const del = useMutation({
    mutationFn: (p: { kind: "jadwal" | "events"; id: string }) => apiDelete(`/${p.kind}/${p.id}`),
    onSuccess: () => { toast.success("Dihapus"); void qc.invalidateQueries({ queryKey: ["calendar"] }); },
    onError: (e) => toast.error(errMsg(e)),
  });

  const cells = useMemo(() => {
    if (!month) return [];
    const first = parseISO(`${month}-01`);
    const start = startOfWeek(startOfMonth(first), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(first), { weekStartsOn: 1 });
    const out: string[] = [];
    for (let d = start; d <= end; d = addDays(d, 1)) out.push(format(d, "yyyy-MM-dd"));
    return out;
  }, [month]);

  const sessions = filter === "semua" || filter === "sesi" ? data?.sessions ?? [] : [];
  const events = (data?.events ?? []).filter((e) => filter === "semua" || filter === e.type);
  const shift = (n: number) => { setMonthState(format(addMonths(parseISO(`${month}-01`), n), "yyyy-MM")); setSelected(null); };
  const daySessions = sessions.filter((s) => s.date === day);
  const dayEvents = events.filter((e) => e.date === day);

  return (
    <div>
      <PageHeader
        title={isAdmin ? "Jadwal & Kalender" : "Jadwal Mengajar Saya"}
        subtitle={isAdmin ? "Semua sesi tentor, Try Out, dan hari libur." : "Kalender otomatis tersaring hanya untuk jadwal Anda."}
        actions={isAdmin && (
          <>
            <Button variant="outline" data-testid="btn-tambah-agenda" onClick={() => setDlg("event")}><Flag className="mr-1 h-4 w-4" /> Tambah Agenda</Button>
            <Button data-testid="btn-tambah-jadwal" onClick={() => setDlg("jadwal")}><CalendarPlus className="mr-1 h-4 w-4" /> Tambah Jadwal</Button>
          </>
        )}
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" data-testid="calendar-prev-month" onClick={() => shift(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <h2 data-testid="calendar-month-label" className="min-w-40 text-center text-xl font-semibold capitalize">{month && monthLabel(month)}</h2>
          <Button variant="outline" size="icon" data-testid="calendar-next-month" onClick={() => shift(1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
        {isAdmin && (
          <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
            <TabsList>
              <TabsTrigger value="semua" data-testid="calendar-filter-semua">Semua</TabsTrigger>
              <TabsTrigger value="sesi" data-testid="calendar-filter-sesi">Sesi Belajar</TabsTrigger>
              <TabsTrigger value="tryout" data-testid="calendar-filter-tryout">Try Out</TabsTrigger>
              <TabsTrigger value="libur" data-testid="calendar-filter-libur">Hari Libur</TabsTrigger>
            </TabsList>
          </Tabs>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="grid grid-cols-7 border-b bg-slate-50 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">
            {WEEKDAYS.map((w) => <div key={w} className="py-2">{w}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((d) => {
              const inMonth = d.startsWith(month);
              const ss = sessions.filter((s) => s.date === d);
              const ev = events.filter((e) => e.date === d);
              return (
                <button
                  key={d}
                  type="button"
                  data-testid={`calendar-day-${d}`}
                  onClick={() => setSelected(d)}
                  className={cn(
                    "min-h-24 border-b border-r p-1.5 text-left align-top transition-colors duration-150 hover:bg-blue-50/50 sm:min-h-28",
                    !inMonth && "bg-slate-50/60 text-slate-400",
                    d === day && "bg-blue-50 ring-2 ring-inset ring-blue-500",
                    ev.some((e) => e.type === "libur") && "bg-rose-50/60",
                  )}
                >
                  <div className={cn("mb-1 inline-grid h-6 w-6 place-items-center rounded-full text-xs font-semibold", d === today && "bg-blue-600 text-white")}>
                    {Number(d.slice(8))}
                  </div>
                  <div className="space-y-0.5">
                    {ev.map((e) => (
                      <div key={e.id} className={cn("truncate rounded px-1 py-0.5 text-[10px] font-semibold", e.type === "tryout" ? "bg-amber-100 text-amber-900" : "bg-rose-100 text-rose-900")}>
                        {e.title}
                      </div>
                    ))}
                    {ss.slice(0, 3).map((s) => (
                      <div key={s.id} className={cn("truncate rounded px-1 py-0.5 text-[10px]", isAdmin ? "bg-blue-100 text-blue-900" : "bg-teal-100 text-teal-900")}>
                        <span className="font-mono">{s.start}</span> {s.changed_at && "• "}{s.subject}
                      </div>
                    ))}
                    {ss.length > 3 && <div className="px-1 text-[10px] text-slate-500">+{ss.length - 3} lagi</div>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="rounded-xl border bg-card p-4" data-testid="calendar-day-panel">
          <h3 className="mb-3 font-semibold capitalize">{day ? fmtLong(day) : "Pilih tanggal"}</h3>
          <div className="space-y-2">
            {dayEvents.map((e) => (
              <div key={e.id} data-testid={`day-event-${e.id}`} className={cn("flex items-start justify-between gap-2 rounded-lg border p-3", e.type === "tryout" ? "border-amber-200 bg-amber-50" : "border-rose-200 bg-rose-50")}>
                <div>
                  <div className="text-sm font-semibold">{e.title}</div>
                  <div className="text-xs text-slate-600">{e.type === "tryout" ? "Try Out" : "Hari Libur"}{e.note && ` · ${e.note}`}</div>
                </div>
                {isAdmin && (
                  <Button variant="ghost" size="icon-sm" data-testid={`day-event-delete-${e.id}`} onClick={() => del.mutate({ kind: "events", id: e.id })}><Trash2 className="h-3.5 w-3.5" /></Button>
                )}
              </div>
            ))}
            {daySessions.map((s) => (
              <div key={s.id} data-testid={`day-session-${s.id}`} className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-mono text-xs font-semibold text-slate-700">{s.start}–{s.end} · {s.room}</div>
                    <div className="font-semibold">{s.subject}</div>
                    {s.changed_at && <span data-testid={`day-session-changed-${s.id}`} className="rounded bg-teal-100 px-1.5 py-0.5 text-[11px] font-semibold text-teal-800">Diubah Admin</span>}
                    {isAdmin && <div className="text-sm text-slate-600">{s.tentor_name}</div>}
                  </div>
                  <StatusBadge status={s.journal_status} />
                </div>
                <div className="mt-1 text-xs text-slate-500">{s.student_names.join(", ")}</div>
                <div className="mt-2 flex gap-2">
                  {!isAdmin && s.journal_status === "Belum Diisi" && s.date <= today && (
                    <Button size="xs" data-testid={`day-session-jurnal-${s.id}`} onClick={() => setJurnalFor(s)}>Isi Jurnal</Button>
                  )}
                  {isAdmin && s.journal_status === "Belum Diisi" && (
                    <>
                      <Button variant="outline" size="xs" data-testid={`day-session-edit-${s.id}`} onClick={() => { setEditing(s); setDlg("jadwal"); }}>
                        <Pencil className="mr-1 h-3 w-3" /> Ubah
                      </Button>
                      <Button variant="ghost" size="xs" data-testid={`day-session-delete-${s.id}`} onClick={() => del.mutate({ kind: "jadwal", id: s.id })}>
                        <Trash2 className="mr-1 h-3 w-3" /> Hapus
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
            {dayEvents.length === 0 && daySessions.length === 0 && <p className="py-6 text-center text-sm text-slate-500">Tidak ada agenda.</p>}
            {isAdmin && day && (
              <Button variant="outline" size="sm" className="w-full" data-testid="day-panel-add-jadwal" onClick={() => setDlg("jadwal")}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Jadwal di tanggal ini
              </Button>
            )}
          </div>
          <div className="mt-6 flex flex-wrap gap-3 border-t pt-3 text-xs text-slate-600">
            <span className="flex items-center gap-1"><span className={cn("h-2.5 w-2.5 rounded-sm", isAdmin ? "bg-blue-300" : "bg-teal-300")} /> Sesi</span>
            {isAdmin && <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-amber-300" /> Try Out</span>}
            {isAdmin && <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-rose-300" /> Libur</span>}
          </div>
        </aside>
      </div>
      {dlg === "jadwal" && <JadwalDialog open editing={editing} onClose={() => { setDlg(null); setEditing(null); }} defaultDate={day} />}
      {dlg === "event" && <EventDialog open onClose={() => setDlg(null)} defaultDate={day} />}
      <JurnalDialog jadwal={jurnalFor} onClose={() => setJurnalFor(null)} />
    </div>
  );
}

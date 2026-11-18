import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Printer } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, PageHeader, StatCard, StatusBadge } from "@/components/common";
import { apiGet } from "@/lib/api";
import { fmtDate, useMe, useToday } from "@/lib/format";
import { copyText, laporanWaText } from "@/lib/exportText";
import type { LaporanOut, StudentBrief } from "@/lib/types";

export default function Laporan() {
  const { data: me } = useMe();
  const isAdmin = me?.role === "admin";
  const { data: today } = useToday();
  const [studentId, setStudentId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const dateFrom = from || (today ? `${today.today.slice(0, 7)}-01` : "");
  const dateTo = to || today?.today || "";

  const { data: students = [] } = useQuery({ queryKey: ["laporan-students"], queryFn: () => apiGet<StudentBrief[]>("/laporan/students") });
  const { data } = useQuery({
    queryKey: ["laporan", studentId, dateFrom, dateTo],
    queryFn: () => apiGet<LaporanOut>(`/laporan/${studentId}?date_from=${dateFrom}&date_to=${dateTo}`),
    enabled: !!studentId && !!dateFrom && !!dateTo,
  });
  const nameOf = (id: string) => students.find((s) => s.id === id)?.name ?? "Pilih siswa";

  return (
    <div>
      <PageHeader
        title="Laporan Belajar"
        subtitle="Dirangkum otomatis dari Jurnal Tentor: riwayat materi & absensi siswa."
        actions={isAdmin && data && (
          <>
            <Button variant="outline" data-testid="btn-salin-wa-laporan" onClick={async () => {
              if (await copyText(laporanWaText(data))) toast.success("Ringkasan disalin — tempel di WhatsApp orang tua");
              else toast.error("Gagal menyalin");
            }}>
              <Copy className="mr-1 h-4 w-4" /> Salin Teks WA
            </Button>
            <Link to={`/cetak/laporan/${studentId}?from=${dateFrom}&to=${dateTo}`} data-testid="btn-cetak-laporan" className={buttonVariants({})}>
              <Printer className="mr-1 h-4 w-4" /> Cetak / PDF
            </Link>
          </>
        )}
      />
      <div className="mb-6 grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-[1.5fr_1fr_1fr]">
        <div className="space-y-1.5">
          <Label>Siswa</Label>
          <Select value={studentId} onValueChange={(v: string) => setStudentId(v)}>
            <SelectTrigger className="w-full" data-testid="laporan-student-select"><SelectValue>{(v) => nameOf(v as string)}</SelectValue></SelectTrigger>
            <SelectContent>
              {students.map((s, i) => <SelectItem key={s.id} value={s.id} data-testid={`laporan-student-option-${i}`}>{s.name} ({s.jenjang})</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="l-from">Dari</Label>
          <Input id="l-from" type="date" data-testid="laporan-from-input" value={dateFrom} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="l-to">Sampai</Label>
          <Input id="l-to" type="date" data-testid="laporan-to-input" value={dateTo} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      {!studentId && <EmptyState text="Pilih siswa untuk melihat laporan belajar." testId="laporan-empty" />}
      {data && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
            <StatCard testId="laporan-persen" label="Kehadiran" value={`${data.summary.persen}%`} tone="green" hint={`${data.summary.total} sesi`} />
            <StatCard testId="laporan-hadir" label="Hadir" value={data.summary.hadir} tone="green" />
            <StatCard testId="laporan-izin" label="Izin" value={data.summary.izin} tone="blue" />
            <StatCard testId="laporan-sakit" label="Sakit" value={data.summary.sakit} tone="teal" />
            <StatCard testId="laporan-alpha" label="Alpha" value={data.summary.alpha} tone="red" />
          </div>
          <div className="rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Mapel / Tentor</TableHead>
                  <TableHead>Materi</TableHead>
                  <TableHead className="hidden lg:table-cell">Catatan</TableHead>
                  <TableHead>Kehadiran</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.entries.map((e, i) => (
                  <TableRow key={i} data-testid={`laporan-entry-${i}`}>
                    <TableCell className="whitespace-nowrap text-sm">{fmtDate(e.date)}</TableCell>
                    <TableCell><div className="font-semibold">{e.subject}</div><div className="text-xs text-slate-500">{e.tentor_name}</div></TableCell>
                    <TableCell className="max-w-64 whitespace-normal text-sm">{e.materi}</TableCell>
                    <TableCell className="hidden max-w-72 whitespace-normal text-xs text-slate-600 lg:table-cell">{e.catatan}</TableCell>
                    <TableCell><StatusBadge status={e.kehadiran} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {data.entries.length === 0 && <div className="p-6"><EmptyState text="Belum ada jurnal pada periode ini." /></div>}
          </div>
        </>
      )}
    </div>
  );
}

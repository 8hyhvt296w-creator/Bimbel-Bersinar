import { useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CartesianGrid, Legend, Line, LineChart, XAxis, YAxis } from "recharts";
import { PrintShell, SignatureBlock } from "@/components/PrintShell";
import { apiGet } from "@/lib/api";
import { fmtDate, fmtLong, monthLabel, rupiah } from "@/lib/format";
import type { Invoice, LaporanOut, PayrollOut, Rapor, RaporPoint } from "@/lib/types";

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="w-36 shrink-0 text-slate-500">{k}</span>
      <span className="font-medium text-slate-900">{v}</span>
    </div>
  );
}

const Loading = () => <p className="text-sm text-slate-500" data-testid="print-loading">Memuat data...</p>;

export function PrintInvoice() {
  const { id } = useParams();
  const { data: inv } = useQuery({ queryKey: ["invoice", id], queryFn: () => apiGet<Invoice>(`/invoices/${id}`) });
  return (
    <PrintShell title="Invoice" backTo="/invoice">
      {!inv ? <Loading /> : (
        <div data-testid="print-invoice">
          <div className="mb-6 flex justify-between">
            <div className="space-y-1">
              <Row k="No. Invoice" v={<span className="font-mono">{inv.code}</span>} />
              <Row k="Tanggal Terbit" v={fmtDate(inv.issued_date)} />
              <Row k="Jatuh Tempo" v={fmtDate(inv.due_date)} />
            </div>
            <div className={`h-fit rotate-[-6deg] rounded-md border-4 px-4 py-2 font-heading text-2xl font-bold uppercase ${inv.status === "Lunas" ? "border-green-600 text-green-600" : "border-red-600 text-red-600"}`}>
              {inv.status}
            </div>
          </div>
          <Row k="Ditagihkan kepada" v={inv.student_name} />
          <table className="mt-6 w-full text-sm">
            <thead><tr className="border-b-2 border-slate-900 text-left"><th className="py-2">Keterangan</th><th className="py-2 text-right">Jumlah</th></tr></thead>
            <tbody>
              <tr className="border-b"><td className="py-3">{inv.package_label} — biaya bimbingan belajar</td><td className="py-3 text-right">{rupiah(inv.amount)}</td></tr>
            </tbody>
            <tfoot><tr><td className="py-3 text-right font-semibold">Total</td><td className="py-3 text-right font-heading text-xl font-bold">{rupiah(inv.amount)}</td></tr></tfoot>
          </table>
          {inv.status === "Lunas" && <p className="mt-4 text-sm text-green-700">Dibayar {inv.paid_date && fmtDate(inv.paid_date)} via {inv.method}.</p>}
          <p className="mt-6 text-xs text-slate-500">Pembayaran dapat dilakukan melalui transfer ke rekening resmi bimbel. Mohon sertakan nomor invoice.</p>
          <SignatureBlock left="Orang Tua / Wali" right="Admin Bimbel" />
        </div>
      )}
    </PrintShell>
  );
}

export function PrintPayroll() {
  const [sp] = useSearchParams();
  const month = sp.get("month") ?? "";
  const { data } = useQuery({ queryKey: ["payroll", month], queryFn: () => apiGet<PayrollOut>(`/payroll?month=${month}`), enabled: !!month });
  return (
    <PrintShell title="Rekap Honor Tentor" backTo="/payroll">
      {!data ? <Loading /> : (
        <div data-testid="print-payroll">
          <Row k="Periode" v={<span className="capitalize">{monthLabel(data.month)}</span>} />
          <Row k="Sifat" v="Internal — Rahasia" />
          <table className="mt-6 w-full text-sm">
            <thead>
              <tr className="border-b-2 border-slate-900 text-left">
                <th className="py-2">No</th><th className="py-2">Tentor</th><th className="py-2">Mapel</th>
                <th className="py-2 text-center">Sesi Sah</th><th className="py-2 text-right">Tarif</th><th className="py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r, i) => (
                <tr key={r.tentor_id} className="border-b">
                  <td className="py-2">{i + 1}</td><td className="py-2 font-medium">{r.name}</td><td className="py-2">{r.subject}</td>
                  <td className="py-2 text-center">{r.sesi_sah}</td><td className="py-2 text-right">{rupiah(r.rate_per_session)}</td>
                  <td className="py-2 text-right font-semibold">{rupiah(r.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr><td colSpan={3} className="py-3 font-semibold">Total</td><td className="py-3 text-center font-semibold">{data.total_sesi_sah}</td><td />
                <td className="py-3 text-right font-heading text-lg font-bold" data-testid="print-payroll-total">{rupiah(data.grand_total)}</td></tr>
            </tfoot>
          </table>
          <SignatureBlock left="Disiapkan oleh" right="Disetujui oleh" />
        </div>
      )}
    </PrintShell>
  );
}

export function PrintLaporan() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const from = sp.get("from") ?? "";
  const to = sp.get("to") ?? "";
  const { data } = useQuery({
    queryKey: ["laporan", id, from, to],
    queryFn: () => apiGet<LaporanOut>(`/laporan/${id}?date_from=${from}&date_to=${to}`),
  });
  return (
    <PrintShell title="Laporan Belajar" backTo="/laporan">
      {!data ? <Loading /> : (
        <div data-testid="print-laporan">
          <div className="space-y-1">
            <Row k="Nama Siswa" v={data.student.name} />
            <Row k="Jenjang / Program" v={`${data.student.jenjang} · ${data.student.program}`} />
            <Row k="Periode" v={`${fmtDate(data.date_from)} – ${fmtDate(data.date_to)}`} />
            <Row k="Kehadiran" v={`${data.summary.persen}% (Hadir ${data.summary.hadir}, Izin ${data.summary.izin}, Sakit ${data.summary.sakit}, Alpha ${data.summary.alpha})`} />
          </div>
          <table className="mt-6 w-full text-sm">
            <thead><tr className="border-b-2 border-slate-900 text-left"><th className="py-2">Tanggal</th><th className="py-2">Mapel</th><th className="py-2">Materi & Catatan</th><th className="py-2">Hadir</th></tr></thead>
            <tbody>
              {data.entries.map((e, i) => (
                <tr key={i} className="border-b align-top">
                  <td className="whitespace-nowrap py-2 pr-2">{fmtDate(e.date)}</td>
                  <td className="py-2 pr-2">{e.subject}<div className="text-xs text-slate-500">{e.tentor_name}</div></td>
                  <td className="py-2 pr-2">{e.materi}<div className="text-xs text-slate-500">{e.catatan}</div></td>
                  <td className="py-2">{e.kehadiran}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.entries.length === 0 && <p className="mt-4 text-sm text-slate-500">Belum ada jurnal pada periode ini.</p>}
          <SignatureBlock left="Orang Tua / Wali" right="Admin Bimbel" />
        </div>
      )}
    </PrintShell>
  );
}

export function PrintRapor() {
  const { id } = useParams();
  const { data: r } = useQuery({ queryKey: ["rapor", id], queryFn: () => apiGet<Rapor>(`/rapor/${id}`) });
  const { data: history = [] } = useQuery({ queryKey: ["rapor-riwayat", id], queryFn: () => apiGet<RaporPoint[]>(`/rapor/${id}/riwayat`) });
  const chartData = history.map((h) => ({ ...h, bulan: fmtDate(`${h.period}-01`, "MMM yy") }));
  return (
    <PrintShell title="Rapor Siswa" backTo="/rapor">
      {!r ? <Loading /> : (
        <div data-testid="print-rapor">
          <div className="space-y-1">
            <Row k="Nama Siswa" v={r.student_name} />
            <Row k="Jenjang / Program" v={`${r.jenjang} · ${r.program}`} />
            <Row k="Jenis / Periode" v={<span className="capitalize">{r.label} · {monthLabel(r.period)}</span>} />
            <Row k="Mata Pelajaran" v={`${r.subject} — ${r.tentor_name}`} />
            <Row k="Status" v={r.status === "Diterbitkan" ? `Diterbitkan${r.published_at ? ` ${fmtLong(r.published_at.slice(0, 10))}` : ""}` : "Draft (belum diterbitkan)"} />
          </div>
          <table className="mt-6 w-full text-sm">
            <thead><tr className="border-b-2 border-slate-900 text-left"><th className="py-2">Aspek Penilaian</th><th className="py-2 text-right">Nilai</th></tr></thead>
            <tbody>
              <tr className="border-b"><td className="py-2">Pemahaman Materi</td><td className="py-2 text-right font-semibold">{r.nilai_pemahaman}</td></tr>
              <tr className="border-b"><td className="py-2">Kuis / Tugas</td><td className="py-2 text-right font-semibold">{r.nilai_kuis}</td></tr>
              <tr className="border-b"><td className="py-2">Keaktifan</td><td className="py-2 text-right font-semibold">{r.nilai_keaktifan}</td></tr>
              <tr className="border-b"><td className="py-2">Kehadiran ({r.kehadiran.hadir}/{r.kehadiran.total} sesi)</td><td className="py-2 text-right font-semibold">{r.kehadiran.persen}%</td></tr>
            </tbody>
            <tfoot><tr><td className="py-3 font-semibold">Rata-rata Nilai</td><td className="py-3 text-right font-heading text-xl font-bold">{r.rata_rata}</td></tr></tfoot>
          </table>
          <div className="mt-6 space-y-3 text-sm">
            <div><div className="font-semibold">Catatan Akademik</div><p className="text-slate-700">{r.catatan}</p></div>
            {r.rekomendasi && <div><div className="font-semibold">Rekomendasi</div><p className="text-slate-700">{r.rekomendasi}</p></div>}
          </div>
          <div className="mt-8 break-inside-avoid" data-testid="rapor-progress-chart">
            <div className="font-semibold">Grafik Perkembangan Nilai — {r.subject}</div>
            <p className="mb-2 text-xs text-slate-500">Rapor yang telah diterbitkan dari bulan ke bulan.</p>
            {chartData.length < 2 ? (
              <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-500" data-testid="rapor-chart-empty">Grafik akan tampil setelah ada minimal 2 periode rapor.</p>
            ) : (
              <div className="overflow-x-auto">
                <LineChart width={720} height={240} data={chartData} margin={{ top: 18, right: 36, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="bulan" tick={{ fontSize: 12, fill: "#475569" }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "#475569" }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line isAnimationActive={false} type="monotone" dataKey="rata_rata" name="Rata-rata" stroke="#1E3A8A" strokeWidth={3} dot={{ r: 4 }} label={{ position: "top", fontSize: 11, fill: "#1E3A8A" }} />
                  <Line isAnimationActive={false} type="monotone" dataKey="nilai_pemahaman" name="Pemahaman" stroke="#2563EB" strokeWidth={1.5} dot={{ r: 3 }} />
                  <Line isAnimationActive={false} type="monotone" dataKey="nilai_kuis" name="Kuis/Tugas" stroke="#F59E0B" strokeWidth={1.5} dot={{ r: 3 }} />
                  <Line isAnimationActive={false} type="monotone" dataKey="nilai_keaktifan" name="Keaktifan" stroke="#0D9488" strokeWidth={1.5} dot={{ r: 3 }} />
                  <Line isAnimationActive={false} type="monotone" dataKey="kehadiran_persen" name="Kehadiran %" stroke="#94A3B8" strokeDasharray="5 4" strokeWidth={1.5} dot={false} />
                </LineChart>
              </div>
            )}
          </div>
          <SignatureBlock left="Tentor" right="Kepala Bimbel" />
        </div>
      )}
    </PrintShell>
  );
}

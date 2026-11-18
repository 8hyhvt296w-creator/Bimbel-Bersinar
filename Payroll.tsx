import { Fragment, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Lock, Printer } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, StatCard } from "@/components/common";
import { apiGet } from "@/lib/api";
import { fmtDate, monthLabel, rupiah, useToday } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PayrollOut } from "@/lib/types";

export default function Payroll() {
  const { data: today } = useToday();
  const [monthState, setMonth] = useState("");
  const month = monthState || (today?.today.slice(0, 7) ?? "");
  const [expanded, setExpanded] = useState<string | null>(null);
  const { data } = useQuery({ queryKey: ["payroll", month], queryFn: () => apiGet<PayrollOut>(`/payroll?month=${month}`), enabled: !!month });

  return (
    <div>
      <PageHeader
        title="Payroll / Gaji Tentor"
        subtitle="Privat — khusus Admin. Total gaji = sesi sah (jurnal tervalidasi) × tarif per sesi."
        actions={
          <Link to={`/cetak/payroll?month=${month}`} data-testid="btn-cetak-rekap-gaji" className={buttonVariants({})}>
            <Printer className="mr-1 h-4 w-4" /> Cetak Rekap
          </Link>
        }
      />
      <div className="mb-6 flex flex-wrap items-end gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="pay-month">Periode</Label>
          <Input id="pay-month" type="month" data-testid="payroll-month-input" value={month} onChange={(e) => setMonth(e.target.value)} className="w-48" />
        </div>
        <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-900">
          <Lock className="h-3 w-3" /> Data rahasia keuangan
        </span>
      </div>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard testId="payroll-total-sesi" label="Total Sesi Sah" value={data?.total_sesi_sah ?? "–"} tone="blue" hint={month ? monthLabel(month) : undefined} />
        <StatCard testId="payroll-grand-total" label="Total Gaji Ditransfer" value={data ? rupiah(data.grand_total) : "–"} tone="green" />
        <StatCard testId="payroll-menunggu" label="Sesi Menunggu Validasi" value={data ? data.rows.reduce((a, r) => a + r.sesi_menunggu, 0) : "–"} tone="amber" hint="Belum dihitung ke gaji" />
      </div>
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tentor</TableHead>
              <TableHead>Tarif / Sesi</TableHead>
              <TableHead className="text-center">Sesi Sah</TableHead>
              <TableHead className="hidden text-center md:table-cell">Menunggu</TableHead>
              <TableHead className="text-right">Total Gaji</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.rows.map((r) => (
              <Fragment key={r.tentor_id}>
                <TableRow data-testid={`payroll-row-${r.tentor_id}`} className="cursor-pointer transition-colors duration-150 hover:bg-slate-50" onClick={() => setExpanded(expanded === r.tentor_id ? null : r.tentor_id)}>
                  <TableCell><div className="font-semibold">{r.name}</div><div className="text-xs text-slate-500">{r.subject}</div></TableCell>
                  <TableCell>{rupiah(r.rate_per_session)}</TableCell>
                  <TableCell className="text-center font-semibold" data-testid={`payroll-sesi-${r.tentor_id}`}>{r.sesi_sah}</TableCell>
                  <TableCell className="hidden text-center text-slate-500 md:table-cell">{r.sesi_menunggu}</TableCell>
                  <TableCell className="text-right font-heading text-base font-bold" data-testid={`payroll-total-${r.tentor_id}`}>{rupiah(r.total)}</TableCell>
                  <TableCell><ChevronDown className={cn("h-4 w-4 transition-transform duration-200", expanded === r.tentor_id && "rotate-180")} /></TableCell>
                </TableRow>
                {expanded === r.tentor_id && (
                  <TableRow className="bg-slate-50/70">
                    <TableCell colSpan={6}>
                      {r.details.length === 0 ? <span className="text-sm text-slate-500">Belum ada sesi sah.</span> : (
                        <div className="grid gap-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
                          {r.details.map((d, i) => (
                            <div key={i} className="font-mono text-xs text-slate-600">{fmtDate(d.date)} · {d.start}–{d.end} · {d.room}</div>
                          ))}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            ))}
          </TableBody>
          {data && (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2} className="font-semibold">Total</TableCell>
                <TableCell className="text-center font-semibold">{data.total_sesi_sah}</TableCell>
                <TableCell className="hidden md:table-cell" />
                <TableCell className="text-right font-heading text-base font-bold">{rupiah(data.grand_total)}</TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
    </div>
  );
}

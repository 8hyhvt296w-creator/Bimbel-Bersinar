import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { CheckCircle2, Printer } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, PageHeader, StatusBadge } from "@/components/common";
import { apiGet, apiPost } from "@/lib/api";
import { errMsg, fmtDate, rupiah, useToday } from "@/lib/format";
import type { Invoice as Inv, InvoicePayIn } from "@/lib/types";

const METHODS = ["Transfer Bank", "Tunai", "QRIS", "E-Wallet"];

function PayDialog({ invoice, onClose }: { invoice: Inv | null; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: today } = useToday();
  const [method, setMethod] = useState("Transfer Bank");
  const [paidDate, setPaidDate] = useState("");
  const pay = useMutation({
    mutationFn: (body: InvoicePayIn) => apiPost<Inv>(`/invoices/${invoice?.id}/lunas`, body),
    onSuccess: (inv) => {
      toast.success(`${inv.code} lunas — ${inv.student_name} kini berstatus Aktif`);
      for (const k of ["invoices", "students", "dashboard"]) void qc.invalidateQueries({ queryKey: [k] });
      onClose();
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <Dialog open={!!invoice} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Konfirmasi Pembayaran</DialogTitle>
          <DialogDescription>
            {invoice?.code} · {invoice?.student_name} · {invoice && rupiah(invoice.amount)}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Metode Pembayaran</Label>
            <Select value={method} onValueChange={(v: string) => setMethod(v)}>
              <SelectTrigger className="w-full" data-testid="pay-method-select"><SelectValue /></SelectTrigger>
              <SelectContent>{METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="paid-date">Tanggal Bayar</Label>
            <Input id="paid-date" type="date" data-testid="pay-date-input" value={paidDate || today?.today || ""} onChange={(e) => setPaidDate(e.target.value)} />
          </div>
        </div>
        <p className="rounded-md bg-green-50 p-3 text-sm text-green-800">Setelah dikonfirmasi, status siswa otomatis menjadi <b>Aktif</b> dan siap dijadwalkan.</p>
        <DialogFooter>
          <Button data-testid="pay-confirm-button" disabled={pay.isPending} onClick={() => pay.mutate({ method, paid_date: paidDate || null })}>
            <CheckCircle2 className="mr-1 h-4 w-4" /> Tandai Lunas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Invoice() {
  const [tab, setTab] = useState("semua");
  const [paying, setPaying] = useState<Inv | null>(null);
  const { data: today } = useToday();
  const tomorrow = today ? format(addDays(parseISO(today.today), 1), "yyyy-MM-dd") : "";
  const { data: invoices, isError } = useQuery({ queryKey: ["invoices"], queryFn: () => apiGet<Inv[]>("/invoices") });
  const list = (invoices ?? []).filter((i) => tab === "semua" || (tab === "belum" ? i.status === "Belum Bayar" : i.status === "Lunas"));

  return (
    <div>
      <PageHeader title="Invoice & Penagihan" subtitle="Jatuh tempo 7 hari setelah invoice diterbitkan." />
      <Tabs value={tab} onValueChange={(v) => setTab(String(v))} className="mb-4">
        <TabsList>
          <TabsTrigger value="semua" data-testid="invoice-tab-semua">Semua</TabsTrigger>
          <TabsTrigger value="belum" data-testid="invoice-tab-belum">Belum Bayar</TabsTrigger>
          <TabsTrigger value="lunas" data-testid="invoice-tab-lunas">Lunas</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>No. Invoice</TableHead>
              <TableHead>Siswa</TableHead>
              <TableHead className="hidden md:table-cell">Paket</TableHead>
              <TableHead>Nominal</TableHead>
              <TableHead>Jatuh Tempo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((i) => {
              const overdue = i.status === "Belum Bayar" && !!today && i.due_date < today.today;
              return (
                <TableRow key={i.id} data-testid={`invoice-row-${i.id}`} className="transition-colors duration-150 hover:bg-slate-50">
                  <TableCell className="font-mono text-xs">{i.code}</TableCell>
                  <TableCell className="font-semibold">{i.student_name}</TableCell>
                  <TableCell className="hidden text-sm md:table-cell">{i.package_label}</TableCell>
                  <TableCell className="font-semibold">{rupiah(i.amount)}</TableCell>
                  <TableCell className={overdue ? "font-semibold text-red-600" : "text-sm"}>
                    {fmtDate(i.due_date)}
                    {i.status === "Belum Bayar" && today && (
                      overdue ? (
                        <span data-testid={`invoice-flag-${i.id}`} className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-[11px] font-semibold text-red-800">
                          Lewat {differenceInCalendarDays(parseISO(today.today), parseISO(i.due_date))} hari
                        </span>
                      ) : i.due_date === today.today ? (
                        <span data-testid={`invoice-flag-${i.id}`} className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-900">Hari ini</span>
                      ) : i.due_date === tomorrow ? (
                        <span data-testid={`invoice-flag-${i.id}`} className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-900">Besok (H-1)</span>
                      ) : null
                    )}
                  </TableCell>
                  <TableCell><StatusBadge status={i.status} testId={`invoice-status-${i.id}`} /></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {i.status === "Belum Bayar" && (
                        <Button size="sm" data-testid={`invoice-pay-${i.id}`} onClick={() => setPaying(i)}>Ubah ke Lunas</Button>
                      )}
                      <Link to={`/cetak/invoice/${i.id}`} data-testid={`invoice-print-${i.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                        <Printer className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {invoices && list.length === 0 && <div className="p-6"><EmptyState text="Tidak ada invoice." /></div>}
        {isError && <div className="p-6"><EmptyState text="Data invoice belum dapat dimuat." /></div>}
      </div>
      <PayDialog key={paying?.id ?? "none"} invoice={paying} onClose={() => setPaying(null)} />
    </div>
  );
}

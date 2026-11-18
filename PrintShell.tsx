import { Link } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { BIMBEL_NAME } from "@/lib/format";

export function PrintShell({ title, children, backTo }: { title: string; children: React.ReactNode; backTo: string }) {
  return (
    <div className="min-h-screen bg-slate-100 py-8 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-[820px] items-center justify-between px-4 print:hidden">
        <Link to={backTo} data-testid="print-back-link" className={buttonVariants({ variant: "outline", size: "sm" })}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Kembali
        </Link>
        <Button size="sm" data-testid="print-button" onClick={() => window.print()}>
          <Printer className="mr-1 h-4 w-4" /> Cetak / Simpan PDF
        </Button>
      </div>
      <div className="mx-auto max-w-[820px] bg-white p-10 shadow-sm print:max-w-none print:p-0 print:shadow-none">
        <div className="mb-6 flex items-start justify-between border-b-2 border-slate-900 pb-4">
          <div>
            <div className="font-heading text-2xl font-bold text-slate-900">{BIMBEL_NAME}</div>
            <div className="text-xs text-slate-500">Jl. Pendidikan No. 12, Bandung · 0812-1111-0000</div>
          </div>
          <div className="text-right font-heading text-lg font-semibold uppercase tracking-wide text-slate-700">{title}</div>
        </div>
        {children}
      </div>
    </div>
  );
}

export function SignatureBlock({ left, right }: { left: string; right: string }) {
  return (
    <div className="mt-12 grid grid-cols-2 gap-8 text-center text-sm">
      <div>
        <div className="text-slate-500">{left}</div>
        <div className="mt-16 border-t border-slate-400 pt-1">( ........................ )</div>
      </div>
      <div>
        <div className="text-slate-500">{right}</div>
        <div className="mt-16 border-t border-slate-400 pt-1">( ........................ )</div>
      </div>
    </div>
  );
}

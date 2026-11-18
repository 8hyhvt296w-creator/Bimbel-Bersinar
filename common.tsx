import { cn } from "@/lib/utils";

const STYLES: Record<string, string> = {
  "Lunas": "bg-green-100 text-green-800 border-green-200",
  "Aktif": "bg-green-100 text-green-800 border-green-200",
  "Hadir": "bg-green-100 text-green-800 border-green-200",
  "Diterbitkan": "bg-green-100 text-green-800 border-green-200",
  "Belum Bayar": "bg-red-100 text-red-800 border-red-200",
  "Alpha": "bg-red-100 text-red-800 border-red-200",
  "Belum Aktif": "bg-slate-100 text-slate-700 border-slate-200",
  "Belum Diisi": "bg-amber-50 text-amber-800 border-amber-200",
  "Draft": "bg-amber-50 text-amber-800 border-amber-200",
  "Izin": "bg-sky-50 text-sky-800 border-sky-200",
  "Sakit": "bg-violet-50 text-violet-800 border-violet-200",
  "Terkirim": "bg-teal-50 text-teal-800 border-teal-200",
  "Tervalidasi": "bg-blue-100 text-blue-800 border-blue-200",
};

export function StatusBadge({ status, testId, className }: { status: string; testId?: string; className?: string }) {
  return (
    <span
      data-testid={testId}
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wider",
        STYLES[status] ?? "bg-slate-100 text-slate-700 border-slate-200",
        className,
      )}
    >
      {status}
    </span>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 data-testid="page-title" className="text-2xl font-bold text-slate-900 sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, hint, tone = "slate", testId, icon }: {
  label: string; value: React.ReactNode; hint?: string; tone?: "slate" | "blue" | "green" | "red" | "amber" | "teal";
  testId: string; icon?: React.ReactNode;
}) {
  const toneCls = {
    slate: "text-slate-500", blue: "text-blue-600", green: "text-green-600", red: "text-red-600",
    amber: "text-amber-600", teal: "text-teal-600",
  }[tone];
  return (
    <div data-testid={testId} className="animate-rise rounded-xl border bg-card p-5 transition-shadow duration-200 hover:shadow-md">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</span>
        <span className={toneCls}>{icon}</span>
      </div>
      <div data-testid={`${testId}-value`} className="mt-3 font-heading text-3xl font-bold text-slate-900">{value}</div>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function EmptyState({ text, testId }: { text: string; testId?: string }) {
  return (
    <div data-testid={testId} className="rounded-lg border border-dashed bg-card/50 px-4 py-10 text-center text-sm text-slate-500">
      {text}
    </div>
  );
}

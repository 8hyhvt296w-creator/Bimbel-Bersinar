import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { BookOpenCheck, CalendarDays, ShieldCheck, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiPost } from "@/lib/api";
import { beginSession } from "@/lib/session";
import { BIMBEL_NAME, errMsg, useMe } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Me } from "@/lib/types";

const DEMO = {
  admin: { email: "admin@bimbel.id", password: "admin123", label: "Admin", who: "Budi Santoso" },
  tentor: { email: "siti@bimbel.id", password: "tentor123", label: "Tentor", who: "Siti Rahma · Matematika" },
} as const;

export default function Login() {
  const navigate = useNavigate();
  const { data: me } = useMe();
  const [role, setRole] = useState<"admin" | "tentor">("admin");
  const [email, setEmail] = useState<string>(DEMO.admin.email);
  const [password, setPassword] = useState<string>(DEMO.admin.password);
  const [error, setError] = useState("");

  const login = useMutation({
    mutationFn: () => apiPost<Me>("/auth/login", { email, password }),
    onSuccess: () => {
      beginSession();
      navigate("/", { replace: true });
    },
    onError: (e) => setError(errMsg(e, "Gagal masuk")),
  });

  if (me) return <Navigate to="/" replace />;

  const pick = (r: "admin" | "tentor") => {
    setRole(r);
    setEmail(DEMO[r].email);
    setPassword(DEMO[r].password);
    setError("");
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden overflow-hidden bg-slate-900 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-blue-600/30 blur-3xl" />
        <div className="absolute -bottom-32 left-10 h-80 w-80 rounded-full bg-amber-400/20 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-lg bg-amber-400 text-slate-900"><Sun className="h-6 w-6" /></div>
          <span className="font-heading text-2xl font-bold" data-testid="login-brand">{BIMBEL_NAME}</span>
        </div>
        <div className="relative max-w-md">
          <h1 className="font-heading text-5xl font-bold leading-tight">Administrasi bimbel yang rapi, privasi keuangan terjaga.</h1>
          <p className="mt-4 text-slate-300">Pendaftaran & invoice, jadwal anti-bentrok, jurnal tentor, payroll otomatis, hingga rapor siswa — dalam satu tempat.</p>
          <ul className="mt-8 space-y-3 text-sm text-slate-300">
            <li className="flex items-center gap-3"><CalendarDays className="h-4 w-4 text-blue-400" /> Kalender bulanan otomatis per peran</li>
            <li className="flex items-center gap-3"><BookOpenCheck className="h-4 w-4 text-teal-400" /> Jurnal tervalidasi = 1 sesi sah</li>
            <li className="flex items-center gap-3"><ShieldCheck className="h-4 w-4 text-amber-400" /> Tarif honor hanya terlihat oleh Admin</li>
          </ul>
        </div>
        <p className="relative text-xs text-slate-500">© {BIMBEL_NAME}</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <form
          className="animate-rise w-full max-w-sm space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            setError("");
            login.mutate();
          }}
        >
          <div>
            <div className="mb-6 font-heading text-xl font-bold lg:hidden">{BIMBEL_NAME}</div>
            <h2 className="text-3xl font-bold">Masuk</h2>
            <p className="mt-1 text-sm text-slate-600">Pilih peran demo atau masukkan akun Anda.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-1">
            {(["admin", "tentor"] as const).map((r) => (
              <button
                type="button"
                key={r}
                data-testid={`login-role-${r}`}
                onClick={() => pick(r)}
                className={cn(
                  "rounded-md px-3 py-2 text-left transition-colors duration-150",
                  role === r ? "bg-card shadow-sm" : "text-slate-500 hover:text-slate-800",
                )}
              >
                <div className="text-sm font-semibold">{DEMO[r].label}</div>
                <div className="truncate text-[11px] text-slate-500">{DEMO[r].who}</div>
              </button>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" data-testid="login-email-input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" data-testid="login-password-input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <p data-testid="login-error" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <Button type="submit" className="w-full" size="lg" data-testid="login-submit-button" disabled={login.isPending}>
            {login.isPending ? "Memproses..." : "Masuk"}
          </Button>
        </form>
      </div>
    </div>
  );
}

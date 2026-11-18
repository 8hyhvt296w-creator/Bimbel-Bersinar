import { useState } from "react";
import { Link, NavLink, Navigate, Outlet } from "react-router-dom";
import {
  BookOpenCheck, CalendarDays, ClipboardList, FileText, GraduationCap, LayoutDashboard, LogOut, Menu,
  Receipt, ScrollText, Settings, Users, Wallet,
} from "lucide-react";
import NotificationBell from "@/components/NotificationBell";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { endSession } from "@/lib/session";
import { BIMBEL_NAME, useMe } from "@/lib/format";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/types";

interface NavItem { to: string; label: string; icon: React.ComponentType<{ className?: string }>; testId: string }

const NAV: Record<Role, NavItem[]> = {
  admin: [
    { to: "/", label: "Dashboard", icon: LayoutDashboard, testId: "sidebar-nav-dashboard" },
    { to: "/siswa", label: "Data Siswa", icon: GraduationCap, testId: "sidebar-nav-siswa" },
    { to: "/invoice", label: "Invoice", icon: Receipt, testId: "sidebar-nav-invoice" },
    { to: "/tentor", label: "Data Tentor", icon: Users, testId: "sidebar-nav-tentor" },
    { to: "/jadwal", label: "Jadwal & Kalender", icon: CalendarDays, testId: "sidebar-nav-jadwal" },
    { to: "/jurnal", label: "Validasi Jurnal", icon: BookOpenCheck, testId: "sidebar-nav-jurnal" },
    { to: "/payroll", label: "Payroll / Gaji Tentor", icon: Wallet, testId: "sidebar-nav-payroll" },
    { to: "/laporan", label: "Laporan Belajar", icon: FileText, testId: "sidebar-nav-laporan" },
    { to: "/rapor", label: "Report Siswa", icon: ScrollText, testId: "sidebar-nav-rapor" },
    { to: "/pengaturan", label: "Pengaturan", icon: Settings, testId: "sidebar-nav-pengaturan" },
  ],
  tentor: [
    { to: "/", label: "Beranda", icon: LayoutDashboard, testId: "sidebar-nav-dashboard" },
    { to: "/jadwal", label: "Jadwal Saya", icon: CalendarDays, testId: "sidebar-nav-jadwal" },
    { to: "/jurnal", label: "Jurnal Tentor", icon: ClipboardList, testId: "sidebar-nav-jurnal" },
    { to: "/laporan", label: "Laporan Belajar", icon: FileText, testId: "sidebar-nav-laporan" },
    { to: "/rapor", label: "Report Siswa", icon: ScrollText, testId: "sidebar-nav-rapor" },
  ],
};

function SidebarBody({ role, name, onNavigate }: { role: Role; name: string; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <Link to="/" onClick={onNavigate} className="flex items-center gap-3 px-6 py-6" data-testid="sidebar-brand">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-600 font-heading text-lg font-bold">BB</div>
        <div>
          <div className="font-heading text-lg font-bold leading-tight">{BIMBEL_NAME}</div>
          <div className="text-xs text-slate-400">Administrasi Bimbel</div>
        </div>
      </Link>
      <div className="px-6 pb-4">
        <span
          data-testid="sidebar-role-badge"
          className={cn(
            "inline-flex rounded-md border px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider",
            role === "admin" ? "border-indigo-400/40 bg-indigo-500/15 text-indigo-200" : "border-teal-400/40 bg-teal-500/15 text-teal-200",
          )}
        >
          {role === "admin" ? "Admin" : "Tentor"}
        </span>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3">
        {NAV[role].map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            onClick={onNavigate}
            data-testid={item.testId}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150",
                isActive ? "bg-sidebar-accent text-white" : "text-slate-400 hover:bg-sidebar-accent/60 hover:text-white",
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className={cn("h-4 w-4", isActive && (role === "admin" ? "text-blue-400" : "text-teal-400"))} />
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-sidebar-border p-4">
        <div className="mb-3 flex items-center justify-between gap-2 px-2">
          <div data-testid="sidebar-user-name" className="truncate text-sm font-semibold">{name}</div>
          <NotificationBell dark />
        </div>
        <Button
          variant="ghost"
          data-testid="logout-button"
          className="w-full justify-start text-slate-300 hover:bg-sidebar-accent hover:text-white"
          onClick={() => void endSession()}
        >
          <LogOut className="mr-2 h-4 w-4" /> Keluar
        </Button>
      </div>
    </div>
  );
}

export default function AppLayout() {
  const { data: me, error, isLoading } = useMe();
  const [open, setOpen] = useState(false);

  if (error instanceof ApiError && error.status === 401) return <Navigate to="/login" replace />;
  if (error) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[260px] lg:block">
        {me && <SidebarBody role={me.role} name={me.name} />}
      </aside>
      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur-md lg:hidden">
        <Button variant="ghost" size="icon" data-testid="mobile-menu-button" onClick={() => setOpen(true)}>
          <Menu className="h-5 w-5" />
        </Button>
        <span className="font-heading font-bold">{BIMBEL_NAME}</span>
        <div className="ml-auto"><NotificationBell variant="mobile" /></div>
      </header>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-[260px] p-0" showCloseButton={false}>
          <SheetTitle className="sr-only">Navigasi</SheetTitle>
          {me && <SidebarBody role={me.role} name={me.name} onNavigate={() => setOpen(false)} />}
        </SheetContent>
      </Sheet>
      <main className="lg:pl-[260px]">
        <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
          {isLoading || !me ? <div className="h-40 animate-pulse rounded-xl bg-muted" /> : <Outlet />}
        </div>
      </main>
    </div>
  );
}

export function AdminOnly({ children }: { children: React.ReactNode }) {
  const { data: me } = useMe();
  if (me && me.role !== "admin") return <Navigate to="/" replace />;
  return <>{children}</>;
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CalendarClock, Receipt } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { apiGet, apiPost } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Notification, NotificationList } from "@/lib/types";

export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: () => apiGet<NotificationList>("/notifications"),
    refetchInterval: 60_000,
  });
}

export function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "baru saja";
  if (mins < 60) return `${mins} menit lalu`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} jam lalu`;
  return `${Math.round(h / 24)} hari lalu`;
}

export function NotificationItem({ n }: { n: Notification }) {
  const Icon = n.kind === "jadwal" ? CalendarClock : Receipt;
  return (
    <div data-testid={`notification-${n.id}`} className={cn("flex gap-3 px-3 py-2.5", !n.read && "bg-blue-50/60")}>
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", n.kind === "jadwal" ? "text-teal-600" : "text-red-600")} />
      <div className="min-w-0">
        <div className="text-sm font-semibold text-slate-900">{n.title}</div>
        <div className="text-xs text-slate-600">{n.message}</div>
        <div className="mt-0.5 text-[11px] text-slate-400">{timeAgo(n.created_at)}</div>
      </div>
    </div>
  );
}

export default function NotificationBell({ dark = false, variant = "sidebar" }: { dark?: boolean; variant?: "sidebar" | "mobile" }) {
  const qc = useQueryClient();
  const { data } = useNotifications();
  const readAll = useMutation({
    mutationFn: () => apiPost("/notifications/read-all"),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const unread = data?.unread ?? 0;
  const sfx = variant === "mobile" ? "-mobile" : "";
  return (
    <Popover onOpenChange={(open) => { if (!open && unread > 0) readAll.mutate(); }}>
      <PopoverTrigger
        data-testid={`notification-bell${sfx}`}
        aria-label="Notifikasi"
        className={cn(
          "relative grid h-9 w-9 place-items-center rounded-lg transition-colors duration-150",
          dark ? "text-slate-300 hover:bg-sidebar-accent hover:text-white" : "text-slate-600 hover:bg-slate-100",
        )}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span data-testid={`notification-unread-count${sfx}`} className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {unread}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <div className="border-b px-3 py-2 text-sm font-semibold">Notifikasi</div>
        <div className="max-h-96 divide-y overflow-y-auto" data-testid={`notification-list${sfx}`}>
          {data?.items.map((n) => <NotificationItem key={n.id} n={n} />)}
          {data && data.items.length === 0 && <p className="p-4 text-center text-sm text-slate-500">Belum ada notifikasi.</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}

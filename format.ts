import { format, parseISO } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { ApiError, apiGet } from "./api";
import type { Me, TodayOut } from "./types";

export const BIMBEL_NAME = "Bimbel Bersinar";
export const ROOMS = ["Ruang A", "Ruang B", "Ruang C", "Ruang D", "Online"];

const idr = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
export const rupiah = (n: number) => idr.format(n);

export const fmtDate = (iso: string, pattern = "d MMM yyyy") => format(parseISO(iso), pattern, { locale: localeId });
export const fmtLong = (iso: string) => fmtDate(iso, "EEEE, d MMMM yyyy");
export const monthLabel = (month: string) => fmtDate(`${month}-01`, "MMMM yyyy");

export function errMsg(e: unknown, fallback = "Terjadi kesalahan"): string {
  if (e instanceof ApiError) {
    const body = e.body as { detail?: unknown } | null;
    if (typeof body?.detail === "string") return body.detail;
    if (Array.isArray(body?.detail) && body.detail[0]?.msg) return String(body.detail[0].msg);
  }
  return fallback;
}

export function useMe() {
  return useQuery({ queryKey: ["me"], queryFn: () => apiGet<Me>("/auth/me"), retry: false, staleTime: Infinity });
}

// "Today" is anchored on the server (Asia/Jakarta), never computed in the browser.
export function useToday() {
  return useQuery({ queryKey: ["today"], queryFn: () => apiGet<TodayOut>("/today"), staleTime: 60_000 });
}

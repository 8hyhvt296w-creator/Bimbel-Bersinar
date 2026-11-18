import { BIMBEL_NAME, fmtDate, monthLabel } from "./format";
import type { LaporanOut, Rapor } from "./types";

export function laporanWaText(l: LaporanOut): string {
  const s = l.summary;
  const lines = [
    `*Laporan Belajar — ${BIMBEL_NAME}*`,
    `Siswa: ${l.student.name} (${l.student.jenjang} · ${l.student.program})`,
    `Periode: ${fmtDate(l.date_from)} – ${fmtDate(l.date_to)}`,
    "",
    `Kehadiran: ${s.persen}% (Hadir ${s.hadir}, Izin ${s.izin}, Sakit ${s.sakit}, Alpha ${s.alpha} dari ${s.total} sesi)`,
    "",
    "*Riwayat Materi:*",
    ...l.entries.map((e) => `• ${fmtDate(e.date, "d MMM")} — ${e.subject}: ${e.materi} [${e.kehadiran}]`),
    "",
    `Terima kasih, Bapak/Ibu ${l.student.parent_name || "Orang Tua"}.`,
  ];
  return lines.join("\n");
}

export function raporWaText(r: Rapor): string {
  return [
    `*Rapor ${r.label} — ${BIMBEL_NAME}*`,
    `Siswa: ${r.student_name} (${r.jenjang} · ${r.program})`,
    `Periode: ${monthLabel(r.period)} · Mapel: ${r.subject} (${r.tentor_name})`,
    "",
    `Pemahaman Materi: ${r.nilai_pemahaman}`,
    `Kuis/Tugas: ${r.nilai_kuis}`,
    `Keaktifan: ${r.nilai_keaktifan}`,
    `Rata-rata: ${r.rata_rata}`,
    `Kehadiran: ${r.kehadiran.persen}% (${r.kehadiran.hadir}/${r.kehadiran.total} sesi)`,
    "",
    `Catatan: ${r.catatan}`,
    r.rekomendasi ? `Rekomendasi: ${r.rekomendasi}` : "",
  ].filter(Boolean).join("\n");
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import AppLayout, { AdminOnly } from "@/components/AppLayout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Siswa from "@/pages/Siswa";
import Invoice from "@/pages/Invoice";
import Tentor from "@/pages/Tentor";
import Jadwal from "@/pages/Jadwal";
import Jurnal from "@/pages/Jurnal";
import Payroll from "@/pages/Payroll";
import Laporan from "@/pages/Laporan";
import Rapor from "@/pages/Rapor";
import Pengaturan from "@/pages/Pengaturan";
import { PrintInvoice, PrintLaporan, PrintPayroll, PrintRapor } from "@/pages/Print";

// One <Route> per page in src/pages; BrowserRouter already wraps this in main.tsx.
export default function App() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/siswa" element={<AdminOnly><Siswa /></AdminOnly>} />
          <Route path="/invoice" element={<AdminOnly><Invoice /></AdminOnly>} />
          <Route path="/tentor" element={<AdminOnly><Tentor /></AdminOnly>} />
          <Route path="/payroll" element={<AdminOnly><Payroll /></AdminOnly>} />
          <Route path="/pengaturan" element={<AdminOnly><Pengaturan /></AdminOnly>} />
          <Route path="/jadwal" element={<Jadwal />} />
          <Route path="/jurnal" element={<Jurnal />} />
          <Route path="/laporan" element={<Laporan />} />
          <Route path="/rapor" element={<Rapor />} />
        </Route>
        <Route path="/cetak/invoice/:id" element={<PrintInvoice />} />
        <Route path="/cetak/payroll" element={<PrintPayroll />} />
        <Route path="/cetak/laporan/:id" element={<PrintLaporan />} />
        <Route path="/cetak/rapor/:id" element={<PrintRapor />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster richColors />
    </>
  );
}

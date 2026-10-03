"use client";

import { useEffect, useState, useCallback } from "react";
import { AttendanceCard } from "@/components/attendance/AttendanceCard";
import { api } from "@/lib/client/api";
import type { AttendanceRecord, Shift } from "@/lib/types";

export default function DashboardPage() {
  const [attendance, setAttendance] = useState<AttendanceRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadToday = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    const res = await api<{ attendance: AttendanceRecord | null }>("/api/attendance/today");
    if (!res.success) setErrorMessage(res.error?.message ?? "Gagal memuat data.");
    else setAttendance(res.data?.attendance ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadToday();
  }, [loadToday]);

  async function act(
    kind: "check-in" | "check-out",
    method: "SELFIE" | "BIOMETRIC" | "MANUAL" = "MANUAL",
    data?: { photoPath: string; latitude: number | null; longitude: number | null },
    shift?: Shift
  ) {
    setActionLoading(true);
    setErrorMessage(null);
    const body: Record<string, unknown> = { method };
    if (shift) body.shift = shift;
    if (data) {
      body.photoPath = data.photoPath;
      body.latitude = data.latitude;
      body.longitude = data.longitude;
    }
    const res = await api<{ attendance: AttendanceRecord }>(`/api/attendance/${kind}`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (!res.success) {
      setErrorMessage(res.error?.message ?? "Aksi gagal.");
      // Status server mungkin sudah berubah (mis. sudah absen di perangkat lain) — sinkronkan.
      if (res.error?.code?.startsWith("ATTENDANCE_")) await loadToday();
    } else if (res.data) {
      setAttendance(res.data.attendance);
    }
    setActionLoading(false);
  }

  return (
    <main>
      <h1 className="text-xl font-semibold">Absensi Hari Ini</h1>
      {errorMessage && (
        <div role="alert" className="alert-error mt-4">{errorMessage}</div>
      )}
      <div className="mt-6">
        <AttendanceCard
          loading={loading}
          actionLoading={actionLoading}
          attendance={attendance}
          onCheckIn={(method, shift, data) => act("check-in", method, data, shift)}
          onCheckOut={(method, data) => act("check-out", method, data)}
        />
      </div>
    </main>
  );
}
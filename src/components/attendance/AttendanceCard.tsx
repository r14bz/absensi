"use client";

import dynamic from "next/dynamic";
import { memo, useEffect, useState } from "react";
import { formatMinutesAsHoursLabel } from "@/lib/attendance/calculations";
import { APP_TIMEZONE, formatLocalTime } from "@/lib/timezone";
import { SHIFTS, SHIFT_LABEL, type Shift } from "@/lib/types";

// Komponen berat (kamera/GPS/WebAuthn) baru diunduh saat benar-benar dibuka.
const SelfieCapture = dynamic(() => import("@/components/attendance/SelfieCapture"), {
  ssr: false,
  loading: () => <div className="card p-6 text-center text-sm text-gray-500">Memuat kamera…</div>,
});
const BiometricAuth = dynamic(
  () => import("@/components/attendance/BiometricAuth").then((m) => m.BiometricAuth),
  { ssr: false, loading: () => <div className="card p-6 text-center text-sm text-gray-500">Memuat…</div> }
);

interface AttendanceRecord {
  check_in_at: string | null;
  check_out_at: string | null;
  net_work_minutes: number;
  overtime_minutes: number;
  status: string;
  shift?: Shift | null;
}

type CaptureData = { photoPath: string; latitude: number | null; longitude: number | null };

interface Props {
  loading: boolean;
  actionLoading: boolean;
  attendance: AttendanceRecord | null;
  onCheckIn: (method: "SELFIE" | "BIOMETRIC" | "MANUAL", shift: Shift, data?: CaptureData) => void;
  onCheckOut: (method: "SELFIE" | "BIOMETRIC" | "MANUAL", data?: CaptureData) => void;
}

type Method = "SELFIE" | "BIOMETRIC" | "MANUAL";

/**
 * Jam berjalan dipisah jadi komponen sendiri: re-render tiap detik HANYA
 * menyentuh dua baris teks ini, bukan seluruh kartu & overlay.
 * State awal null agar tidak terjadi hydration mismatch SSR vs client.
 */
const Clock = memo(function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <>
      <p className="text-sm text-gray-500 dark:text-gray-400" suppressHydrationWarning>
        {now
          ? now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: APP_TIMEZONE })
          : "\u00a0"}
      </p>
      <p className="mt-1 font-mono text-4xl font-semibold tabular-nums" aria-live="off" suppressHydrationWarning>
        {now ? now.toLocaleTimeString("id-ID", { timeZone: APP_TIMEZONE, hour12: false }) : "--.--.--"}
      </p>
    </>
  );
});

function MethodSelector({
  title,
  onSelect,
  onCancel,
  disabled,
  askShift,
  shift,
  onShiftChange,
}: {
  title: string;
  onSelect: (method: Method) => void;
  onCancel: () => void;
  disabled?: boolean;
  /** true hanya untuk absen masuk: wajib pilih kategori shift. */
  askShift: boolean;
  shift: Shift | null;
  onShiftChange: (s: Shift) => void;
}) {
  const blocked = disabled || (askShift && !shift);
  return (
    <div className="card w-full max-w-md p-4 space-y-4" role="dialog" aria-modal="true" aria-labelledby="method-title" onClick={(e) => e.stopPropagation()}>
      <h3 id="method-title" className="text-lg font-semibold">{title}</h3>
      {askShift && (
        <div>
          <p className="mb-2 text-sm font-medium">Pilih shift</p>
          <div role="radiogroup" aria-label="Kategori shift" className="grid grid-cols-3 gap-2">
            {SHIFTS.map((sh) => (
              <button
                key={sh}
                type="button"
                role="radio"
                aria-checked={shift === sh}
                onClick={() => onShiftChange(sh)}
                className={
                  "rounded-xl border px-3 py-3 text-sm font-semibold transition " +
                  (shift === sh
                    ? "border-brand-600 bg-brand-600 text-white"
                    : "border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800")
                }
              >
                {SHIFT_LABEL[sh]}
              </button>
            ))}
          </div>
          {!shift && <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">Pilih shift dulu untuk melanjutkan.</p>}
        </div>
      )}
      <p className="text-sm text-gray-500 dark:text-gray-400">Pilih metode absensi</p>
      <div className="grid gap-2">
        <button
          type="button"
          onClick={() => onSelect("SELFIE")}
          disabled={blocked}
          className="btn-primary text-left justify-start gap-3 !min-h-[52px]"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span>Selfie + GPS</span>
        </button>
        <button
          type="button"
          onClick={() => onSelect("BIOMETRIC")}
          disabled={blocked}
          className="btn-primary text-left justify-start gap-3 !min-h-[52px]"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <span>Biometrik (Face ID / Touch ID / Windows Hello)</span>
        </button>
        <button
          type="button"
          onClick={() => onSelect("MANUAL")}
          disabled={blocked}
          className="btn-ghost text-left justify-start gap-3 !min-h-[52px]"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <span>Manual (tanpa verifikasi)</span>
        </button>
      </div>
      <button type="button" onClick={onCancel} className="btn-ghost w-full">
        Batal
      </button>
    </div>
  );
}

type Flow = { action: "check-in" | "check-out"; step: "method" | "selfie" | "biometric"; shift: Shift | null };

export function AttendanceCard({ loading, actionLoading, attendance, onCheckIn, onCheckOut }: Props) {
  const hasCheckedIn = Boolean(attendance?.check_in_at);
  const hasCheckedOut = Boolean(attendance?.check_out_at);
  // Satu state alur: aksi (masuk/pulang) tidak hilang saat berpindah langkah.
  const [flow, setFlow] = useState<Flow | null>(null);

  if (loading) {
    return (
      <div className="card animate-pulse" aria-label="Memuat data absensi">
        <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="mt-4 h-8 w-40 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="mt-6 h-12 w-full rounded-xl bg-gray-200 dark:bg-gray-700" />
      </div>
    );
  }

  const close = () => setFlow(null);

  const finish = (method: Method, data?: CaptureData) => {
    if (!flow) return;
    if (flow.action === "check-in") {
      if (!flow.shift) return;
      onCheckIn(method, flow.shift, data);
    } else {
      onCheckOut(method, data);
    }
    close();
  };

  const handleMethodSelect = (method: Method) => {
    if (!flow) return;
    if (method === "SELFIE") setFlow({ ...flow, step: "selfie" });
    else if (method === "BIOMETRIC") setFlow({ ...flow, step: "biometric" });
    else finish("MANUAL");
  };

  const renderOverlay = () => {
    if (!flow) return null;
    let content: React.ReactNode;
    if (flow.step === "method") {
      content = (
        <MethodSelector
          title={flow.action === "check-in" ? "Absen Masuk" : "Absen Pulang"}
          onSelect={handleMethodSelect}
          onCancel={close}
          disabled={actionLoading}
          askShift={flow.action === "check-in"}
          shift={flow.shift}
          onShiftChange={(shift) => setFlow({ ...flow, shift })}
        />
      );
    } else if (flow.step === "selfie") {
      content = (
        <div className="w-full max-w-md">
          <SelfieCapture
            method="SELFIE"
            onCapture={(data) => finish("SELFIE", data)}
            onCancel={close}
            isLoading={actionLoading}
          />
        </div>
      );
    } else {
      content = (
        <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
          <BiometricAuth
            mode="authenticate"
            onSuccess={() => finish("BIOMETRIC")}
            onCancel={close}
            onError={(err) => console.error(err)}
          />
        </div>
      );
    }
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4"
        onClick={(e) => e.target === e.currentTarget && close()}
      >
        {content}
      </div>
    );
  };

  return (
    <>
      <div className="card p-6">
        <Clock />

        <p className="mt-3 text-sm font-medium text-gray-600 dark:text-gray-300">
          Status: {hasCheckedOut ? "Sudah pulang" : hasCheckedIn ? "Sudah masuk" : "Belum absen"}
        </p>

        {hasCheckedIn && (
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-gray-500 dark:text-gray-400">Jam masuk</dt>
              <dd className="font-medium">{formatLocalTime(attendance!.check_in_at)}</dd>
            </div>
            <div>
              <dt className="text-gray-500 dark:text-gray-400">Shift</dt>
              <dd className="font-medium">{attendance!.shift ? SHIFT_LABEL[attendance!.shift] : "—"}</dd>
            </div>
            <div>
              <dt className="text-gray-500 dark:text-gray-400">Jam pulang</dt>
              <dd className="font-medium">{formatLocalTime(attendance!.check_out_at)}</dd>
            </div>
            {hasCheckedOut && (
              <>
                <div>
                  <dt className="text-gray-500 dark:text-gray-400">Jam kerja</dt>
                  <dd className="font-medium">{formatMinutesAsHoursLabel(attendance!.net_work_minutes)}</dd>
                </div>
                <div>
                  <dt className="text-gray-500 dark:text-gray-400">Lembur</dt>
                  <dd className="font-medium">{Math.floor(attendance!.overtime_minutes / 60)} jam</dd>
                </div>
              </>
            )}
          </dl>
        )}

        <button
          type="button"
          onClick={() => setFlow({ action: hasCheckedIn ? "check-out" : "check-in", step: "method", shift: null })}
          disabled={actionLoading || hasCheckedOut}
          className="btn-primary mt-6 w-full !min-h-[52px] text-base"
        >
          {actionLoading ? "Memproses..." : hasCheckedOut ? "Absensi selesai" : hasCheckedIn ? "ABSEN PULANG" : "ABSEN MASUK"}
        </button>
      </div>
      {renderOverlay()}
    </>
  );
}
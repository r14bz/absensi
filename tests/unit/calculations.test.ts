import { describe, it, expect } from "vitest";
import {
  calculateGrossWorkMinutes,
  calculateNetWorkMinutes,
  calculateOvertimeMinutes,
  calculateAttendance,
  resolveAttendanceStatus,
  DEFAULT_WORK_SETTINGS,
} from "../../src/lib/attendance/calculations";

function jakartaTime(hh: number, mm: number, dateStr = "2026-09-28") {
  // Asia/Jakarta = UTC+7 tanpa DST -> instant UTC eksplisit.
  const [y, m, d] = dateStr.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d, hh - 7, mm));
}

describe("calculateGrossWorkMinutes", () => {
  it("computes simple 9-hour shift", () => {
    const checkIn = jakartaTime(8, 0);
    const checkOut = jakartaTime(17, 0);
    expect(calculateGrossWorkMinutes(checkIn, checkOut)).toBe(540);
  });

  it("throws on negative range (check-out before check-in)", () => {
    const checkIn = jakartaTime(17, 0);
    const checkOut = jakartaTime(8, 0);
    expect(() => calculateGrossWorkMinutes(checkIn, checkOut)).toThrow(
      /INVALID_TIME_RANGE/
    );
  });
});

describe("calculateNetWorkMinutes", () => {
  it("subtracts break minutes", () => {
    expect(calculateNetWorkMinutes(540, 60)).toBe(480);
  });

  it("never goes below zero", () => {
    expect(calculateNetWorkMinutes(30, 60)).toBe(0);
  });
});

describe("calculateOvertimeMinutes — rounding per jam penuh", () => {
  const base = { standardWorkMinutes: 480, roundingMinutes: 60 };

  it("30 menit lembur => 0 jam", () => {
    expect(calculateOvertimeMinutes({ netWorkMinutes: 510, ...base })).toBe(0);
  });

  it("59 menit lembur => 0 jam", () => {
    expect(calculateOvertimeMinutes({ netWorkMinutes: 539, ...base })).toBe(0);
  });

  it("60 menit lembur => 1 jam", () => {
    expect(calculateOvertimeMinutes({ netWorkMinutes: 540, ...base })).toBe(
      60
    );
  });

  it("119 menit lembur => 1 jam", () => {
    expect(calculateOvertimeMinutes({ netWorkMinutes: 599, ...base })).toBe(
      60
    );
  });

  it("120 menit lembur => 2 jam", () => {
    expect(calculateOvertimeMinutes({ netWorkMinutes: 600, ...base })).toBe(
      120
    );
  });

  it("180 menit lembur => 3 jam", () => {
    expect(calculateOvertimeMinutes({ netWorkMinutes: 660, ...base })).toBe(
      180
    );
  });

  it("net di bawah standar => 0 (tidak negatif)", () => {
    expect(calculateOvertimeMinutes({ netWorkMinutes: 400, ...base })).toBe(
      0
    );
  });
});

describe("calculateAttendance — kasus end-to-end dari spesifikasi", () => {
  it("08:00 -> 17:00 => 8 jam kerja, 0 jam lembur", () => {
    const result = calculateAttendance({
      checkInAt: jakartaTime(8, 0),
      checkOutAt: jakartaTime(17, 0),
      settings: DEFAULT_WORK_SETTINGS,
    });
    expect(result.netWorkMinutes).toBe(480);
    expect(result.overtimeHours).toBe(0);
  });

  it("08:00 -> 18:00 => 9 jam kerja, 1 jam lembur", () => {
    const result = calculateAttendance({
      checkInAt: jakartaTime(8, 0),
      checkOutAt: jakartaTime(18, 0),
      settings: DEFAULT_WORK_SETTINGS,
    });
    expect(result.netWorkMinutes).toBe(540);
    expect(result.overtimeHours).toBe(1);
  });

  it("08:00 -> 18:59 => 9j59m kerja, 1 jam lembur", () => {
    const result = calculateAttendance({
      checkInAt: jakartaTime(8, 0),
      checkOutAt: jakartaTime(18, 59),
      settings: DEFAULT_WORK_SETTINGS,
    });
    expect(result.netWorkMinutes).toBe(599);
    expect(result.overtimeHours).toBe(1);
  });

  it("08:00 -> 19:00 => 10 jam kerja, 2 jam lembur", () => {
    const result = calculateAttendance({
      checkInAt: jakartaTime(8, 0),
      checkOutAt: jakartaTime(19, 0),
      settings: DEFAULT_WORK_SETTINGS,
    });
    expect(result.netWorkMinutes).toBe(600);
    expect(result.overtimeHours).toBe(2);
  });

  it("08:00 -> 18:30 => contoh soal (9j30m net, 1 jam lembur diakui)", () => {
    const result = calculateAttendance({
      checkInAt: jakartaTime(8, 0),
      checkOutAt: jakartaTime(18, 30),
      settings: DEFAULT_WORK_SETTINGS,
    });
    expect(result.grossWorkMinutes).toBe(630); // 10j30m
    expect(result.netWorkMinutes).toBe(570); // 9j30m
    expect(result.overtimeMinutes).toBe(60); // 1 jam diakui, bukan 1.5
    expect(result.overtimeHours).toBe(1);
  });
});

describe("resolveAttendanceStatus — prioritas yang jelas, tidak menebak", () => {
  it("holiday selalu menang meski ada check-in", () => {
    expect(
      resolveAttendanceStatus({
        isHoliday: true,
        isConfiguredDayOff: false,
        approvedLeaveType: null,
        hasCheckIn: true,
      })
    ).toBe("HOLIDAY");
  });

  it("sick leave yang disetujui", () => {
    expect(
      resolveAttendanceStatus({
        isHoliday: false,
        isConfiguredDayOff: false,
        approvedLeaveType: "SICK",
        hasCheckIn: false,
      })
    ).toBe("SICK");
  });

  it("izin biasa (bukan sakit)", () => {
    expect(
      resolveAttendanceStatus({
        isHoliday: false,
        isConfiguredDayOff: false,
        approvedLeaveType: "PERMISSION",
        hasCheckIn: false,
      })
    ).toBe("PERMISSION");
  });

  it("akhir pekan terkonfigurasi tanpa check-in => DAY_OFF, bukan ABSENT", () => {
    expect(
      resolveAttendanceStatus({
        isHoliday: false,
        isConfiguredDayOff: true,
        approvedLeaveType: null,
        hasCheckIn: false,
      })
    ).toBe("DAY_OFF");
  });

  it("hari kerja biasa tanpa aktivitas apa pun => ABSENT (tidak diasumsikan libur)", () => {
    expect(
      resolveAttendanceStatus({
        isHoliday: false,
        isConfiguredDayOff: false,
        approvedLeaveType: null,
        hasCheckIn: false,
      })
    ).toBe("ABSENT");
  });

  it("ada check-in di hari kerja biasa => PRESENT", () => {
    expect(
      resolveAttendanceStatus({
        isHoliday: false,
        isConfiguredDayOff: false,
        approvedLeaveType: null,
        hasCheckIn: true,
      })
    ).toBe("PRESENT");
  });
});

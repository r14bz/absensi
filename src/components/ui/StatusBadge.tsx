import { STATUS_LABEL, type Status } from "@/lib/types";

const COLOR: Record<Status, string> = {
  PRESENT: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  ABSENT: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  PERMISSION: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  SICK: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  HOLIDAY: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200",
  DAY_OFF: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
};

export function StatusBadge({ status }: { status: Status | null }) {
  if (!status) return <span className="text-gray-400">—</span>;
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${COLOR[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

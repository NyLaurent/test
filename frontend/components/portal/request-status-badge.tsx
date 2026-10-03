import type { RequestStatus } from "@/lib/types";

const statusStyles: Record<RequestStatus, string> = {
  submitted: "bg-slate-100 text-slate-700",
  in_progress: "bg-amber-100 text-amber-800",
  delivered: "bg-sky-100 text-sky-800",
  accepted: "bg-emerald-100 text-emerald-800",
  rejected: "bg-rose-100 text-rose-800",
};

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusStyles[status]}`}>
      {status.replace("_", " ")}
    </span>
  );
}

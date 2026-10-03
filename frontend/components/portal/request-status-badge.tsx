import type { RequestStatus } from "@/lib/types";

const statusStyles: Record<RequestStatus, string> = {
  submitted: "status-badge--submitted",
  in_progress: "status-badge--in-progress",
  delivered: "status-badge--delivered",
  accepted: "status-badge--accepted",
  rejected: "status-badge--rejected",
};

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  return (
    <span className={`status-badge inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusStyles[status]}`}>
      {status.replace("_", " ")}
    </span>
  );
}

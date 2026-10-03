"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { ReactNode } from "react";
import {
  Activity,
  Archive,
  Building2,
  CheckCheck,
  Clock3,
  Eye,
  FilePlus2,
  Files,
  FileUp,
  Filter,
  Pencil,
  Plus,
  Trash2,
  Timer,
  Users,
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import {
  DailyEpisodesChart,
  MetricCard,
  RequestStatusChart,
  RequestWorkflowChart,
} from "@/components/portal/dashboard-widgets";
import { RequestStatusBadge } from "@/components/portal/request-status-badge";
import { useToast } from "@/components/toast/toast-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { Dialog } from "@/components/ui/dialog";
import {
  assignEpisodesToRequest,
  createRequest,
  createAdminUser,
  deleteRequest,
  editRequest,
  getAnalytics,
  getAdminUsers,
  getEpisodePage,
  getEpisodes,
  getRequestEpisodes,
  getRequestHistory,
  getRequests,
  importEpisodes,
  updateAdminUser,
  updateRequestStatus,
} from "@/lib/api";
import type {
  AnalyticsResponse,
  Episode,
  EpisodeImportSummary,
  RequestRecord,
  RequestStatus,
  StatusHistoryEntry,
  User,
  UserRole,
} from "@/lib/types";

export type PortalPageSection = "overview" | "requests" | "new-request" | "episodes" | "analytics" | "profile" | "users";

const nextStatuses: Partial<Record<RequestStatus, RequestStatus>> = {
  submitted: "in_progress",
  in_progress: "delivered",
  rejected: "in_progress",
};

export function PortalRoutePage({ section }: { section: PortalPageSection }) {
  const { user } = useAuth();
  if (!user) return null;

  if (section === "profile") return <ProfilePage />;
  if (section === "users") return user.role === "admin" ? <AdminUsersPage /> : <UnavailablePage title="User management" />;
  if (section === "new-request") return user.role === "client" ? <NewRequestPage /> : <UnavailablePage title="New dataset request" />;
  if (section === "requests") return user.role === "client" ? <ClientRequestsPage /> : <OperatorRequestsPage />;
  if (section === "episodes") return user.role === "client" ? <UnavailablePage title="Episode inventory" /> : <EpisodesPage />;
  if (section === "analytics") return user.role === "client" ? <UnavailablePage title="Analytics" /> : <AnalyticsPage />;
  return user.role === "client" ? <ClientOverview /> : <OperatorOverview />;
}

function useWorkspaceData(options: { requests?: boolean; episodes?: boolean; availableEpisodesOnly?: boolean; analytics?: boolean }) {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [requests, setRequests] = useState<RequestRecord[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    const [requestData, episodeData, analyticsData] = await Promise.all([
      options.requests ? getRequests(token) : Promise.resolve(null),
      options.episodes ? getEpisodes(token, { availableOnly: options.availableEpisodesOnly }) : Promise.resolve(null),
      options.analytics ? getAnalytics(token) : Promise.resolve(null),
    ]);
    if (requestData) setRequests(requestData);
    if (episodeData) setEpisodes(episodeData);
    if (analyticsData) setAnalytics(analyticsData);
  }, [options.analytics, options.availableEpisodesOnly, options.episodes, options.requests, token]);

  useEffect(() => {
    // Loading API data in this effect is intentional.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
      .catch((cause: unknown) => {
        showToast({
          kind: "error",
          title: "Could not load workspace data",
          description: cause instanceof Error ? cause.message : "Please try again.",
        });
      })
      .finally(() => setIsLoading(false));
  }, [load, showToast]);

  return { analytics, episodes, isLoading, load, requests, setRequests };
}

function ClientOverview() {
  const { user } = useAuth();
  const { requests, isLoading, load } = useWorkspaceData({ requests: true });
  const [createOpen, setCreateOpen] = useState(false);
  const counts = getRequestCounts(requests);
  const activeCount = counts.submitted + counts.in_progress + counts.rejected;

  return (
    <div className="space-y-7">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-brand-blue/15 bg-brand-soft-blue px-3 py-1.5 text-xs font-semibold text-brand-blue">
            <Building2 aria-hidden="true" size={14} />
            Dataset Request Desk
          </span>
          <h1 className="text-2xl font-semibold tracking-tight text-brand-navy sm:text-3xl">Overview</h1>
          <p className="mt-2 text-sm text-muted-text">
            Welcome back{user?.full_name ? `, ${user.full_name}` : ""}. Track your requests and deliveries.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-blue px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-blue-hover"
        >
          <Plus aria-hidden="true" size={17} />
          New request
        </button>
      </section>
      {isLoading ? (
        <ClientOverviewSkeleton />
      ) : (
        <>
          <motion.section
            aria-label="Request summary"
            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.07 } },
            }}
          >
            <MetricCard label="Total requests" value={requests.length} detail="All requests you've submitted" icon={Files} tone="blue" />
            <MetricCard label="In progress" value={activeCount} detail="Being handled by operations" icon={Clock3} tone="orange" />
            <MetricCard label="Awaiting review" value={counts.delivered} detail="Delivered and ready for your review" icon={FilePlus2} tone="purple" />
            <MetricCard label="Accepted" value={counts.accepted} detail="Completed requests" icon={CheckCheck} tone="green" />
          </motion.section>
          <motion.div
            className="grid min-w-0 items-start gap-5 xl:grid-cols-2"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.12 }}
          >
            <RequestStatusChart data={statusChartData(counts)} />
            <RequestWorkflowChart data={statusChartData(counts)} />
          </motion.div>
        </>
      )}
      {createOpen ? (
        <RequestFormDialog
          open
          mode="create"
          onClose={() => setCreateOpen(false)}
          onSaved={async () => {
            setCreateOpen(false);
            try {
              await load();
            } catch {
              // Creation succeeded; the refreshed view can be loaded on the next page visit.
            }
          }}
        />
      ) : null}
      <p className="text-xs text-muted-text">
        Signed in as <span className="font-medium text-body-text">{user?.full_name || user?.email}</span>
      </p>
    </div>
  );
}

function OperatorOverview() {
  const { user } = useAuth();
  const { requests, episodes, analytics, isLoading } = useWorkspaceData({
    requests: true,
    episodes: true,
    analytics: true,
  });
  const openRequests = requests.filter((request) => ["submitted", "in_progress", "rejected"].includes(request.status)).length;
  const eligibleEpisodes = episodes.filter((episode) => episode.quality === "good" || episode.quality === "usable").length;

  return (
    <div className="space-y-7">
      <PageHeading
        eyebrow={`${user?.role} workspace`}
        title="Operations overview"
        description="Request flow, episode availability, and collection activity."
      />
      <section aria-label="Operations summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total requests" value={isLoading ? "—" : requests.length} detail="Across all clients" icon={Files} tone="blue" />
        <MetricCard label="Needs attention" value={isLoading ? "—" : openRequests} detail="Submitted or in progress" icon={Activity} tone="orange" />
        <MetricCard label="Assignable episodes" value={isLoading ? "—" : eligibleEpisodes} detail="Good or usable quality" icon={Archive} tone="green" />
        <MetricCard label="Median delivery" value={formatDuration(analytics?.median_delivery_seconds ?? null)} detail="Submitted to delivered" icon={Timer} tone="purple" />
      </section>
      <section aria-label="Operations analytics" className="grid gap-5 xl:grid-cols-[1.45fr_1fr]">
        <DailyEpisodesChart analytics={analytics} />
        <RequestStatusChart data={analytics?.request_fulfilment ?? []} />
      </section>
      <Link href={`/${user?.role}/requests`} className="inline-flex rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-body-text hover:bg-surface">
        Open request queue
      </Link>
    </div>
  );
}

function ClientRequestsPage() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const data = useWorkspaceData({ requests: true });
  const [createOpen, setCreateOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState<RequestRecord | null>(null);
  const [viewingRequest, setViewingRequest] = useState<RequestRecord | null>(null);
  const [reviewAction, setReviewAction] = useState<{
    request: RequestRecord;
    status: "accepted" | "rejected";
  } | null>(null);
  const [rejectionNote, setRejectionNote] = useState("");
  const [isReviewing, setIsReviewing] = useState(false);
  const [deletingRequest, setDeletingRequest] = useState<RequestRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function reviewRequest(request: RequestRecord, status: "accepted" | "rejected", note?: string) {
    if (!token) return;
    setIsReviewing(true);
    try {
      await updateRequestStatus(request.id, status, token, note);
      setReviewAction(null);
      setRejectionNote("");
      showToast({
        kind: "success",
        title: status === "accepted" ? "Delivery accepted" : "Changes requested",
        description: status === "accepted" ? "This dataset delivery has been accepted." : "Your note was sent to the operations team.",
      });
      try {
        await data.load();
      } catch {
        showToast({
          kind: "info",
          title: "Status saved",
          description: "The request history could not refresh. Reload to see the latest status.",
        });
      }
    } catch (cause) {
      showToast({
        kind: "error",
        title: "Could not update request",
        description: cause instanceof Error ? cause.message : "Please try again.",
      });
    } finally {
      setIsReviewing(false);
    }
  }

  async function removeRequest() {
    if (!token || !deletingRequest) return;
    setIsDeleting(true);
    try {
      await deleteRequest(deletingRequest.id, token);
      showToast({
        kind: "success",
        title: "Request deleted",
        description: `Request #${deletingRequest.id} was removed.`,
      });
      setDeletingRequest(null);
      try {
        await data.load();
      } catch {
        showToast({
          kind: "info",
          title: "Request deleted",
          description: "The list could not refresh. Reload to see the latest requests.",
        });
      }
    } catch (cause) {
      showToast({
        kind: "error",
        title: "Could not delete request",
        description: cause instanceof Error ? cause.message : "Please try again.",
      });
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <PageHeading eyebrow="Dataset Request Desk · Client workspace" title="My requests" description="Review status and respond to delivered datasets." />
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-blue px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-blue-hover"
        >
          <Plus aria-hidden="true" size={17} />
          New request
        </button>
      </section>
      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div><CardTitle>Request history</CardTitle><CardDescription>Your submitted dataset requests.</CardDescription></div>
          <span className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-text">
            {data.isLoading ? "Loading…" : `${data.requests.length} total`}
          </span>
        </CardHeader>
        {data.isLoading ? (
          <RequestTableSkeleton />
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="bg-page-background text-xs font-medium uppercase tracking-wide text-muted-text">
              <tr><th className="px-5 py-3">Task</th><th className="px-5 py-3">Episodes</th><th className="px-5 py-3">Deadline</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.requests.map((request) => (
                <tr key={request.id}>
                  <td className="max-w-[260px] px-5 py-4"><p className="truncate font-medium text-brand-navy">{request.task_name}</p><p className="mt-1 text-xs text-muted-text">Request #{request.id}</p></td>
                  <td className="px-5 py-4 tabular-nums text-body-text">{request.episodes_requested}</td>
                  <td className="px-5 py-4 text-body-text">{displayDate(request.deadline)}</td>
                  <td className="px-5 py-4"><RequestStatusBadge status={request.status} /></td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <button type="button" aria-label={`View request ${request.id}`} onClick={() => setViewingRequest(request)} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1.5 text-xs font-medium text-body-text hover:bg-page-background">
                        <Eye aria-hidden="true" size={14} />View
                      </button>
                      {request.status === "submitted" ? (
                        <>
                          <button type="button" aria-label={`Edit request ${request.id}`} onClick={() => setEditingRequest(request)} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1.5 text-xs font-medium text-body-text hover:bg-page-background">
                            <Pencil aria-hidden="true" size={14} />Edit
                          </button>
                          <button type="button" aria-label={`Delete request ${request.id}`} onClick={() => setDeletingRequest(request)} className="inline-flex items-center gap-1 rounded-md border border-status-bad/25 px-2 py-1.5 text-xs font-medium text-status-bad hover:bg-status-bad/5">
                            <Trash2 aria-hidden="true" size={14} />Delete
                          </button>
                        </>
                      ) : null}
                      {request.status === "delivered" ? (
                        <>
                          <button type="button" onClick={() => setReviewAction({ request, status: "accepted" })} className="rounded-md bg-status-good px-2.5 py-1.5 text-xs font-medium text-white hover:brightness-95">Accept</button>
                          <button type="button" onClick={() => { setRejectionNote(""); setReviewAction({ request, status: "rejected" }); }} className="rounded-md border border-status-bad/30 px-2.5 py-1.5 text-xs font-medium text-status-bad hover:bg-status-bad/5">Request changes</button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.requests.length === 0 ? <EmptyMessage icon={<Files size={24} />} title="No requests yet" detail="Your new requests will appear here." /> : null}
        </div>
        )}
      </Card>
      {createOpen ? (
        <RequestFormDialog open mode="create" onClose={() => setCreateOpen(false)} onSaved={async () => {
          setCreateOpen(false);
          await data.load();
        }} />
      ) : null}
      {editingRequest ? (
        <RequestFormDialog
          key={`edit-${editingRequest.id}`}
          open
          mode="edit"
          request={editingRequest}
          onClose={() => setEditingRequest(null)}
          onSaved={async () => {
            setEditingRequest(null);
            await data.load();
          }}
        />
      ) : null}
      {viewingRequest ? <ClientRequestDetailsDialog key={viewingRequest.id} request={viewingRequest} token={token} onClose={() => setViewingRequest(null)} /> : null}
      <ConfirmationModal
        open={Boolean(reviewAction)}
        title={reviewAction?.status === "accepted" ? "Accept this delivery?" : "Request changes to this delivery?"}
        description={reviewAction?.status === "accepted"
          ? `Are you sure you want to accept the delivery for “${reviewAction.request.task_name}”?`
          : `Are you sure you want to reject the delivery for “${reviewAction?.request.task_name ?? "this request"}”? Your note will be shared with the operations team.`}
        confirmLabel={reviewAction?.status === "accepted" ? "Accept delivery" : "Send feedback"}
        onConfirm={() => {
          if (!reviewAction) return;
          void reviewRequest(
            reviewAction.request,
            reviewAction.status,
            reviewAction.status === "rejected" ? rejectionNote.trim() : undefined,
          );
        }}
        onCancel={() => {
          if (!isReviewing) setReviewAction(null);
        }}
        isDestructive={reviewAction?.status === "rejected"}
        isPending={isReviewing}
        confirmDisabled={reviewAction?.status === "rejected" && !rejectionNote.trim()}
      >
        {reviewAction?.status === "rejected" ? (
          <label className="mt-4 block text-sm font-medium text-body-text">
            What needs to change, and why?
            <textarea
              required
              autoFocus
              maxLength={10_000}
              rows={4}
              value={rejectionNote}
              onChange={(event) => setRejectionNote(event.target.value)}
              placeholder="Describe the issue with this delivery so the team can address it."
              className="mt-2 w-full resize-y rounded-lg border border-border bg-surface px-3 py-2.5 text-sm font-normal outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/10"
            />
            <span className="mt-1 block text-xs font-normal text-muted-text">This feedback will be saved with the request history.</span>
          </label>
        ) : null}
      </ConfirmationModal>
      <ConfirmationModal
        open={Boolean(deletingRequest)}
        title="Delete this request?"
        description={deletingRequest ? `Request #${deletingRequest.id} “${deletingRequest.task_name}” will be permanently deleted. This action cannot be undone.` : ""}
        confirmLabel="Delete request"
        onConfirm={() => void removeRequest()}
        onCancel={() => {
          if (!isDeleting) setDeletingRequest(null);
        }}
        isDestructive
        isPending={isDeleting}
      />
    </div>
  );
}

function ClientOverviewSkeleton() {
  return (
    <div className="space-y-5" aria-label="Loading overview" role="status">
      <span className="sr-only">Loading your request overview…</span>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <motion.div
            key={index}
            className="h-32 animate-pulse rounded-xl border border-border bg-surface"
            initial={{ opacity: 0.4 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, repeat: Infinity, repeatType: "reverse", delay: index * 0.08 }}
          />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <div className="h-[340px] animate-pulse rounded-xl border border-border bg-surface" />
        <div className="h-[340px] animate-pulse rounded-xl border border-border bg-surface" />
      </div>
    </div>
  );
}

function RequestTableSkeleton() {
  return (
    <div className="space-y-4 p-5" role="status" aria-label="Loading requests">
      <span className="sr-only">Loading your requests…</span>
      {Array.from({ length: 5 }, (_, index) => (
        <motion.div
          key={index}
          className="grid grid-cols-[minmax(100px,1.5fr)_0.7fr_0.8fr_0.8fr_1.4fr] items-center gap-4"
          initial={{ opacity: 0.45 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.65, repeat: Infinity, repeatType: "reverse", delay: index * 0.06 }}
        >
          <span className="h-4 rounded bg-border/70" />
          <span className="h-4 rounded bg-border/70" />
          <span className="h-4 rounded bg-border/70" />
          <span className="h-6 w-20 rounded-full bg-border/70" />
          <span className="h-8 rounded bg-border/70" />
        </motion.div>
      ))}
    </div>
  );
}

function RequestFormDialog({
  open,
  mode,
  request,
  onClose,
  onSaved,
}: {
  open: boolean;
  mode: "create" | "edit";
  request?: RequestRecord;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const { token } = useAuth();
  const { showToast } = useToast();
  const formId = `request-form-${request?.id ?? "new"}`;
  const [taskName, setTaskName] = useState(request?.task_name ?? "");
  const [episodesRequested, setEpisodesRequested] = useState(request?.episodes_requested ?? 1);
  const [deadline, setDeadline] = useState(request?.deadline ?? "");
  const [notes, setNotes] = useState(request?.notes ?? "");
  const [isSaving, setIsSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setIsSaving(true);
    try {
      const input = {
        task_name: taskName.trim(),
        episodes_requested: episodesRequested,
        deadline: deadline || null,
        notes: notes.trim() || null,
      };
      if (mode === "edit" && request) {
        await editRequest(request.id, input, token);
        showToast({ kind: "success", title: "Request updated", description: `Request #${request.id} was updated.` });
      } else {
        await createRequest(input, token);
        showToast({ kind: "success", title: "Request submitted", description: "Your request is now in the operator queue." });
      }
      onClose();
      try {
        await onSaved();
      } catch {
        showToast({
          kind: "info",
          title: "Saved successfully",
          description: "Your request was saved, but the list could not refresh.",
        });
      }
    } catch (cause) {
      showToast({
        kind: "error",
        title: mode === "edit" ? "Could not update request" : "Could not submit request",
        description: cause instanceof Error ? cause.message : "Please check your details and try again.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      title={mode === "edit" ? "Edit dataset request" : "Create a dataset request"}
      description={mode === "edit" ? "You can edit a request until an operator begins work." : "Describe the data collection you need from the robotics team."}
      onClose={onClose}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={isSaving} className="min-h-10 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-body-text hover:bg-page-background disabled:opacity-60">Cancel</button>
          <button type="submit" form={formId} disabled={isSaving} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-blue-hover disabled:cursor-not-allowed disabled:opacity-60">
            <FilePlus2 aria-hidden="true" size={16} />
            {isSaving ? "Saving…" : mode === "edit" ? "Save changes" : "Submit request"}
          </button>
        </div>
      }
    >
      <form id={formId} onSubmit={submit} className="space-y-4">
        <label className="block text-sm font-medium text-body-text">
          Task name
          <input required maxLength={255} value={taskName} onChange={(event) => setTaskName(event.target.value)} placeholder="e.g. Pick up the red mug" className="mt-2 w-full rounded-lg border border-border bg-surface px-3 py-2.5 font-normal outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/10" />
        </label>
        <label className="block text-sm font-medium text-body-text">
          Episodes requested
          <input required type="number" min={1} value={episodesRequested} onChange={(event) => setEpisodesRequested(Math.max(1, Number(event.target.value)))} className="mt-2 w-full rounded-lg border border-border bg-surface px-3 py-2.5 font-normal outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/10" />
        </label>
        <label className="block text-sm font-medium text-body-text">
          Deadline <span className="font-normal text-muted-text">(optional)</span>
          <input type="date" value={deadline ?? ""} onChange={(event) => setDeadline(event.target.value)} className="mt-2 w-full rounded-lg border border-border bg-surface px-3 py-2.5 font-normal outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/10" />
        </label>
        <label className="block text-sm font-medium text-body-text">
          Notes <span className="font-normal text-muted-text">(optional)</span>
          <textarea rows={4} maxLength={10_000} value={notes ?? ""} onChange={(event) => setNotes(event.target.value)} placeholder="Add collection or quality requirements…" className="mt-2 w-full resize-y rounded-lg border border-border bg-surface px-3 py-2.5 font-normal outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/10" />
        </label>
      </form>
    </Dialog>
  );
}

function ClientRequestDetailsDialog({
  request,
  token,
  onClose,
}: {
  request: RequestRecord;
  token: string | null;
  onClose: () => void;
}) {
  const { showToast } = useToast();
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [history, setHistory] = useState<StatusHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const canViewEpisodes = ["delivered", "accepted", "rejected"].includes(request.status);

  useEffect(() => {
    let isActive = true;
    if (!token) return () => { isActive = false; };

    const episodesPromise = canViewEpisodes
      ? getRequestEpisodes(request.id, token)
      : Promise.resolve([] as Episode[]);
    void Promise.all([episodesPromise, getRequestHistory(request.id, token)])
      .then(([assigned, statusHistory]) => {
        if (!isActive) return;
        setEpisodes(assigned);
        setHistory(statusHistory);
      })
      .catch((cause: unknown) => {
        if (isActive) {
          showToast({
            kind: "error",
            title: "Could not load request details",
            description: cause instanceof Error ? cause.message : "Please try again.",
          });
        }
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => { isActive = false; };
  }, [canViewEpisodes, request.id, showToast, token]);

  const rejectionNotes = history.filter((entry) => entry.to_status === "rejected" && entry.note);

  return (
    <Dialog
      open
      title={request.task_name}
      description={`Request #${request.id} · delivery details`}
      onClose={onClose}
      footer={<div className="flex justify-end"><button type="button" onClick={onClose} className="min-h-10 rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:bg-brand-blue-hover">Close</button></div>}
    >
      <dl className="divide-y divide-border">
        <DetailRow label="Status"><RequestStatusBadge status={request.status} /></DetailRow>
        <DetailRow label="Episodes requested">{request.episodes_requested}</DetailRow>
        <DetailRow label="Deadline">{displayDate(request.deadline)}</DetailRow>
        <DetailRow label="Notes">{request.notes || "No notes provided."}</DetailRow>
      </dl>
      {rejectionNotes.length ? (
        <section className="mt-5 rounded-xl border border-status-bad/20 bg-status-bad/5 p-4">
          <h3 className="text-sm font-semibold text-brand-navy">Feedback on the delivery</h3>
          <ul className="mt-3 space-y-3">
            {rejectionNotes.map((entry) => (
              <li key={entry.id} className="text-sm leading-6 text-body-text">
                <p>{entry.note}</p>
                <p className="mt-1 text-xs text-muted-text">{formatDateTime(entry.changed_at)}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section className="mt-6">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-brand-navy">Delivered episodes</h3>
          <span className="text-xs text-muted-text">{canViewEpisodes ? episodes.length : "Available after delivery"}</span>
        </div>
        {isLoading ? <p className="mt-3 text-sm text-muted-text">Loading delivery details…</p> : null}
        {!isLoading && !canViewEpisodes ? (
          <p className="mt-3 rounded-lg bg-page-background px-3 py-3 text-sm text-muted-text">Episode details will appear here once the delivery is ready.</p>
        ) : null}
        {!isLoading && canViewEpisodes && episodes.length === 0 ? (
          <p className="mt-3 rounded-lg bg-page-background px-3 py-3 text-sm text-muted-text">No episode details are available for this delivery.</p>
        ) : null}
        {!isLoading && episodes.length ? (
          <ul className="mt-3 max-h-80 space-y-3 overflow-y-auto pr-1">
            {episodes.map((episode) => (
              <li key={episode.id} className="rounded-xl border border-border bg-surface p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-brand-navy">{episode.episode_id}</p>
                  <QualityBadge quality={episode.quality} />
                </div>
                <dl className="mt-3 grid gap-x-5 gap-y-2 text-sm sm:grid-cols-2">
                  <DetailRow label="Task">{episode.task_name}</DetailRow>
                  <DetailRow label="Robot">{episode.robot_id}</DetailRow>
                  <DetailRow label="Recorded">{formatDateTime(episode.recorded_at)}</DetailRow>
                  <DetailRow label="Duration">{formatEpisodeDuration(episode.duration_seconds)}</DetailRow>
                  <DetailRow label="Operator">{episode.operator_name}</DetailRow>
                </dl>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </Dialog>
  );
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return <div className="grid gap-2 py-3 sm:grid-cols-[10rem_minmax(0,1fr)]"><dt className="text-sm text-muted-text">{label}</dt><dd className="min-w-0 break-words text-sm font-medium text-brand-navy">{children}</dd></div>;
}

function OperatorRequestsPage() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const data = useWorkspaceData({ requests: true, episodes: true, availableEpisodesOnly: true });
  const [assignmentTaskFilter, setAssignmentTaskFilter] = useState("");
  const [assignmentQualityFilter, setAssignmentQualityFilter] = useState<Episode["quality"] | "">("");
  const [assigningRequest, setAssigningRequest] = useState<RequestRecord | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);
  const [viewingRequest, setViewingRequest] = useState<RequestRecord | null>(null);
  const [assignedEpisodes, setAssignedEpisodes] = useState<Episode[]>([]);
  const [requestHistory, setRequestHistory] = useState<StatusHistoryEntry[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const eligibleEpisodes = data.episodes.filter((episode) => episode.quality === "good" || episode.quality === "usable");
  const visibleEligibleEpisodes = eligibleEpisodes.filter((episode) => {
    const matchesTask = episode.task_name.toLowerCase().includes(assignmentTaskFilter.trim().toLowerCase());
    const matchesQuality = !assignmentQualityFilter || episode.quality === assignmentQualityFilter;
    return matchesTask && matchesQuality;
  });

  async function viewRequest(request: RequestRecord) {
    setViewingRequest(request);
    setIsLoadingDetails(true);
    setAssignedEpisodes([]);
    setRequestHistory([]);
    if (!token) {
      setIsLoadingDetails(false);
      return;
    }
    try {
      const [episodes, history] = await Promise.all([
        getRequestEpisodes(request.id, token),
        getRequestHistory(request.id, token),
      ]);
      setAssignedEpisodes(episodes);
      setRequestHistory(history);
    } catch (cause) {
      showToast({ kind: "error", title: "Could not load request details", description: cause instanceof Error ? cause.message : "Please try again." });
    } finally {
      setIsLoadingDetails(false);
    }
  }

  async function updateStatus(request: RequestRecord, status: RequestStatus) {
    if (!token) return;
    try {
      await updateRequestStatus(request.id, status, token);
      showToast({ kind: "success", title: "Request status updated", description: `Request #${request.id} moved to ${status.replace("_", " ")}.` });
      try {
        await data.load();
      } catch {
        showToast({
          kind: "info",
          title: "Changes saved",
          description: "The request queue could not refresh. Reload to see the latest data.",
        });
      }
    } catch (cause) {
      showToast({ kind: "error", title: "Could not update status", description: cause instanceof Error ? cause.message : "Please try again." });
    }
  }

  async function assignEpisodes(requestId: number, episodeIds: number[]) {
    if (!token) return;
    if (!episodeIds.length) {
      showToast({ kind: "error", title: "Choose an episode", description: "Select a good or usable episode before assigning." });
      return;
    }
    setIsAssigning(true);
    try {
      const assignments = await assignEpisodesToRequest(requestId, episodeIds, token);
      setAssigningRequest(null);
      showToast({
        kind: "success",
        title: "Episodes assigned",
        description: `${assignments.length} ${assignments.length === 1 ? "episode was" : "episodes were"} assigned to request #${requestId}.`,
      });
      try {
        await data.load();
      } catch {
        showToast({
          kind: "info",
          title: "Assignment saved",
          description: "The request queue could not refresh. Reload to see the latest data.",
        });
      }
    } catch (cause) {
      showToast({ kind: "error", title: "Could not assign episodes", description: cause instanceof Error ? cause.message : "Please try again." });
    } finally {
      setIsAssigning(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeading eyebrow="Operations workspace" title="Request queue" description="Review incoming work, advance status, and assign episodes." />
      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div><CardTitle>All requests</CardTitle><CardDescription>Manage requests submitted by clients.</CardDescription></div>
          <span className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-text">{data.requests.length} requests</span>
        </CardHeader>
        <div className="flex flex-col gap-3 border-y border-border bg-surface px-5 py-4 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Filter aria-hidden="true" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-text" />
            <input aria-label="Filter assignable episodes by task" value={assignmentTaskFilter} onChange={(event) => setAssignmentTaskFilter(event.target.value)} placeholder="Filter episodes by task name" className="min-h-10 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm text-brand-navy outline-none placeholder:text-muted-text focus:border-brand-blue" />
          </div>
          <select aria-label="Filter assignable episodes by quality" value={assignmentQualityFilter} onChange={(event) => setAssignmentQualityFilter(event.target.value as Episode["quality"] | "")} className="min-h-10 rounded-lg border border-border bg-surface px-3 text-sm text-brand-navy outline-none focus:border-brand-blue sm:w-48">
            <option value="">All assignable quality</option>
            <option value="good">Good</option>
            <option value="usable">Usable</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="bg-page-background text-xs font-medium uppercase tracking-wide text-muted-text">
              <tr><th className="px-5 py-3">Dataset request</th><th className="px-5 py-3">Client</th><th className="px-5 py-3">Episodes</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Assign episodes</th><th className="px-5 py-3 text-right">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.requests.map((request) => {
                const nextStatus = nextStatuses[request.status];
                const canAssign = ["in_progress", "rejected"].includes(request.status);
                return (
                  <tr key={request.id}>
                    <td className="max-w-[250px] px-5 py-4"><p className="truncate font-medium text-brand-navy">{request.task_name}</p><p className="mt-1 truncate text-xs text-muted-text">Request #{request.id}{request.notes ? ` · ${request.notes}` : ""}</p></td>
                    <td className="px-5 py-4 text-body-text">Client #{request.client_id}</td>
                    <td className="px-5 py-4 tabular-nums text-body-text">{request.episodes_requested}</td>
                    <td className="px-5 py-4"><RequestStatusBadge status={request.status} /></td>
                    <td className="px-5 py-4">
                      {canAssign ? (
                        <button
                          type="button"
                          disabled={visibleEligibleEpisodes.length === 0}
                          onClick={() => setAssigningRequest(request)}
                          className="cursor-pointer whitespace-nowrap rounded-md border border-brand-blue px-3 py-2 text-xs font-medium text-brand-blue hover:bg-brand-soft-blue disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Choose episodes
                        </button>
                      ) : <span className="text-xs text-muted-text">Available in progress</span>}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button type="button" onClick={() => void viewRequest(request)} className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-2.5 py-2 text-xs font-medium text-body-text hover:bg-page-background"><Eye aria-hidden="true" size={14} />View</button>
                        {nextStatus ? <button type="button" onClick={() => void updateStatus(request, nextStatus)} className="cursor-pointer whitespace-nowrap rounded-md bg-brand-blue px-3 py-2 text-xs font-medium text-white hover:bg-brand-blue-hover">Move to {nextStatus.replace("_", " ")}</button> : <span className="text-xs text-muted-text">Awaiting client</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {data.isLoading ? <TableSkeleton columns={6} /> : null}
          {!data.isLoading && data.requests.length === 0 ? <EmptyMessage icon={<Files size={24} />} title="The queue is empty" detail="Requests submitted by clients will appear here." /> : null}
        </div>
      </Card>
      {viewingRequest ? (
        <Dialog
          open
          title={`Request #${viewingRequest.id}`}
          description="Request details and the episodes currently assigned to this delivery."
          onClose={() => setViewingRequest(null)}
          footer={<div className="flex justify-end"><button type="button" onClick={() => setViewingRequest(null)} className="min-h-10 rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:bg-brand-blue-hover">Close</button></div>}
        >
          <dl className="divide-y divide-border">
            <DetailRow label="Task">{viewingRequest.task_name}</DetailRow>
            <DetailRow label="Client">Client #{viewingRequest.client_id}</DetailRow>
            <DetailRow label="Status"><RequestStatusBadge status={viewingRequest.status} /></DetailRow>
            <DetailRow label="Episodes requested">{viewingRequest.episodes_requested}</DetailRow>
            <DetailRow label="Deadline">{displayDate(viewingRequest.deadline)}</DetailRow>
            <DetailRow label="Notes">{viewingRequest.notes || "No notes provided."}</DetailRow>
            {requestHistory.filter((entry) => entry.note).length ? (
              <DetailRow label="Client feedback">
                <ul className="space-y-2">
                  {requestHistory.filter((entry) => entry.note).map((entry) => (
                    <li key={entry.id} className="rounded-lg border border-status-bad/20 bg-status-bad/5 p-3">
                      <p>{entry.note}</p>
                      <p className="mt-1 text-xs font-normal text-muted-text">{formatDateTime(entry.changed_at)}</p>
                    </li>
                  ))}
                </ul>
              </DetailRow>
            ) : null}
            <DetailRow label="Assigned episodes">
              {isLoadingDetails ? "Loading assigned episodes…" : assignedEpisodes.length
                ? <ul className="space-y-1">{assignedEpisodes.map((episode) => <li key={episode.id}>{episode.episode_id} · {episode.task_name} · {episode.quality}</li>)}</ul>
                : "No episodes assigned yet."}
            </DetailRow>
          </dl>
        </Dialog>
      ) : null}
      {assigningRequest ? (
        <EpisodeAssignmentDialog
          key={assigningRequest.id}
          request={assigningRequest}
          episodes={visibleEligibleEpisodes}
          isSaving={isAssigning}
          onAssign={(episodeIds) => assignEpisodes(assigningRequest.id, episodeIds)}
          onClose={() => {
            if (!isAssigning) setAssigningRequest(null);
          }}
        />
      ) : null}
    </div>
  );
}

function EpisodeAssignmentDialog({
  request,
  episodes,
  isSaving,
  onAssign,
  onClose,
}: {
  request: RequestRecord;
  episodes: Episode[];
  isSaving: boolean;
  onAssign: (episodeIds: number[]) => Promise<void>;
  onClose: () => void;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const allVisibleSelected = episodes.length > 0 && episodes.every((episode) => selectedIds.has(episode.id));

  function toggleEpisode(episodeId: number) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(episodeId)) next.delete(episodeId);
      else next.add(episodeId);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) episodes.forEach((episode) => next.delete(episode.id));
      else episodes.forEach((episode) => next.add(episode.id));
      return next;
    });
  }

  return (
    <Dialog
      open
      title="Assign episodes"
      description={`Choose the episodes to include in “${request.task_name}” (request #${request.id}).`}
      onClose={onClose}
      footer={(
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-text" aria-live="polite">{selectedIds.size} selected</p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} disabled={isSaving} className="min-h-10 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-body-text hover:bg-page-background disabled:opacity-60">Cancel</button>
            <button
              type="button"
              onClick={() => void onAssign(Array.from(selectedIds))}
              disabled={isSaving || selectedIds.size === 0}
              className="min-h-10 rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:bg-brand-blue-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Assigning…" : `Assign ${selectedIds.size} ${selectedIds.size === 1 ? "episode" : "episodes"}`}
            </button>
          </div>
        </div>
      )}
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-text">Only unassigned good or usable episodes are shown.</p>
          <button type="button" onClick={toggleAllVisible} disabled={!episodes.length || isSaving} className="text-sm font-medium text-brand-blue hover:underline disabled:text-muted-text">
            {allVisibleSelected ? "Clear visible selection" : "Select all visible"}
          </button>
        </div>
        {episodes.length ? (
          <ul className="max-h-[min(55dvh,28rem)] space-y-2 overflow-y-auto pr-1">
            {episodes.map((episode) => (
              <li key={episode.id}>
                <label className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition ${selectedIds.has(episode.id) ? "border-brand-blue bg-brand-soft-blue/50" : "border-border hover:bg-page-background"}`}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(episode.id)}
                    onChange={() => toggleEpisode(episode.id)}
                    disabled={isSaving}
                    className="mt-1 h-4 w-4 shrink-0 accent-brand-blue"
                    aria-label={`Select episode ${episode.episode_id}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-brand-navy">{episode.episode_id}</span>
                      <QualityBadge quality={episode.quality} />
                    </span>
                    <span className="mt-1 block truncate text-sm text-body-text">{episode.task_name} · {episode.robot_id}</span>
                    <span className="mt-1 block text-xs text-muted-text">Recorded {formatDateTime(episode.recorded_at)} · {formatEpisodeDuration(episode.duration_seconds)} · {episode.operator_name}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg bg-page-background px-4 py-6 text-center text-sm text-muted-text">No episodes match the current filters.</p>
        )}
      </div>
    </Dialog>
  );
}

function NewRequestPage() {
  const router = useRouter();
  const { user } = useAuth();
  const requestsPath = user ? `/${user.role}/requests` : "/login";
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-6">
      <PageHeading eyebrow="Client workspace" title="New dataset request" description="Tell the data team what you need collected." />
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-blue px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-blue-hover">
          <Plus aria-hidden="true" size={17} />
          Open request form
        </button>
      ) : null}
      {open ? (
        <RequestFormDialog
          open
          mode="create"
          onClose={() => {
            setOpen(false);
            router.replace(requestsPath);
          }}
          onSaved={() => router.replace(requestsPath)}
        />
      ) : null}
    </div>
  );
}

function EpisodesPage() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [totalEpisodes, setTotalEpisodes] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [taskFilter, setTaskFilter] = useState("");
  const [qualityFilter, setQualityFilter] = useState<Episode["quality"] | "">("");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [isImporting, setIsImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<EpisodeImportSummary | null>(null);
  const requestSequence = useRef(0);

  const loadEpisodes = useCallback(async () => {
    if (!token) return;
    const requestId = ++requestSequence.current;
    setIsLoading(true);
    setLoadError(null);
    try {
      const result = await getEpisodePage(token, {
        taskName: taskFilter.trim() || undefined,
        quality: qualityFilter || undefined,
        limit: pageSize,
        offset: pageIndex * pageSize,
      });
      if (requestId !== requestSequence.current) return;
      setEpisodes(result.items);
      setTotalEpisodes(result.total);
    } catch (cause) {
      if (requestId !== requestSequence.current) return;
      const message = cause instanceof Error ? cause.message : "Please try again.";
      setLoadError(message);
      showToast({ kind: "error", title: "Could not load episodes", description: message });
    } finally {
      if (requestId === requestSequence.current) setIsLoading(false);
    }
  }, [pageIndex, pageSize, qualityFilter, showToast, taskFilter, token]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadEpisodes(), 250);
    return () => window.clearTimeout(timeout);
  }, [loadEpisodes]);

  function updateTaskFilter(value: string) {
    setTaskFilter(value);
    setPageIndex(0);
  }

  function updateQualityFilter(value: Episode["quality"] | "") {
    setQualityFilter(value);
    setPageIndex(0);
  }

  function updatePageSize(value: number) {
    setPageSize(value);
    setPageIndex(0);
  }

  async function handleImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = event.currentTarget.elements.namedItem("episode-csv");
    const file = input instanceof HTMLInputElement ? input.files?.[0] : undefined;
    if (!file || !token) {
      showToast({ kind: "error", title: "Choose a CSV file", description: "Select an episode export before starting the import." });
      return;
    }
    setIsImporting(true);
    setImportError(null);
    setImportSummary(null);
    setIsLoading(true);
    try {
      const result = await importEpisodes(await file.text(), token);
      setImportSummary(result);
      setTaskFilter("");
      setQualityFilter("");
      setPageIndex(0);
      showToast({
        kind: "success",
        title: "Episode import complete",
        description: `${result.imported_count} imported; ${result.skipped_count} skipped.`,
      });
      try {
        const refreshedPage = await getEpisodePage(token, { limit: pageSize, offset: 0 });
        setEpisodes(refreshedPage.items);
        setTotalEpisodes(refreshedPage.total);
        setLoadError(null);
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : "Please try refreshing the inventory.";
        setLoadError(message);
        showToast({
          kind: "info",
          title: "Import saved; inventory could not refresh",
          description: message,
        });
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Please try again.";
      setImportError(message);
      showToast({ kind: "error", title: "Episode import failed", description: message });
    } finally {
      setIsImporting(false);
      setIsLoading(false);
    }
  }

  const pageCount = Math.max(1, Math.ceil(totalEpisodes / pageSize));
  const firstResult = totalEpisodes === 0 ? 0 : pageIndex * pageSize + 1;
  const lastResult = Math.min((pageIndex + 1) * pageSize, totalEpisodes);

  return (
    <div className="space-y-6">
      <PageHeading eyebrow="Operations workspace" title="Episode inventory" description="Browse recently recorded episodes and their quality." />
      <Card>
        <CardHeader><CardTitle>Import episode CSV</CardTitle><CardDescription>Upload a recording-system export. Re-imports are safe; duplicate and invalid rows are reported.</CardDescription></CardHeader>
        <CardContent>
          <form onSubmit={(event) => void handleImport(event)} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="min-w-0 flex-1 text-sm font-medium text-brand-navy">CSV file
              <input name="episode-csv" type="file" accept=".csv,text/csv" className="mt-2 block w-full cursor-pointer rounded-lg border border-border bg-surface px-3 py-2 text-sm text-body-text file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-brand-soft-blue file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-brand-blue" />
            </label>
            <button type="submit" disabled={isImporting} className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:bg-brand-blue-hover disabled:cursor-not-allowed disabled:opacity-60">
              {isImporting ? (
                <motion.span aria-hidden="true" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                  <Activity size={16} />
                </motion.span>
              ) : <FileUp aria-hidden="true" size={16} />}
              {isImporting ? "Importing episodes…" : "Import CSV"}
            </button>
          </form>
          {importError ? (
            <motion.div
              role="alert"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 rounded-lg border border-status-bad/20 bg-status-bad/5 px-4 py-3 text-sm text-status-bad"
            >
              Import failed: {importError}
            </motion.div>
          ) : null}
          {importSummary ? (
            <motion.section
              aria-live="polite"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24 }}
              className="mt-4 rounded-xl border border-border bg-page-background p-4 sm:p-5"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-brand-navy">Import results</p>
                  <p className="mt-1 text-xs text-muted-text">Every CSV row is accounted for below.</p>
                </div>
                <div className="grid grid-cols-3 gap-2 sm:min-w-[390px]">
                  <ImportCount label="Rows read" value={importSummary.total_rows} tone="neutral" />
                  <ImportCount label="Imported" value={importSummary.imported_count} tone="good" />
                  <ImportCount label="Skipped" value={importSummary.skipped_count} tone={importSummary.skipped_count ? "warning" : "good"} />
                </div>
              </div>
              {importSummary.skipped_rows.length ? (
                <div className="mt-4 overflow-hidden rounded-lg border border-border bg-surface">
                  <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                    <p className="text-sm font-medium text-brand-navy">Skipped rows and reasons</p>
                    <span className="rounded-full bg-status-warning/10 px-2.5 py-1 text-xs font-medium text-status-warning">{importSummary.skipped_rows.length}</span>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    <ul className="divide-y divide-border">
                      {importSummary.skipped_rows.map((issue) => (
                        <li key={`${issue.line_number}-${issue.reason}`} className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-4">
                          <span className="text-xs font-medium text-muted-text">CSV line {issue.line_number}</span>
                          <span className="break-words text-body-text">{issue.reason}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <p className="mt-4 rounded-lg border border-status-good/20 bg-status-good/5 px-4 py-3 text-sm text-status-good">
                  All rows imported successfully. No rows were skipped.
                </p>
              )}
            </motion.section>
          ) : null}
        </CardContent>
      </Card>
      <Card className="overflow-hidden">
        <CardHeader className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div><CardTitle>Episode inventory</CardTitle><CardDescription>{isLoading ? "Refreshing matching episodes…" : `${totalEpisodes.toLocaleString()} matching episodes.`}</CardDescription></div>
          <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-text">{totalEpisodes.toLocaleString()} total</span>
        </CardHeader>
        <div className="flex flex-col gap-3 border-y border-border px-5 py-4 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Filter aria-hidden="true" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-text" />
            <input aria-label="Filter episodes by task name" value={taskFilter} onChange={(event) => updateTaskFilter(event.target.value)} placeholder="Filter by task name" className="min-h-10 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm text-brand-navy outline-none placeholder:text-muted-text focus:border-brand-blue" />
          </div>
          <select aria-label="Filter episodes by quality" value={qualityFilter} onChange={(event) => updateQualityFilter(event.target.value as Episode["quality"] | "")} className="min-h-10 rounded-lg border border-border bg-surface px-3 text-sm text-brand-navy outline-none focus:border-brand-blue sm:w-48">
            <option value="">All qualities</option><option value="good">Good</option><option value="usable">Usable</option><option value="bad">Bad</option>
          </select>
          <label className="flex min-h-10 items-center gap-2 text-xs text-body-text">
            Rows
            <select aria-label="Rows per page" value={pageSize} onChange={(event) => updatePageSize(Number(event.target.value))} className="min-h-10 rounded-lg border border-border bg-surface px-2.5 text-sm text-brand-navy outline-none focus:border-brand-blue">
              <option value={10}>10</option><option value={25}>25</option><option value={50}>50</option>
            </select>
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="bg-page-background text-xs font-medium uppercase tracking-wide text-muted-text"><tr><th className="px-5 py-3">Episode</th><th className="px-5 py-3">Robot</th><th className="px-5 py-3">Task</th><th className="px-5 py-3">Recorded</th><th className="px-5 py-3">Quality</th></tr></thead>
            <tbody className="divide-y divide-border">
              {!isLoading && !loadError ? episodes.map((episode, index) => (
                <motion.tr
                  key={episode.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, delay: Math.min(index * 0.015, 0.18) }}
                  className="hover:bg-page-background/70"
                >
                  <td className="px-5 py-3.5 font-medium text-brand-navy">{episode.episode_id}</td>
                  <td className="px-5 py-3.5 text-body-text">{episode.robot_id}</td>
                  <td className="max-w-[260px] truncate px-5 py-3.5 text-body-text">{episode.task_name}</td>
                  <td className="px-5 py-3.5 text-body-text">{new Date(episode.recorded_at).toLocaleDateString()}</td>
                  <td className="px-5 py-3.5"><QualityBadge quality={episode.quality} /></td>
                </motion.tr>
              )) : null}
            </tbody>
          </table>
          {isLoading ? <TableSkeleton columns={5} rows={pageSize} /> : null}
          {!isLoading && loadError ? (
            <div role="alert" className="px-5 py-12 text-center">
              <p className="text-sm font-medium text-status-bad">Episodes could not be loaded</p>
              <p className="mt-1 text-sm text-muted-text">{loadError}</p>
              <button type="button" onClick={() => void loadEpisodes()} className="mt-4 cursor-pointer rounded-lg border border-border px-4 py-2 text-sm font-medium text-brand-navy hover:bg-page-background">Try again</button>
            </div>
          ) : null}
          {!isLoading && !loadError && episodes.length === 0 ? <EmptyMessage icon={<Archive size={24} />} title={taskFilter || qualityFilter ? "No episodes match these filters" : "No episodes available"} detail={taskFilter || qualityFilter ? "Adjust the task or quality filters to see more episodes." : "Import a CSV export to add episodes to the inventory."} /> : null}
        </div>
        <div className="flex flex-col gap-3 border-t border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-text">Showing {firstResult.toLocaleString()}–{lastResult.toLocaleString()} of {totalEpisodes.toLocaleString()} episodes</p>
          <div className="flex items-center justify-between gap-3 sm:justify-end">
            <button type="button" disabled={pageIndex === 0 || isLoading} onClick={() => setPageIndex((current) => Math.max(0, current - 1))} className="min-h-9 cursor-pointer rounded-lg border border-border px-3 py-2 text-xs font-medium text-body-text hover:bg-page-background disabled:cursor-not-allowed disabled:opacity-50">Previous</button>
            <span aria-live="polite" className="min-w-20 text-center text-xs tabular-nums text-muted-text">Page {pageIndex + 1} of {pageCount}</span>
            <button type="button" disabled={pageIndex + 1 >= pageCount || isLoading} onClick={() => setPageIndex((current) => Math.min(pageCount - 1, current + 1))} className="min-h-9 cursor-pointer rounded-lg border border-border px-3 py-2 text-xs font-medium text-body-text hover:bg-page-background disabled:cursor-not-allowed disabled:opacity-50">Next</button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function AnalyticsPage() {
  const { analytics, isLoading } = useWorkspaceData({ analytics: true });
  return (
    <div className="space-y-6">
      <PageHeading eyebrow="Operations workspace" title="Analytics" description="Track episode collection and request fulfilment." />
      {isLoading ? <AnalyticsSkeleton /> : null}
      {!isLoading ? (
        <>
          <section className="grid gap-5 xl:grid-cols-[1.45fr_1fr]">
            <DailyEpisodesChart analytics={analytics} />
            <RequestStatusChart data={analytics?.request_fulfilment ?? []} />
          </section>
          <Card>
            <CardHeader><CardTitle>Top tasks by good episodes</CardTitle><CardDescription>Task labels with the highest number of good-quality recordings.</CardDescription></CardHeader>
            <CardContent className="p-0">
              {analytics?.top_good_tasks.length ? (
                <div className="divide-y divide-border">
                  {analytics.top_good_tasks.map((task, index) => <div key={task.task_name} className="flex items-center gap-4 px-5 py-3.5 sm:px-6"><span className="w-7 text-xs font-medium tabular-nums text-muted-text">{String(index + 1).padStart(2, "0")}</span><span className="min-w-0 flex-1 truncate text-sm font-medium text-brand-navy">{task.task_name}</span><span className="text-sm tabular-nums text-body-text">{task.good_episode_count} episodes</span></div>)}
                </div>
              ) : <p className="px-5 py-8 text-sm text-muted-text sm:px-6">No good-quality episode data is available yet.</p>}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}

function AdminUsersPage() {
  const { user: currentUser, token } = useAuth();
  const { showToast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [roleByUser, setRoleByUser] = useState<Record<number, UserRole>>({});
  const [confirmingUser, setConfirmingUser] = useState<User | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const loadUsers = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      setUsers(await getAdminUsers(token));
    } catch (cause) {
      showToast({ kind: "error", title: "Could not load users", description: cause instanceof Error ? cause.message : "Please try again." });
    } finally {
      setIsLoading(false);
    }
  }, [showToast, token]);

  useEffect(() => {
    // Loading account data in this effect is intentional.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadUsers();
  }, [loadUsers]);

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    const formData = new FormData(event.currentTarget);
    const fullName = String(formData.get("full-name") || "").trim();
    setIsCreating(true);
    try {
      await createAdminUser({
        email: String(formData.get("email") || ""),
        password: String(formData.get("password") || ""),
        role: String(formData.get("role") || "client") as UserRole,
        ...(fullName ? { full_name: fullName } : {}),
      }, token);
      showToast({ kind: "success", title: "User created", description: "The new account can now sign in." });
      setCreateDialogOpen(false);
      await loadUsers();
    } catch (cause) {
      showToast({ kind: "error", title: "Could not create user", description: cause instanceof Error ? cause.message : "Please check the form and try again." });
    } finally {
      setIsCreating(false);
    }
  }

  async function saveRole(target: User) {
    if (!token) return;
    const role = roleByUser[target.id] ?? target.role;
    if (role === target.role) return;
    setIsUpdating(true);
    try {
      const updated = await updateAdminUser(target.id, { role }, token);
      setUsers((current) => current.map((item) => item.id === updated.id ? updated : item));
      setRoleByUser((current) => ({ ...current, [updated.id]: updated.role }));
      showToast({ kind: "success", title: "Role updated", description: `${updated.email} is now ${updated.role}.` });
    } catch (cause) {
      showToast({ kind: "error", title: "Could not update role", description: cause instanceof Error ? cause.message : "Please try again." });
    } finally {
      setIsUpdating(false);
    }
  }

  async function toggleActive() {
    if (!token || !confirmingUser) return;
    const target = confirmingUser;
    setIsUpdating(true);
    try {
      const updated = await updateAdminUser(target.id, { is_active: !target.is_active }, token);
      setUsers((current) => current.map((item) => item.id === updated.id ? updated : item));
      setConfirmingUser(null);
      showToast({
        kind: "success",
        title: updated.is_active ? "User reactivated" : "User deactivated",
        description: updated.is_active ? `${updated.email} can sign in again.` : `${updated.email} can no longer sign in.`,
      });
    } catch (cause) {
      showToast({ kind: "error", title: "Could not update account", description: cause instanceof Error ? cause.message : "Please try again." });
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeading eyebrow="Administration" title="User management" description="Create accounts, change roles, and deactivate access when needed." />
      <Card className="overflow-hidden">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><CardTitle>Workspace accounts</CardTitle><CardDescription>{users.length} registered users.</CardDescription></div>
          <button type="button" onClick={() => setCreateDialogOpen(true)} className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:bg-brand-blue-hover">
            <Plus aria-hidden="true" size={16} />Create user
          </button>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-page-background text-xs font-medium uppercase tracking-wide text-muted-text"><tr><th className="px-5 py-3">Account</th><th className="px-5 py-3">Role</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Access</th></tr></thead>
            <tbody className="divide-y divide-border">
              {users.map((account) => {
                const isSelf = account.id === currentUser?.id;
                return (
                  <tr key={account.id}>
                    <td className="px-5 py-4"><p className="font-medium text-brand-navy">{account.full_name || account.email}</p><p className="mt-1 text-xs text-muted-text">{account.email}</p></td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <select aria-label={`Role for ${account.email}`} value={roleByUser[account.id] ?? account.role} disabled={isSelf || isUpdating} onChange={(event) => setRoleByUser((current) => ({ ...current, [account.id]: event.target.value as UserRole }))} className="rounded-md border border-border bg-surface px-2.5 py-2 text-xs text-body-text outline-none focus:border-brand-blue disabled:opacity-60">
                          <option value="client">Client</option><option value="operator">Operator</option><option value="admin">Admin</option>
                        </select>
                        {!isSelf && (roleByUser[account.id] ?? account.role) !== account.role ? <button type="button" disabled={isUpdating} onClick={() => void saveRole(account)} className="cursor-pointer rounded-md border border-brand-blue px-2.5 py-2 text-xs font-medium text-brand-blue hover:bg-brand-soft-blue disabled:opacity-60">Save</button> : null}
                      </div>
                    </td>
                    <td className="px-5 py-4"><span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${account.is_active ? "border-status-good/25 bg-status-good/5 text-status-good" : "border-border bg-page-background text-muted-text"}`}>{account.is_active ? "Active" : "Inactive"}</span></td>
                    <td className="px-5 py-4 text-right">
                      <button type="button" disabled={isSelf || isUpdating} onClick={() => setConfirmingUser(account)} className={`cursor-pointer rounded-md border px-3 py-2 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50 ${account.is_active ? "border-status-bad/25 text-status-bad hover:bg-status-bad/5" : "border-border text-body-text hover:bg-page-background"}`}>
                        {account.is_active ? "Deactivate" : "Reactivate"}
                      </button>
                      {isSelf ? <span className="ml-2 text-xs text-muted-text">Current user</span> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {isLoading ? <TableSkeleton columns={4} /> : null}
          {!isLoading && users.length === 0 ? <EmptyMessage icon={<Users size={24} />} title="No users found" detail="Create the first workspace account to get started." /> : null}
        </div>
      </Card>
      <Dialog
        open={createDialogOpen}
        title="Create workspace user"
        description="New accounts receive the selected role and can sign in immediately."
        onClose={() => setCreateDialogOpen(false)}
        footer={<div className="flex justify-end gap-2"><button type="button" onClick={() => setCreateDialogOpen(false)} className="min-h-10 rounded-lg border border-border px-4 py-2 text-sm font-medium text-body-text hover:bg-page-background">Cancel</button><button form="create-workspace-user" type="submit" disabled={isCreating} className="min-h-10 rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:bg-brand-blue-hover disabled:opacity-60">{isCreating ? "Creating…" : "Create user"}</button></div>}
      >
        <form id="create-workspace-user" onSubmit={(event) => void createUser(event)} className="space-y-4">
          <label className="block text-sm font-medium text-brand-navy">Full name <span className="font-normal text-muted-text">(optional)</span><input name="full-name" maxLength={255} className="mt-1.5 min-h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm font-normal outline-none focus:border-brand-blue" /></label>
          <label className="block text-sm font-medium text-brand-navy">Email<input name="email" type="email" required autoComplete="email" className="mt-1.5 min-h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm font-normal outline-none focus:border-brand-blue" /></label>
          <label className="block text-sm font-medium text-brand-navy">Temporary password<input name="password" type="password" required minLength={12} maxLength={72} autoComplete="new-password" className="mt-1.5 min-h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm font-normal outline-none focus:border-brand-blue" /><span className="mt-1 block text-xs font-normal text-muted-text">Use at least 12 characters. Share it securely and ask the user to replace it.</span></label>
          <label className="block text-sm font-medium text-brand-navy">Role<select name="role" defaultValue="client" className="mt-1.5 min-h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm font-normal outline-none focus:border-brand-blue"><option value="client">Client</option><option value="operator">Operator</option><option value="admin">Admin</option></select></label>
        </form>
      </Dialog>
      <ConfirmationModal
        open={confirmingUser !== null}
        title={confirmingUser?.is_active ? "Deactivate this account?" : "Reactivate this account?"}
        description={confirmingUser?.is_active ? `${confirmingUser.email} will no longer be able to sign in.` : `${confirmingUser?.email} will be able to sign in again.`}
        confirmLabel={confirmingUser?.is_active ? "Deactivate" : "Reactivate"}
        onConfirm={() => void toggleActive()}
        onCancel={() => setConfirmingUser(null)}
        isDestructive={confirmingUser?.is_active}
        isPending={isUpdating}
      />
    </div>
  );
}

function ProfilePage() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <div className="space-y-6">
      <PageHeading eyebrow="Account" title="Profile" description="Your authenticated Dataset Desk account." />
      <Card className="max-w-2xl">
        <CardHeader><CardTitle>Account details</CardTitle><CardDescription>Profile details are managed by your workspace administrator.</CardDescription></CardHeader>
        <CardContent className="divide-y divide-border p-0">
          <ProfileDetail label="Full name" value={user.full_name || "Not provided"} />
          <ProfileDetail label="Email" value={user.email} />
          <ProfileDetail label="Role" value={user.role} />
          <ProfileDetail label="Account status" value={user.is_active ? "Active" : "Inactive"} />
        </CardContent>
      </Card>
    </div>
  );
}

function ProfileDetail({ label, value }: { label: string; value: string }) {
  return <div className="flex flex-wrap justify-between gap-2 px-5 py-4 sm:px-6"><span className="text-sm text-muted-text">{label}</span><span className="text-sm font-medium capitalize text-brand-navy">{value}</span></div>;
}

function UnavailablePage({ title }: { title: string }) {
  return <div className="space-y-6"><PageHeading eyebrow="Client workspace" title={title} description="This workspace section is only available to operations." /><Card><CardContent className="py-10 text-sm text-muted-text">You do not have access to this section.</CardContent></Card></div>;
}

function PageHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <section><p className="text-sm font-medium capitalize text-brand-blue">{eyebrow}</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-brand-navy sm:text-3xl">{title}</h1><p className="mt-2 text-sm text-muted-text">{description}</p></section>;
}

function TableSkeleton({ columns, rows = 5 }: { columns: number; rows?: number }) {
  return (
    <motion.div
      aria-label="Loading table"
      role="status"
      className="space-y-3 px-5 py-5"
      animate={{ opacity: [0.45, 0.85, 0.45] }}
      transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
    >
      {Array.from({ length: Math.min(rows, 10) }, (_, row) => (
        <div key={row} className="flex gap-3">
          {Array.from({ length: columns }, (_, column) => (
            <span key={column} className="h-8 flex-1 rounded-md bg-page-background" />
          ))}
        </div>
      ))}
      <span className="sr-only">Loading records…</span>
    </motion.div>
  );
}

function ImportCount({ label, value, tone }: { label: string; value: number; tone: "neutral" | "good" | "warning" }) {
  const color = tone === "good"
    ? "text-status-good"
    : tone === "warning"
      ? "text-status-warning"
      : "text-brand-navy";
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-text">{label}</p>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${color}`}>{value.toLocaleString()}</p>
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <motion.div
      aria-label="Loading analytics"
      role="status"
      className="grid gap-5 xl:grid-cols-[1.45fr_1fr]"
      animate={{ opacity: [0.45, 0.85, 0.45] }}
      transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
    >
      <div className="h-72 rounded-xl border border-border bg-surface p-6"><div className="h-4 w-40 rounded bg-page-background" /><div className="mt-8 h-44 rounded-lg bg-page-background" /></div>
      <div className="h-72 rounded-xl border border-border bg-surface p-6"><div className="h-4 w-32 rounded bg-page-background" /><div className="mx-auto mt-8 h-44 w-44 rounded-full border-[22px] border-page-background" /></div>
      <span className="sr-only">Loading analytics…</span>
    </motion.div>
  );
}

function EmptyMessage({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) {
  return <div className="px-5 py-12 text-center"><span aria-hidden="true" className="mx-auto flex justify-center text-muted-text">{icon}</span><p className="mt-3 text-sm font-medium text-brand-navy">{title}</p><p className="mt-1 text-sm text-muted-text">{detail}</p></div>;
}

function QualityBadge({ quality }: { quality: Episode["quality"] }) {
  const styles = {
    good: "border-status-good/25 bg-status-good/5 text-status-good",
    usable: "border-status-warning/25 bg-status-warning/5 text-status-warning",
    bad: "border-status-bad/25 bg-status-bad/5 text-status-bad",
  };
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${styles[quality]}`}>{quality}</span>;
}

function getRequestCounts(requests: RequestRecord[]) {
  return requests.reduce(
    (result, request) => {
      result[request.status] += 1;
      return result;
    },
    { submitted: 0, in_progress: 0, delivered: 0, accepted: 0, rejected: 0 },
  );
}

function statusChartData(counts: ReturnType<typeof getRequestCounts>): AnalyticsResponse["request_fulfilment"] {
  return Object.entries(counts).map(([status, request_count]) => ({
    status: status as RequestStatus,
    request_count,
  }));
}

function displayDate(value?: string | null) {
  return value ? new Date(`${value}T00:00:00`).toLocaleDateString() : "—";
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

function formatEpisodeDuration(seconds: number) {
  if (seconds < 60) return `${seconds} sec`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds ? `${minutes} min ${remainingSeconds} sec` : `${minutes} min`;
}

function formatDuration(seconds: number | null) {
  if (seconds === null) return "—";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours) return `${hours}h ${minutes}m`;
  return `${minutes} min`;
}

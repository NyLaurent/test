"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { CheckCheck, Clock3, FilePlus2, Files } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { MetricCard, RequestStatusChart } from "@/components/portal/dashboard-widgets";
import { RequestStatusBadge } from "@/components/portal/request-status-badge";
import { useToast } from "@/components/toast/toast-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createRequest, getRequests, updateRequestStatus } from "@/lib/api";
import type { RequestRecord } from "@/lib/types";

function displayDate(value?: string | null) {
  return value ? new Date(`${value}T00:00:00`).toLocaleDateString() : "—";
}

export function ClientDashboard() {
  const { token, user } = useAuth();
  const { showToast } = useToast();
  const [requests, setRequests] = useState<RequestRecord[]>([]);
  const [taskName, setTaskName] = useState("");
  const [episodesRequested, setEpisodesRequested] = useState(1);
  const [deadline, setDeadline] = useState("");
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadRequests = useCallback(async () => {
    if (!token) return;
    setRequests(await getRequests(token));
  }, [token]);

  useEffect(() => {
    // Loading API state here is the effect's purpose; updates happen after the async response.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRequests()
      .catch((cause: unknown) =>
        showToast({
          kind: "error",
          title: "Could not load requests",
          description: cause instanceof Error ? cause.message : "Please try again.",
        }),
      )
      .finally(() => setIsLoading(false));
  }, [loadRequests, showToast]);

  async function handleCreateRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;

    setIsSubmitting(true);
    try {
      await createRequest(
        {
          task_name: taskName.trim(),
          episodes_requested: episodesRequested,
          deadline: deadline || undefined,
          notes: notes.trim() || undefined,
        },
        token,
      );
      setTaskName("");
      setEpisodesRequested(1);
      setDeadline("");
      setNotes("");
      showToast({
        kind: "success",
        title: "Request submitted",
        description: "Your dataset request is now in the operator queue.",
      });
      try {
        await loadRequests();
      } catch {
        showToast({
          kind: "info",
          title: "Request saved",
          description: "Your request was created, but the history list could not refresh.",
        });
      }
    } catch (cause) {
      showToast({
        kind: "error",
        title: "Could not submit request",
        description: cause instanceof Error ? cause.message : "Please check your details and try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleReview(request: RequestRecord, status: "accepted" | "rejected") {
    if (!token) return;
    try {
      await updateRequestStatus(request.id, status, token);
      showToast({
        kind: "success",
        title: status === "accepted" ? "Delivery accepted" : "Changes requested",
        description: status === "accepted"
          ? "This dataset delivery has been accepted."
          : "The request has been returned to the operator.",
      });
      try {
        await loadRequests();
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
    }
  }

  const counts = requests.reduce(
    (result, request) => {
      result[request.status] += 1;
      return result;
    },
    { submitted: 0, in_progress: 0, delivered: 0, accepted: 0, rejected: 0 },
  );
  const activeCount = counts.submitted + counts.in_progress + counts.rejected;

  return (
    <div id="overview" className="space-y-7">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-brand-blue">Client workspace</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-brand-navy sm:text-3xl">Overview</h1>
          <p className="mt-2 text-sm text-muted-text">Create dataset requests and follow them through delivery.</p>
        </div>
        <p className="text-sm text-muted-text">
          Signed in as <span className="font-medium text-body-text">{user?.full_name || user?.email}</span>
        </p>
      </section>

      <section aria-label="Request summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total requests" value={requests.length} detail="All requests you've submitted" icon={Files} tone="blue" />
        <MetricCard label="In progress" value={activeCount} detail="Being handled by operations" icon={Clock3} tone="orange" />
        <MetricCard label="Awaiting review" value={counts.delivered} detail="Delivered and ready for your review" icon={FilePlus2} tone="purple" />
        <MetricCard label="Accepted" value={counts.accepted} detail="Completed requests" icon={CheckCheck} tone="green" />
      </section>

      <section className="grid items-start gap-5 xl:grid-cols-2">
        <Card id="new-request" className="scroll-mt-6">
          <CardHeader>
            <CardTitle>New dataset request</CardTitle>
            <CardDescription>Tell the data team what you need collected.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateRequest} className="space-y-4">
              <label className="block text-sm font-medium text-body-text">
                Task name
                <input
                  required
                  maxLength={200}
                  value={taskName}
                  onChange={(event) => setTaskName(event.target.value)}
                  placeholder="e.g. Pick up the red mug"
                  className="mt-2 w-full rounded-lg border border-border bg-surface px-3 py-2.5 font-normal outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/10"
                />
              </label>
              <label className="block text-sm font-medium text-body-text">
                Episodes requested
                <input
                  required
                  type="number"
                  min={1}
                  value={episodesRequested}
                  onChange={(event) => setEpisodesRequested(Math.max(1, Number(event.target.value)))}
                  className="mt-2 w-full rounded-lg border border-border bg-surface px-3 py-2.5 font-normal outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/10"
                />
              </label>
              <label className="block text-sm font-medium text-body-text">
                Deadline <span className="font-normal text-muted-text">(optional)</span>
                <input
                  type="date"
                  value={deadline}
                  onChange={(event) => setDeadline(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-border bg-surface px-3 py-2.5 font-normal outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/10"
                />
              </label>
              <label className="block text-sm font-medium text-body-text">
                Notes <span className="font-normal text-muted-text">(optional)</span>
                <textarea
                  rows={4}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Add collection or quality requirements…"
                  className="mt-2 w-full resize-y rounded-lg border border-border bg-surface px-3 py-2.5 font-normal outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/10"
                />
              </label>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-blue px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-blue-hover disabled:opacity-60"
              >
                <FilePlus2 aria-hidden="true" size={17} />
                {isSubmitting ? "Submitting…" : "Submit request"}
              </button>
            </form>
          </CardContent>
        </Card>

        <RequestStatusChart
          data={Object.entries(counts).map(([status, request_count]) => ({
            status: status as RequestRecord["status"],
            request_count,
          }))}
        />
      </section>

      <Card id="requests" className="scroll-mt-6 overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle>My requests</CardTitle>
              <CardDescription>Review status and respond to delivered datasets.</CardDescription>
            </div>
            <span className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-text">
              {requests.length} total
            </span>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="bg-page-background text-xs font-medium uppercase tracking-wide text-muted-text">
                <tr>
                  <th className="px-5 py-3">Task</th>
                  <th className="px-5 py-3">Episodes</th>
                  <th className="px-5 py-3">Deadline</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {requests.map((request) => (
                  <tr key={request.id} className="align-middle">
                    <td className="max-w-[240px] px-5 py-4">
                      <p className="truncate font-medium text-brand-navy">{request.task_name}</p>
                      <p className="mt-1 text-xs text-muted-text">Request #{request.id}</p>
                    </td>
                    <td className="px-5 py-4 tabular-nums text-body-text">{request.episodes_requested}</td>
                    <td className="px-5 py-4 text-body-text">{displayDate(request.deadline)}</td>
                    <td className="px-5 py-4"><RequestStatusBadge status={request.status} /></td>
                    <td className="px-5 py-4 text-right">
                      {request.status === "delivered" ? (
                        <div className="inline-flex gap-2">
                          <button
                            type="button"
                            onClick={() => void handleReview(request, "accepted")}
                            className="rounded-md bg-status-good px-2.5 py-1.5 text-xs font-medium text-white hover:brightness-95"
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleReview(request, "rejected")}
                            className="rounded-md border border-status-bad/30 px-2.5 py-1.5 text-xs font-medium text-status-bad hover:bg-status-bad/5"
                          >
                            Request changes
                          </button>
                        </div>
                      ) : <span className="text-xs text-muted-text">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {isLoading ? <p className="px-5 py-10 text-center text-sm text-muted-text">Loading requests…</p> : null}
            {!isLoading && requests.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <Files aria-hidden="true" className="mx-auto text-muted-text" size={25} strokeWidth={1.6} />
                <p className="mt-3 text-sm font-medium text-brand-navy">No requests yet</p>
                <p className="mt-1 text-sm text-muted-text">Your new requests will appear here.</p>
              </div>
            ) : null}
          </div>
      </Card>
    </div>
  );
}

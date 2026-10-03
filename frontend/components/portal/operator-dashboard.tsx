"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { RequestStatusBadge } from "@/components/portal/request-status-badge";
import {
  assignEpisodeToRequest,
  getAnalytics,
  getEpisodes,
  getRequests,
  updateRequestStatus,
} from "@/lib/api";
import type { AnalyticsResponse, Episode, RequestRecord, RequestStatus } from "@/lib/types";

const nextStatuses: Partial<Record<RequestStatus, RequestStatus>> = {
  submitted: "in_progress",
  in_progress: "delivered",
  rejected: "in_progress",
};

export function OperatorDashboard() {
  const { token, user } = useAuth();
  const [requests, setRequests] = useState<RequestRecord[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [selectionByRequest, setSelectionByRequest] = useState<Record<number, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadWorkspace = useCallback(async () => {
    if (!token) return;
    const [requestData, episodeData, analyticsData] = await Promise.all([
      getRequests(token),
      getEpisodes(token),
      getAnalytics(token),
    ]);
    setRequests(requestData);
    setEpisodes(episodeData);
    setAnalytics(analyticsData);
  }, [token]);

  useEffect(() => {
    // Loading API state here is the effect's purpose; updates happen after the async response.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadWorkspace()
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Unable to load operations data."))
      .finally(() => setIsLoading(false));
  }, [loadWorkspace]);

  async function handleStatusChange(request: RequestRecord) {
    if (!token) return;
    const nextStatus = nextStatuses[request.status];
    if (!nextStatus) return;
    setError("");
    try {
      await updateRequestStatus(request.id, nextStatus, token);
      await loadWorkspace();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update request status.");
    }
  }

  async function handleAssignment(requestId: number) {
    if (!token) return;
    const episodeId = Number(selectionByRequest[requestId]);
    if (!episodeId) {
      setError("Select an eligible episode before assigning.");
      return;
    }
    setError("");
    try {
      await assignEpisodeToRequest(requestId, episodeId, token);
      setSelectionByRequest((current) => ({ ...current, [requestId]: "" }));
      await loadWorkspace();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to assign episode.");
    }
  }

  const openRequests = requests.filter((request) => ["submitted", "in_progress", "rejected"].includes(request.status)).length;
  const eligibleEpisodes = episodes.filter((episode) => episode.quality === "good" || episode.quality === "usable");

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-blue">{user?.role} portal</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Operations overview</h1>
          <p className="mt-2 text-slate-500">Coordinate request delivery, assign quality-approved episodes, and monitor activity.</p>
        </div>
        <span className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">Signed in as {user?.email}</span>
      </div>

      {error ? <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div> : null}

      <section className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Total requests" value={requests.length} detail="Across all clients" />
        <MetricCard label="Needs attention" value={openRequests} detail="Submitted, in progress, or returned" />
        <MetricCard label="Assignable episodes" value={eligibleEpisodes.length} detail="Good or usable quality" />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Request queue</h2>
            <p className="mt-1 text-sm text-slate-500">Advance work through the supported workflow and attach eligible episodes.</p>
          </div>
          <span className="text-sm text-slate-500">{requests.length} requests</span>
        </div>
        {isLoading ? <p className="py-10 text-center text-sm text-slate-500">Loading operations data…</p> : null}
        {!isLoading && requests.length === 0 ? <p className="py-10 text-center text-sm text-slate-500">No requests have been submitted.</p> : null}
        <div className="mt-5 space-y-3">
          {requests.map((request) => {
            const nextStatus = nextStatuses[request.status];
            return (
              <article key={request.id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{request.task_name}</h3>
                      <RequestStatusBadge status={request.status} />
                    </div>
                    <p className="mt-1 text-sm text-slate-500">Request #{request.id} · Client #{request.client_id} · {request.episodes_requested} episodes requested</p>
                    {request.notes ? <p className="mt-2 text-sm text-slate-600">{request.notes}</p> : null}
                  </div>
                  {nextStatus ? (
                    <button onClick={() => void handleStatusChange(request)} className="rounded-lg bg-brand-blue px-3 py-2 text-sm font-semibold text-white hover:bg-brand-blue-hover">
                      Move to {nextStatus.replace("_", " ")}
                    </button>
                  ) : null}
                </div>
                {["in_progress", "rejected"].includes(request.status) ? (
                  <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row">
                    <select
                      aria-label={`Eligible episode for request ${request.id}`}
                      value={selectionByRequest[request.id] ?? ""}
                      onChange={(event) => setSelectionByRequest((current) => ({ ...current, [request.id]: event.target.value }))}
                      className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
                    >
                      <option value="">Choose a good or usable episode</option>
                      {eligibleEpisodes.map((episode) => (
                        <option key={episode.id} value={episode.id}>
                          {episode.episode_id} · {episode.robot_id} · {episode.task_name} ({episode.quality})
                        </option>
                      ))}
                    </select>
                    <button onClick={() => void handleAssignment(request.id)} className="rounded-lg border border-brand-blue px-4 py-2.5 text-sm font-semibold text-brand-blue hover:bg-brand-soft-blue">
                      Assign episode
                    </button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold">Request fulfilment</h2>
          <p className="mt-1 text-sm text-slate-500">Current count grouped by workflow status.</p>
          <div className="mt-5 space-y-3">
            {analytics?.request_fulfilment.map((item) => (
              <div key={item.status} className="flex items-center justify-between border-b border-slate-100 pb-3 last:border-0">
                <RequestStatusBadge status={item.status as RequestStatus} />
                <span className="font-semibold tabular-nums">{item.request_count}</span>
              </div>
            ))}
            {!analytics?.request_fulfilment.length ? <p className="text-sm text-slate-500">Analytics are not available.</p> : null}
          </div>
          <div className="mt-4 rounded-lg bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Median delivery time</p>
            <p className="mt-1 text-xl font-semibold">{formatDuration(analytics?.median_delivery_seconds ?? null)}</p>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold">Top tasks by good episodes</h2>
          <p className="mt-1 text-sm text-slate-500">Most frequently collected high-quality task data.</p>
          <div className="mt-5 space-y-3">
            {analytics?.top_good_tasks.map((task, index) => (
              <div key={task.task_name} className="flex items-center gap-3 border-b border-slate-100 pb-3 last:border-0">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft-blue text-sm font-semibold text-brand-blue">{index + 1}</span>
                <span className="flex-1 text-sm font-medium">{task.task_name}</span>
                <span className="text-sm font-semibold tabular-nums">{task.good_episode_count}</span>
              </div>
            ))}
            {!analytics?.top_good_tasks.length ? <p className="text-sm text-slate-500">No good episode data yet.</p> : null}
          </div>
        </div>
      </section>
    </div>
  );
}

function MetricCard({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{detail}</p>
    </div>
  );
}

function formatDuration(seconds: number | null) {
  if (seconds === null) return "Not enough data yet";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours) return `${hours}h ${minutes}m`;
  return `${minutes} min`;
}

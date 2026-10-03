"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, Archive, ClipboardList, Timer } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { DailyEpisodesChart, MetricCard, RequestStatusChart } from "@/components/portal/dashboard-widgets";
import { RequestStatusBadge } from "@/components/portal/request-status-badge";
import { useToast } from "@/components/toast/toast-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  const { showToast } = useToast();
  const [requests, setRequests] = useState<RequestRecord[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [selectionByRequest, setSelectionByRequest] = useState<Record<number, string>>({});
  const [isLoading, setIsLoading] = useState(true);

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
      .catch((cause: unknown) =>
        showToast({
          kind: "error",
          title: "Could not load operations data",
          description: cause instanceof Error ? cause.message : "Please try again.",
        }),
      )
      .finally(() => setIsLoading(false));
  }, [loadWorkspace, showToast]);

  async function refreshAfterAction(successTitle: string, successDescription: string) {
    showToast({ kind: "success", title: successTitle, description: successDescription });
    try {
      await loadWorkspace();
    } catch {
      showToast({
        kind: "info",
        title: "Changes saved",
        description: "The workspace could not refresh. Reload to see the latest data.",
      });
    }
  }

  async function handleStatusChange(request: RequestRecord) {
    if (!token) return;
    const nextStatus = nextStatuses[request.status];
    if (!nextStatus) return;
    try {
      await updateRequestStatus(request.id, nextStatus, token);
      await refreshAfterAction(
        "Request status updated",
        `Request #${request.id} moved to ${nextStatus.replace("_", " ")}.`,
      );
    } catch (cause) {
      showToast({
        kind: "error",
        title: "Could not update status",
        description: cause instanceof Error ? cause.message : "Please try again.",
      });
    }
  }

  async function handleAssignment(requestId: number) {
    if (!token) return;
    const episodeId = Number(selectionByRequest[requestId]);
    if (!episodeId) {
      showToast({
        kind: "error",
        title: "Choose an episode",
        description: "Select a good or usable episode before assigning.",
      });
      return;
    }
    try {
      await assignEpisodeToRequest(requestId, episodeId, token);
      setSelectionByRequest((current) => ({ ...current, [requestId]: "" }));
      await refreshAfterAction(
        "Episode assigned",
        `Episode #${episodeId} was assigned to request #${requestId}.`,
      );
    } catch (cause) {
      showToast({
        kind: "error",
        title: "Could not assign episode",
        description: cause instanceof Error ? cause.message : "Please try again.",
      });
    }
  }

  const openRequests = requests.filter((request) => ["submitted", "in_progress", "rejected"].includes(request.status)).length;
  const eligibleEpisodes = episodes.filter((episode) => episode.quality === "good" || episode.quality === "usable");
  const recentEpisodes = episodes.slice(0, 10);

  return (
    <div id="overview" className="space-y-7">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium capitalize text-brand-blue">{user?.role} workspace</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-brand-navy sm:text-3xl">Operations overview</h1>
          <p className="mt-2 text-sm text-muted-text">Request flow, episode availability, and collection activity.</p>
        </div>
        <span className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-body-text">
          Signed in as {user?.full_name || user?.email}
        </span>
      </section>

      <section aria-label="Operations summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total requests" value={requests.length} detail="Across all clients" icon={ClipboardList} tone="blue" />
        <MetricCard label="Needs attention" value={openRequests} detail="Submitted or in progress" icon={Activity} tone="orange" />
        <MetricCard label="Assignable episodes" value={eligibleEpisodes.length} detail="Good or usable quality" icon={Archive} tone="green" />
        <MetricCard label="Median delivery" value={formatDuration(analytics?.median_delivery_seconds ?? null)} detail="Submitted to delivered" icon={Timer} tone="purple" />
      </section>

      <section id="analytics" aria-label="Analytics" className="grid scroll-mt-6 gap-5 xl:grid-cols-[1.45fr_1fr]">
        <DailyEpisodesChart analytics={analytics} />
        <RequestStatusChart data={analytics?.request_fulfilment ?? []} />
      </section>

      <Card id="requests" className="scroll-mt-6 overflow-hidden">
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Request queue</CardTitle>
            <CardDescription>Review incoming work, advance status, and assign episodes.</CardDescription>
          </div>
          <span className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-text">
            {requests.length} requests
          </span>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="bg-page-background text-xs font-medium uppercase tracking-wide text-muted-text">
              <tr>
                <th className="px-5 py-3">Dataset request</th>
                <th className="px-5 py-3">Client</th>
                <th className="px-5 py-3">Episodes</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Assign eligible episode</th>
                <th className="px-5 py-3 text-right">Workflow</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {requests.map((request) => {
                const nextStatus = nextStatuses[request.status];
                const canAssign = ["in_progress", "rejected"].includes(request.status);
                return (
                  <tr key={request.id} className="align-middle">
                    <td className="max-w-[250px] px-5 py-4">
                      <p className="truncate font-medium text-brand-navy">{request.task_name}</p>
                      <p className="mt-1 truncate text-xs text-muted-text">Request #{request.id}{request.notes ? ` · ${request.notes}` : ""}</p>
                    </td>
                    <td className="px-5 py-4 text-body-text">Client #{request.client_id}</td>
                    <td className="px-5 py-4 tabular-nums text-body-text">{request.episodes_requested}</td>
                    <td className="px-5 py-4"><RequestStatusBadge status={request.status} /></td>
                    <td className="px-5 py-4">
                      {canAssign ? (
                        <div className="flex min-w-[290px] items-center gap-2">
                          <select
                            aria-label={`Episode for request ${request.id}`}
                            value={selectionByRequest[request.id] ?? ""}
                            onChange={(event) =>
                              setSelectionByRequest((current) => ({ ...current, [request.id]: event.target.value }))
                            }
                            className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2.5 py-2 text-xs text-body-text outline-none focus:border-brand-blue"
                          >
                            <option value="">Select an episode</option>
                            {eligibleEpisodes.map((episode) => (
                              <option key={episode.id} value={episode.id}>
                                {episode.episode_id} · {episode.robot_id} · {episode.quality}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => void handleAssignment(request.id)}
                            className="rounded-md border border-brand-blue px-2.5 py-2 text-xs font-medium text-brand-blue hover:bg-brand-soft-blue"
                          >
                            Assign
                          </button>
                        </div>
                      ) : <span className="text-xs text-muted-text">Available in progress</span>}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {nextStatus ? (
                        <button
                          type="button"
                          onClick={() => void handleStatusChange(request)}
                          className="rounded-md bg-brand-blue px-3 py-2 text-xs font-medium text-white hover:bg-brand-blue-hover"
                        >
                          Move to {nextStatus.replace("_", " ")}
                        </button>
                      ) : <span className="text-xs text-muted-text">Awaiting client</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {isLoading ? <p className="px-5 py-10 text-center text-sm text-muted-text">Loading request queue…</p> : null}
          {!isLoading && requests.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <ClipboardList aria-hidden="true" className="mx-auto text-muted-text" size={25} strokeWidth={1.6} />
              <p className="mt-3 text-sm font-medium text-brand-navy">The queue is empty</p>
              <p className="mt-1 text-sm text-muted-text">Requests submitted by clients will appear here.</p>
            </div>
          ) : null}
        </div>
      </Card>

      <Card id="episodes" className="scroll-mt-6 overflow-hidden">
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Episode inventory</CardTitle>
            <CardDescription>Recently recorded episodes available to operations.</CardDescription>
          </div>
          <span className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-text">
            {eligibleEpisodes.length} assignable
          </span>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="bg-page-background text-xs font-medium uppercase tracking-wide text-muted-text">
              <tr>
                <th className="px-5 py-3">Episode</th>
                <th className="px-5 py-3">Robot</th>
                <th className="px-5 py-3">Task</th>
                <th className="px-5 py-3">Recorded</th>
                <th className="px-5 py-3">Quality</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {recentEpisodes.map((episode) => (
                <tr key={episode.id}>
                  <td className="px-5 py-3.5 font-medium text-brand-navy">{episode.episode_id}</td>
                  <td className="px-5 py-3.5 text-body-text">{episode.robot_id}</td>
                  <td className="max-w-[260px] truncate px-5 py-3.5 text-body-text">{episode.task_name}</td>
                  <td className="px-5 py-3.5 text-body-text">{new Date(episode.recorded_at).toLocaleDateString()}</td>
                  <td className="px-5 py-3.5">
                    <QualityBadge quality={episode.quality} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {isLoading ? <p className="px-5 py-8 text-center text-sm text-muted-text">Loading episodes…</p> : null}
          {!isLoading && episodes.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-text">No episodes are available yet.</p>
          ) : null}
          {episodes.length > recentEpisodes.length ? (
            <p className="border-t border-border px-5 py-3 text-xs text-muted-text">
              Showing the {recentEpisodes.length} most recent episodes of {episodes.length}.
            </p>
          ) : null}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Top tasks by good episodes</CardTitle>
          <CardDescription>Task labels with the highest number of good-quality recordings.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {analytics?.top_good_tasks.length ? (
            <div className="divide-y divide-border">
              {analytics.top_good_tasks.map((task, index) => (
                <div key={task.task_name} className="flex items-center gap-4 px-5 py-3.5 sm:px-6">
                  <span className="w-7 text-xs font-medium tabular-nums text-muted-text">{String(index + 1).padStart(2, "0")}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-brand-navy">{task.task_name}</span>
                  <span className="text-sm tabular-nums text-body-text">{task.good_episode_count} episodes</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="px-5 py-8 text-sm text-muted-text sm:px-6">No good-quality episode data is available yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function QualityBadge({ quality }: { quality: Episode["quality"] }) {
  const styles = {
    good: "border-status-good/25 bg-status-good/5 text-status-good",
    usable: "border-status-warning/25 bg-status-warning/5 text-status-warning",
    bad: "border-status-bad/25 bg-status-bad/5 text-status-bad",
  };

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${styles[quality]}`}>
      {quality}
    </span>
  );
}

function formatDuration(seconds: number | null) {
  if (seconds === null) return "—";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours) return `${hours}h ${minutes}m`;
  return `${minutes} min`;
}

"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { RequestStatusBadge } from "@/components/portal/request-status-badge";
import { createRequest, getRequests, updateRequestStatus } from "@/lib/api";
import type { RequestRecord } from "@/lib/types";

function displayDate(value?: string | null) {
  return value ? new Date(`${value}T00:00:00`).toLocaleDateString() : "No deadline";
}

export function ClientDashboard() {
  const { token, user } = useAuth();
  const [requests, setRequests] = useState<RequestRecord[]>([]);
  const [taskName, setTaskName] = useState("");
  const [episodesRequested, setEpisodesRequested] = useState(1);
  const [deadline, setDeadline] = useState("");
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const loadRequests = useCallback(async () => {
    if (!token) return;
    const data = await getRequests(token);
    setRequests(data);
  }, [token]);

  useEffect(() => {
    // Loading API state here is the effect's purpose; updates happen after the async response.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRequests()
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Unable to load requests."))
      .finally(() => setIsLoading(false));
  }, [loadRequests]);

  async function handleCreateRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;

    setError("");
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
      await loadRequests();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create request.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleReview(request: RequestRecord, status: "accepted" | "rejected") {
    if (!token) return;
    setError("");
    try {
      await updateRequestStatus(request.id, status, token);
      await loadRequests();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update this request.");
    }
  }

  const counts = requests.reduce(
    (result, request) => {
      result[request.status] += 1;
      return result;
    },
    { submitted: 0, in_progress: 0, delivered: 0, accepted: 0, rejected: 0 },
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-blue">Client portal</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Your dataset requests</h1>
          <p className="mt-2 text-slate-500">Create a collection request and review datasets when they are delivered.</p>
        </div>
        <p className="text-sm text-slate-500">Account: <span className="font-medium text-slate-700">{user?.email}</span></p>
      </div>

      {error ? <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div> : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {Object.entries(counts).map(([status, count]) => (
          <div key={status} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{status.replace("_", " ")}</p>
            <p className="mt-2 text-3xl font-semibold">{count}</p>
          </div>
        ))}
      </section>

      <section className="grid items-start gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <form onSubmit={handleCreateRequest} className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold">New dataset request</h2>
          <p className="mt-1 text-sm text-slate-500">Describe the task and how many episodes you need.</p>
          <div className="mt-5 space-y-4">
            <label className="block text-sm font-medium text-slate-700">
              Task name
              <input required maxLength={200} value={taskName} onChange={(event) => setTaskName(event.target.value)} className="mt-2 w-full rounded-lg border border-border px-3 py-2.5 font-normal outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/10" placeholder="e.g. Pick up the red mug" />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700">
                Episodes requested
                <input required type="number" min={1} value={episodesRequested} onChange={(event) => setEpisodesRequested(Math.max(1, Number(event.target.value)))} className="mt-2 w-full rounded-lg border border-border px-3 py-2.5 font-normal outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/10" />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Deadline
                <input type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} className="mt-2 w-full rounded-lg border border-border px-3 py-2.5 font-normal outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/10" />
              </label>
            </div>
            <label className="block text-sm font-medium text-slate-700">
              Notes <span className="font-normal text-slate-400">(optional)</span>
              <textarea rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-2 w-full resize-y rounded-lg border border-border px-3 py-2.5 font-normal outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/10" placeholder="Add data quality requirements or context…" />
            </label>
            <button disabled={isSubmitting} className="w-full rounded-lg bg-brand-blue px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-blue-hover disabled:opacity-60">
              {isSubmitting ? "Submitting…" : "Submit request"}
            </button>
          </div>
        </form>

        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Request history</h2>
              <p className="mt-1 text-sm text-slate-500">Track progress and review delivered work.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{requests.length} total</span>
          </div>
          {isLoading ? <p className="py-10 text-center text-sm text-slate-500">Loading requests…</p> : null}
          {!isLoading && requests.length === 0 ? <p className="py-10 text-center text-sm text-slate-500">No requests yet. Submit one to get started.</p> : null}
          <div className="mt-5 space-y-3">
            {requests.map((request) => (
              <article key={request.id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{request.task_name}</h3>
                    <p className="mt-1 text-sm text-slate-500">{request.episodes_requested} episodes · Deadline: {displayDate(request.deadline)}</p>
                  </div>
                  <RequestStatusBadge status={request.status} />
                </div>
                {request.notes ? <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">{request.notes}</p> : null}
                {request.status === "delivered" ? (
                  <div className="mt-4 flex gap-2 border-t border-slate-100 pt-3">
                    <button onClick={() => void handleReview(request, "accepted")} className="rounded-lg bg-status-good px-3 py-2 text-sm font-semibold text-white hover:brightness-95">Accept delivery</button>
                    <button onClick={() => void handleReview(request, "rejected")} className="rounded-lg border border-status-bad px-3 py-2 text-sm font-semibold text-status-bad hover:bg-status-bad/5">Request changes</button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      </section>
    </div>
  );
}

import type { AnalyticsResponse, ApiError, Episode, LoginPayload, RequestRecord, User } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

async function apiFetch<T>(path: string, init?: RequestInit, token?: string): Promise<T> {
  const headers = new Headers(init?.headers ?? {});
  headers.set("Content-Type", "application/json");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });

  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json") ? await response.json() : null;

  if (!response.ok) {
    const errorDetail = (payload as ApiError)?.detail ?? "Request failed";
    throw new Error(errorDetail);
  }

  return payload as T;
}

export async function loginUser(payload: LoginPayload) {
  const result = await apiFetch<{ access_token: string; token_type: string }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return result;
}

export async function getCurrentUser(token: string): Promise<User> {
  return apiFetch<User>("/api/auth/me", { method: "GET" }, token);
}

export async function getRequests(token: string): Promise<RequestRecord[]> {
  return apiFetch<RequestRecord[]>("/api/requests", { method: "GET" }, token);
}

export async function createRequest(input: {
  task_name: string;
  episodes_requested: number;
  deadline?: string;
  notes?: string;
}, token: string): Promise<RequestRecord> {
  return apiFetch<RequestRecord>("/api/requests", {
    method: "POST",
    body: JSON.stringify(input),
  }, token);
}

export async function updateRequestStatus(
  requestId: number,
  status: string,
  token: string,
): Promise<RequestRecord> {
  return apiFetch<RequestRecord>(`/api/requests/${requestId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  }, token);
}

export async function getEpisodes(token: string): Promise<Episode[]> {
  return apiFetch<Episode[]>("/api/episodes", { method: "GET" }, token);
}

export async function getAnalytics(token: string): Promise<AnalyticsResponse> {
  return apiFetch<AnalyticsResponse>("/api/analytics", { method: "GET" }, token);
}

export async function assignEpisodeToRequest(
  requestId: number,
  episodeId: number,
  token: string,
): Promise<{ id: number; request_id: number; episode_id: number; assigned_by: number }> {
  return apiFetch<{ id: number; request_id: number; episode_id: number; assigned_by: number }>(
    `/api/requests/${requestId}/episodes`,
    {
      method: "POST",
      body: JSON.stringify({ episode_id: episodeId }),
    },
    token,
  );
}

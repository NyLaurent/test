import type { AnalyticsResponse, ApiError, Episode, LoginPayload, RequestRecord, User, UserRole } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
export const AUTH_TOKEN_STORAGE_KEY = "dataset-request-desk-token";
export const AUTH_EXPIRED_EVENT = "dataset-request-desk:auth-expired";

export class ApiRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ApiRequestError";
  }
}

async function apiFetch<T>(path: string, init?: RequestInit, token?: string): Promise<T> {
  const headers = new Headers(init?.headers ?? {});
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
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
    const detail = (payload as ApiError | null)?.detail;
    const errorDetail = typeof detail === "string" ? detail : "Request failed";
    if (
      response.status === 401
      && token
      && typeof window !== "undefined"
      && window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) === token
    ) {
      window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
      window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT, { detail: errorDetail }));
    }
    throw new ApiRequestError(errorDetail, response.status);
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

export async function getAdminUsers(token: string): Promise<User[]> {
  return apiFetch<User[]>("/api/admin/users", { method: "GET" }, token);
}

export async function createAdminUser(
  input: { email: string; password: string; role: UserRole; full_name?: string },
  token: string,
): Promise<User> {
  return apiFetch<User>("/api/admin/users", { method: "POST", body: JSON.stringify(input) }, token);
}

export async function updateAdminUser(
  userId: number,
  input: { role?: UserRole; is_active?: boolean },
  token: string,
): Promise<User> {
  return apiFetch<User>(`/api/admin/users/${userId}`, { method: "PATCH", body: JSON.stringify(input) }, token);
}

export async function getRequests(token: string): Promise<RequestRecord[]> {
  return apiFetch<RequestRecord[]>("/api/requests", { method: "GET" }, token);
}

export async function createRequest(input: {
  task_name: string;
  episodes_requested: number;
  deadline?: string | null;
  notes?: string | null;
}, token: string): Promise<RequestRecord> {
  return apiFetch<RequestRecord>("/api/requests", {
    method: "POST",
    body: JSON.stringify(input),
  }, token);
}

export async function editRequest(
  requestId: number,
  input: {
    task_name?: string;
    episodes_requested?: number;
    deadline?: string | null;
    notes?: string | null;
  },
  token: string,
): Promise<RequestRecord> {
  return apiFetch<RequestRecord>(`/api/requests/${requestId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  }, token);
}

export async function deleteRequest(requestId: number, token: string): Promise<void> {
  await apiFetch<void>(`/api/requests/${requestId}`, { method: "DELETE" }, token);
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

export async function getEpisodes(
  token: string,
  filters: { taskName?: string; quality?: Episode["quality"]; availableOnly?: boolean } = {},
): Promise<Episode[]> {
  const searchParams = new URLSearchParams();
  if (filters.taskName) searchParams.set("task_name", filters.taskName);
  if (filters.quality) searchParams.set("quality", filters.quality);
  if (filters.availableOnly) searchParams.set("available_only", "true");
  const query = searchParams.size ? `?${searchParams.toString()}` : "";
  return apiFetch<Episode[]>(`/api/episodes${query}`, { method: "GET" }, token);
}

export async function importEpisodes(csvText: string, token: string) {
  return apiFetch<{
    total_rows: number;
    imported_count: number;
    skipped_count: number;
    reasons: string[];
  }>("/api/episodes/import", {
    method: "POST",
    headers: { "Content-Type": "text/csv" },
    body: csvText,
  }, token);
}

export async function getRequestEpisodes(requestId: number, token: string): Promise<Episode[]> {
  return apiFetch<Episode[]>(`/api/requests/${requestId}/episodes`, { method: "GET" }, token);
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

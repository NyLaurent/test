import type {
  AnalyticsResponse,
  ApiError,
  Episode,
  EpisodeImportSummary,
  EpisodePage,
  LoginPayload,
  RequestRecord,
  User,
  UserRole,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
export const AUTH_TOKEN_STORAGE_KEY = "dataset-request-desk-token";
export const REFRESH_TOKEN_STORAGE_KEY = "dataset-request-desk-refresh-token";
export const AUTH_EXPIRED_EVENT = "dataset-request-desk:auth-expired";
export const AUTH_TOKEN_REFRESHED_EVENT = "dataset-request-desk:token-refreshed";

export class ApiRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ApiRequestError";
  }
}

let refreshRequest: Promise<string | null> | null = null;

async function refreshAccessToken(rejectedAccessToken: string): Promise<string | null> {
  if (refreshRequest) return refreshRequest;

  const refresh = async (): Promise<string | null> => {
    const latestAccessToken = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
    if (latestAccessToken && latestAccessToken !== rejectedAccessToken) return latestAccessToken;

    const refreshToken = window.localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
    if (!refreshToken) {
      window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
      window.localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
      window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT, {
        detail: "Your session has expired. Please sign in again.",
      }));
      return null;
    }

    const response = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    const contentType = response.headers.get("content-type") ?? "";
    const payload = contentType.includes("application/json") ? await response.json() : null;
    if (!response.ok) {
      const currentAccessToken = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
      const currentRefreshToken = window.localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
      if (
        currentAccessToken !== rejectedAccessToken
        || currentRefreshToken !== refreshToken
      ) {
        return currentAccessToken;
      }
      const detail = (payload as ApiError | null)?.detail;
      if (response.status === 401) {
        window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
        window.localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
        window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT, {
          detail: typeof detail === "string" ? detail : "Your session has expired. Please sign in again.",
        }));
      }
      throw new ApiRequestError(typeof detail === "string" ? detail : "Could not refresh session", response.status);
    }

    const tokens = payload as { access_token: string; refresh_token: string };
    if (typeof tokens.access_token !== "string" || typeof tokens.refresh_token !== "string") {
      throw new ApiRequestError("The API returned an incomplete session", 502);
    }
    const currentAccessToken = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
    const currentRefreshToken = window.localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
    if (
      currentAccessToken !== rejectedAccessToken
      || currentRefreshToken !== refreshToken
    ) {
      return currentAccessToken;
    }
    window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, tokens.access_token);
    window.localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, tokens.refresh_token);
    window.dispatchEvent(new CustomEvent(AUTH_TOKEN_REFRESHED_EVENT, {
      detail: tokens.access_token,
    }));
    return tokens.access_token;
  };

  const crossTabRefresh: Promise<string | null> = typeof navigator !== "undefined" && navigator.locks
    ? navigator.locks.request<Promise<string | null>>(
      "dataset-request-desk:token-refresh",
      refresh,
    ).then((result) => result)
    : refresh();
  refreshRequest = crossTabRefresh;

  try {
    return await refreshRequest;
  } finally {
    refreshRequest = null;
  }
}

async function apiFetch<T>(path: string, init?: RequestInit, token?: string): Promise<T> {
  const headers = new Headers(init?.headers ?? {});
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let activeToken = token;
  if (activeToken && typeof window !== "undefined") {
    activeToken = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) ?? activeToken;
  }

  const send = (accessToken?: string) => {
    const requestHeaders = new Headers(headers);
    if (accessToken) requestHeaders.set("Authorization", `******`);
    return fetch(`${API_BASE}${path}`, { ...init, headers: requestHeaders });
  };

  let response = await send(activeToken);
  if (response.status === 401 && activeToken && typeof window !== "undefined") {
    const latestToken = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
    const replacementToken = latestToken && latestToken !== activeToken
      ? latestToken
      : await refreshAccessToken(activeToken);
    if (replacementToken) response = await send(replacementToken);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json") ? await response.json() : null;
  if (!response.ok) {
    const detail = (payload as ApiError | null)?.detail;
    throw new ApiRequestError(typeof detail === "string" ? detail : "Request failed", response.status);
  }
  return payload as T;
}

export async function loginUser(payload: LoginPayload) {
  const result = await apiFetch<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
  }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return result;
}

export async function logoutUser(refreshToken: string): Promise<void> {
  await apiFetch<void>("/api/auth/logout", {
    method: "POST",
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
}

export async function getCurrentUser(token: string): Promise<User> {
  if (!token.trim()) {
    throw new ApiRequestError("An access token is required to load the current user", 401);
  }
  return apiFetch<User>("/api/auth/me", {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  }, token);
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

export async function getEpisodePage(
  token: string,
  filters: {
    taskName?: string;
    quality?: Episode["quality"];
    limit?: number;
    offset?: number;
  } = {},
): Promise<EpisodePage> {
  const searchParams = new URLSearchParams({
    limit: String(filters.limit ?? 25),
    offset: String(filters.offset ?? 0),
  });
  if (filters.taskName) searchParams.set("task_name", filters.taskName);
  if (filters.quality) searchParams.set("quality", filters.quality);
  return apiFetch<EpisodePage>(`/api/episodes/page?${searchParams.toString()}`, { method: "GET" }, token);
}

export async function importEpisodes(csvText: string, token: string) {
  return apiFetch<EpisodeImportSummary>("/api/episodes/import", {
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

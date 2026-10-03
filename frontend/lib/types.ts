export type UserRole = "client" | "operator" | "admin";

export type RequestStatus =
  | "submitted"
  | "in_progress"
  | "delivered"
  | "accepted"
  | "rejected";

export type EpisodeQuality = "good" | "usable" | "bad";

export interface User {
  id: number;
  email: string;
  role: UserRole;
  is_active: boolean;
  full_name?: string | null;
}

export interface RequestRecord {
  id: number;
  client_id: number;
  task_name: string;
  episodes_requested: number;
  deadline?: string | null;
  notes?: string | null;
  status: RequestStatus;
}

export interface Episode {
  id: number;
  episode_id: string;
  robot_id: string;
  task_name: string;
  recorded_at: string;
  duration_seconds: number;
  operator_name: string;
  quality: EpisodeQuality;
}

export interface EpisodePage {
  items: Episode[];
  total: number;
  limit: number;
  offset: number;
}

export interface EpisodeImportIssue {
  line_number: number;
  reason: string;
}

export interface EpisodeImportSummary {
  total_rows: number;
  imported_count: number;
  skipped_count: number;
  reasons: string[];
  skipped_rows: EpisodeImportIssue[];
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AnalyticsResponse {
  episodes_by_day_robot: Array<{
    recorded_date: string;
    robot_id: string;
    episode_count: number;
  }>;
  request_fulfilment: Array<{
    status: RequestStatus;
    request_count: number;
  }>;
  median_delivery_seconds: number | null;
  top_good_tasks: Array<{
    task_name: string;
    good_episode_count: number;
  }>;
}

export interface ApiError {
  detail?: string;
  message?: string;
}

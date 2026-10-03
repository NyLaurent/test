"use client";

import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AnalyticsResponse, RequestStatus } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type MetricCardProps = {
  label: string;
  value: string | number;
  detail: string;
  icon: ComponentType<LucideProps>;
  tone?: "blue" | "cyan" | "green" | "orange" | "purple";
};

const toneStyles = {
  blue: "bg-brand-soft-blue text-brand-blue",
  cyan: "bg-cyan-50 text-cyan-700",
  green: "bg-green-50 text-status-good",
  orange: "bg-amber-50 text-status-warning",
  purple: "bg-violet-50 text-status-delivered",
};

export function MetricCard({ label, value, detail, icon: Icon, tone = "blue" }: MetricCardProps) {
  return (
    <Card className="min-w-0">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm text-muted-text">{label}</p>
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${toneStyles[tone]}`}>
            <Icon aria-hidden="true" size={19} strokeWidth={1.8} />
          </span>
        </div>
        <p className="mt-4 text-3xl font-semibold tracking-tight text-brand-navy">{value}</p>
        <p className="mt-1 text-xs text-muted-text">{detail}</p>
      </CardContent>
    </Card>
  );
}

const statusColors: Record<RequestStatus, string> = {
  submitted: "#64748B",
  in_progress: "#2563EB",
  delivered: "#7C3AED",
  accepted: "#16A34A",
  rejected: "#DC2626",
};

type DailyEpisodesChartProps = {
  analytics: AnalyticsResponse | null;
};

export function DailyEpisodesChart({ analytics }: DailyEpisodesChartProps) {
  const robotIds = [...new Set(analytics?.episodes_by_day_robot.map((item) => item.robot_id) ?? [])].sort();
  const byDate = new Map<string, Record<string, string | number>>();

  for (const item of analytics?.episodes_by_day_robot ?? []) {
    const day = byDate.get(item.recorded_date) ?? { date: item.recorded_date };
    day[item.robot_id] = item.episode_count;
    byDate.set(item.recorded_date, day);
  }

  const chartData = [...byDate.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const robotPalette = ["#2563EB", "#06B6D4", "#7C3AED", "#16A34A", "#D97706"];

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Episodes recorded</CardTitle>
        <CardDescription>Daily episode volume, grouped by robot.</CardDescription>
      </CardHeader>
      <CardContent className="min-w-0">
        {chartData.length === 0 ? (
          <EmptyChart>No episode analytics are available yet.</EmptyChart>
        ) : (
          <>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#E2E8F0" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value: string) => formatChartDate(value)}
                    tick={{ fill: "#64748B", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    minTickGap={24}
                  />
                  <YAxis allowDecimals={false} tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    labelFormatter={(value) => formatChartDate(String(value), true)}
                    contentStyle={{ border: "1px solid #E2E8F0", borderRadius: 10, boxShadow: "none", fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
                  {robotIds.map((robotId, index) => (
                    <Bar
                      key={robotId}
                      dataKey={robotId}
                      name={robotId}
                      stackId="episodes"
                      fill={robotPalette[index % robotPalette.length]}
                      radius={index === robotIds.length - 1 ? [4, 4, 0, 0] : undefined}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function RequestStatusChart({
  data,
}: {
  data: AnalyticsResponse["request_fulfilment"];
}) {
  const total = data.reduce((sum, item) => sum + item.request_count, 0);

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Request status</CardTitle>
        <CardDescription>Requests grouped by their current workflow status.</CardDescription>
      </CardHeader>
      <CardContent className="min-w-0">
        {data.length === 0 || total === 0 ? (
          <EmptyChart>No request status data is available yet.</EmptyChart>
        ) : (
          <div className="grid items-center gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(130px,0.8fr)]">
            <div className="relative mx-auto h-[220px] w-full max-w-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="request_count"
                    nameKey="status"
                    innerRadius={62}
                    outerRadius={88}
                    paddingAngle={3}
                    stroke="none"
                  >
                    {data.map((item) => (
                      <Cell key={item.status} fill={statusColors[item.status]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [value, String(name).replace("_", " ")]}
                    contentStyle={{ border: "1px solid #E2E8F0", borderRadius: 10, boxShadow: "none", fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-semibold text-brand-navy">{total}</span>
                <span className="text-xs text-muted-text">requests</span>
              </div>
            </div>
            <div className="space-y-3">
              {data.map((item) => (
                <div key={item.status} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2 text-body-text">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: statusColors[item.status] }} />
                    <span className="truncate capitalize">{item.status.replace("_", " ")}</span>
                  </span>
                  <span className="font-medium tabular-nums text-brand-navy">{item.request_count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function RequestWorkflowChart({
  data,
}: {
  data: AnalyticsResponse["request_fulfilment"];
}) {
  const chartData = data.map((item) => ({
    ...item,
    label: item.status.replace("_", " "),
  }));

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Request pipeline</CardTitle>
        <CardDescription>How your requests are moving through the workflow.</CardDescription>
      </CardHeader>
      <CardContent className="min-w-0">
        {chartData.length === 0 || chartData.every((item) => item.request_count === 0) ? (
          <EmptyChart>No request activity to chart yet.</EmptyChart>
        ) : (
          <div className="h-[260px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 4, right: 20, left: 4, bottom: 4 }}
              >
                <CartesianGrid horizontal={false} stroke="#E2E8F0" strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fill: "#64748B", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={86}
                  tick={{ fill: "#334155", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value: string) => value.replace(/^\w/, (letter) => letter.toUpperCase())}
                />
                <Tooltip
                  formatter={(value) => [value, "Requests"]}
                  contentStyle={{ border: "1px solid #E2E8F0", borderRadius: 10, boxShadow: "none", fontSize: 12 }}
                />
                <Bar dataKey="request_count" name="Requests" radius={[0, 5, 5, 0]} barSize={21}>
                  {chartData.map((item) => (
                    <Cell key={item.status} fill={statusColors[item.status]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyChart({ children }: { children: string }) {
  return <div className="flex h-[220px] items-center justify-center text-center text-sm text-muted-text">{children}</div>;
}

function formatChartDate(value: string, full = false) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", full ? { month: "short", day: "numeric", year: "numeric" } : { month: "short", day: "numeric" }).format(date);
}

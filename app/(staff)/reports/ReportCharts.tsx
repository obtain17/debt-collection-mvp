"use client";

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CLAIM_STATUS_LABEL, RISK_TIER_LABEL } from "@/lib/format";

const RISK_COLORS: Record<string, string> = {
  LOW: "#10b981",
  MEDIUM: "#f59e0b",
  HIGH: "#f97316",
  CRITICAL: "#dc2626",
  UNANALYZED: "#cbd5e1",
};

export function StatusFunnelChart({ data }: { data: Array<{ status: string; count: number }> }) {
  const chartData = data.map((d) => ({ name: CLAIM_STATUS_LABEL[d.status] ?? d.status, 件数: d.count }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" fontSize={12} />
        <YAxis allowDecimals={false} fontSize={12} />
        <Tooltip />
        <Bar dataKey="件数" fill="#334155" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function RiskDistributionChart({ data }: { data: Array<{ riskTier: string; count: number }> }) {
  const chartData = data.map((d) => ({
    name: RISK_TIER_LABEL[d.riskTier] ?? "未分析",
    value: d.count,
    key: d.riskTier,
  }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={chartData} dataKey="value" nameKey="name" outerRadius={90} label>
          {chartData.map((entry) => (
            <Cell key={entry.key} fill={RISK_COLORS[entry.key] ?? "#94a3b8"} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}

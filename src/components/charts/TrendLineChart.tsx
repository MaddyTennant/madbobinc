"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TrendPoint } from "@/lib/analytics/aggregate";
import { formatCurrency } from "@/lib/format";

const SPEND_COLOR = "#2a78d6"; // categorical slot 1 — "Spend" identity, fixed everywhere
const REVENUE_COLOR = "#1baf7a"; // categorical slot 3 — "Revenue" identity, fixed everywhere

export function TrendLineChart({ data, currency }: { data: TrendPoint[]; currency: string }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid stroke="#e1e0d9" vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "#c3c2b7" }} tick={{ fill: "#898781", fontSize: 12 }} />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fill: "#898781", fontSize: 12 }}
          tickFormatter={(v: number) => formatCurrency(v, currency)}
          width={80}
        />
        <Tooltip
          formatter={(value: number) => formatCurrency(value, currency)}
          contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: "#e1e0d9" }}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: "#52514e" }} />
        <Line type="monotone" dataKey="spend" name="Spend" stroke={SPEND_COLOR} strokeWidth={2} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="revenue" name="Revenue" stroke={REVENUE_COLOR} strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

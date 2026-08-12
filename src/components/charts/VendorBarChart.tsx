"use client";

import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { VendorSlice } from "@/lib/analytics/aggregate";
import { formatCurrency } from "@/lib/format";
import { SEQUENTIAL_BLUE } from "@/lib/colors";

export function VendorBarChart({ data, currency }: { data: VendorSlice[]; currency: string }) {
  if (data.length === 0) return <p className="text-sm text-slate-500">No vendor spend recorded this month yet.</p>;

  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 36)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 56, left: 8, bottom: 4 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          width={150}
          tickLine={false}
          axisLine={false}
          tick={{ fill: "#52514e", fontSize: 12 }}
        />
        <Tooltip
          cursor={{ fill: "#f0efec" }}
          formatter={(value: number) => formatCurrency(value, currency)}
          contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: "#e1e0d9" }}
        />
        <Bar dataKey="amount" radius={[0, 4, 4, 0]} barSize={16} fill={SEQUENTIAL_BLUE}>
          <LabelList
            dataKey="amount"
            position="right"
            formatter={(value: number) => formatCurrency(value, currency)}
            style={{ fill: "#52514e", fontSize: 11 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

"use client";

import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { BudgetComparison } from "@/lib/analytics/aggregate";
import { formatCurrency } from "@/lib/format";
import { STATUS_COLORS } from "@/lib/colors";

const BUDGET_COLOR = "#c3c2b7"; // neutral reference bar — the plan, not a series identity

function actualColor(actual: number, budget: number): string {
  if (budget <= 0) return STATUS_COLORS.good;
  const ratio = actual / budget;
  if (ratio <= 1) return STATUS_COLORS.good;
  if (ratio <= 1.1) return STATUS_COLORS.warning;
  return STATUS_COLORS.critical;
}

export function BudgetVsActualChart({ data, currency }: { data: BudgetComparison[]; currency: string }) {
  if (data.length === 0) return <p className="text-sm text-stone-500">No budgets set for this month yet.</p>;

  return (
    <div>
      <ResponsiveContainer width="100%" height={Math.max(200, data.length * 40)}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
          <CartesianGrid stroke="#e1e0d9" horizontal={false} />
          <XAxis type="number" tickFormatter={(v: number) => formatCurrency(v, currency)} tick={{ fill: "#898781", fontSize: 11 }} />
          <YAxis type="category" dataKey="label" width={110} tickLine={false} axisLine={false} tick={{ fill: "#52514e", fontSize: 12 }} />
          <Tooltip formatter={(value: number) => formatCurrency(value, currency)} contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: "#e1e0d9" }} />
          <Legend
            wrapperStyle={{ fontSize: 12, color: "#52514e" }}
            payload={[
              { value: "Budget", type: "square", color: BUDGET_COLOR },
              { value: "Actual (green ≤ budget, amber near limit, red over)", type: "square", color: STATUS_COLORS.critical },
            ]}
          />
          <Bar dataKey="budget" name="Budget" fill={BUDGET_COLOR} barSize={12} radius={[0, 4, 4, 0]} />
          <Bar dataKey="actual" name="Actual" barSize={12} radius={[0, 4, 4, 0]}>
            {data.map((entry) => (
              <Cell key={entry.key} fill={actualColor(entry.actual, entry.budget)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

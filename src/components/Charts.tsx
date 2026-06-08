"use client";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList,
  PieChart, Pie, Legend,
} from "recharts";

/**
 * Horizontal bar chart used in the on-screen Results panel.
 *
 * Labels default to "In-house" / "Indecomm" but are overridable so the panel
 * can switch the right-hand label to "Post-Outsourcing + Retention Staff"
 * when retention is enabled, or "After (Y2)" for SaaS, etc.
 *
 * The right bar's color also defaults to AuditGenius orange but can be
 * overridden so each product family (DocGenius purple, DecisionGenius deep
 * blue, IDXGenius light blue) gets its own brand color.
 */
export function ComparisonBar({
  internal,
  outsourced,
  leftLabel = "In-house",
  rightLabel = "Indecomm",
  rightColor = "#F1A421",
  cursorColor,
}: {
  internal: number;
  outsourced: number;
  leftLabel?: string;
  rightLabel?: string;
  rightColor?: string;
  /** Optional override for the tooltip cursor color (defaults to a faded right-bar tint). */
  cursorColor?: string;
}) {
  const data = [
    { name: leftLabel, value: internal },
    { name: rightLabel, value: outsourced },
  ];
  // Faded cursor color based on rightColor (e.g., "#F1A421" → "#F1A42120").
  const cursor = cursorColor ?? `${rightColor}20`;
  // YAxis needs more width when labels are long.
  const labelWidth = Math.max(leftLabel.length, rightLabel.length) > 14 ? 170 : 90;
  return (
    <div className="h-44">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 12, right: 60, top: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis type="number" tickFormatter={(v) => `$${Number(v).toFixed(0)}`} stroke="#64748b" fontSize={11} />
          <YAxis type="category" dataKey="name" stroke="#1B2440" fontSize={12} width={labelWidth} />
          <Tooltip formatter={(v: number) => `$${v.toFixed(2)} / loan`} cursor={{ fill: cursor }} />
          <Bar dataKey="value" radius={[0, 6, 6, 0]}>
            <Cell fill="#002060" />
            <Cell fill={rightColor} />
            <LabelList
              dataKey="value"
              position="right"
              formatter={(v: number) => `$${v.toFixed(2)}`}
              fill="#002060"
              fontWeight={700}
              fontSize={12}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CostBreakdownPie({
  direct, supervisor, benefits, indirect, height = 220,
}: { direct: number; supervisor: number; benefits: number; indirect: number; height?: number }) {
  const data = [
    { name: "Direct Labor", value: direct, color: "#002060" },
    { name: "Supervisor", value: supervisor, color: "#2076BA" },
    { name: "Benefits & Taxes", value: benefits, color: "#2BA8E0" },
    { name: "Indirect (Hidden)", value: indirect, color: "#F1A421" },
  ];
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={35}
            outerRadius={60}
            paddingAngle={2}
          >
            {data.map((d, i) => <Cell key={i} fill={d.color} />)}
          </Pie>
          <Tooltip formatter={(v: number) => `$${Math.round(v).toLocaleString()}`} />
          <Legend wrapperStyle={{ fontSize: 10 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

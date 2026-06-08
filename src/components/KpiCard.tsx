"use client";

type Props = {
  label: string;
  value: string;
  sub?: string;
  /**
   * "default"  = white card with navy text (client/in-house side)
   * "indecomm" = cream card with orange border (Indecomm side)
   * "primary"  = solid orange highlight (the savings KPI)
   */
  emphasis?: "default" | "indecomm" | "primary";
};

export function KpiCard({ label, value, sub, emphasis = "default" }: Props) {
  let containerCls = "bg-white text-navy border-slate-200";
  let labelCls = "text-slate-500";
  let subCls = "text-slate-500";
  let valueSize = "text-2xl";

  if (emphasis === "primary") {
    containerCls = "bg-orange text-navy border-orange";
    labelCls = "text-navy/70";
    subCls = "text-navy/70";
    valueSize = "text-3xl";
  } else if (emphasis === "indecomm") {
    containerCls = "bg-orange/10 text-navy border-2 border-orange";
    labelCls = "text-orange";
    subCls = "text-navy/70";
  }

  return (
    <div className={["rounded-xl px-4 py-4 border shadow-card", containerCls].join(" ")}>
      <div className={["text-xs uppercase tracking-wider font-semibold", labelCls].join(" ")}>{label}</div>
      <div className={["mt-1 font-bold", valueSize].join(" ")}>{value}</div>
      {sub && <div className={["text-xs mt-1", subCls].join(" ")}>{sub}</div>}
    </div>
  );
}

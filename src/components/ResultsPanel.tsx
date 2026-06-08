"use client";
import { useScenario } from "@/store/scenarioStore";
import { computeRoi } from "@/lib/engine";
import { fmtCurrency, fmtCurrencyPrecise, fmtPercent } from "@/lib/format";
import { KpiCard } from "./KpiCard";
import { ComparisonBar } from "./Charts";

export function ResultsPanel() {
  const model = useScenario((s) => s.model);
  const inputs = useScenario((s) => s.inputs);
  if (!model) return null;
  const r = computeRoi(model, inputs);
  const retentionOn = r.retention.enabled;
  // When retention is ON, both the KPI card label and the bar chart's right-hand
  // axis label change to "Post-Outsourcing + Retention Staff" so the comparison
  // explicitly accounts for the retained team.
  const rightLabel = retentionOn ? "Post-Outsourcing + Retention Staff" : "Indecomm";

  return (
    <aside className="space-y-4 lg:sticky lg:top-6 self-start">
      {/* HERO: ROI % */}
      <div className="rounded-xl shadow-card border-4 border-orange bg-orange/10 px-5 py-4">
        <div className="text-xs uppercase tracking-wider font-bold text-navy/70">Return on Investment</div>
        <div className="flex items-baseline justify-between mt-1">
          <div className="text-5xl font-extrabold text-navy">{fmtPercent(r.savingsPct, 1)}</div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-navy/60">Annual Savings</div>
            <div className="text-xl font-bold text-navy">{fmtCurrency(r.annualSavings)}</div>
          </div>
        </div>
        <div className="text-xs mt-1 text-navy/70">Savings per loan: <strong>{fmtCurrencyPrecise(r.perLoanSavings)}</strong></div>
      </div>

      {/* Annual cost cards — client side (navy) vs Indecomm side (orange accent).
          When retention is ON, the Indecomm card becomes "Post-Outsourcing Total" and
          a small retained-staff breakdown appears below it. */}
      <div className="grid grid-cols-2 gap-3">
        <KpiCard
          label="Your In-house Annual"
          value={fmtCurrency(r.internal.totalAnnual)}
          sub={`Avg cost/loan: ${fmtCurrencyPrecise(r.perLoanInternal)}`}
        />
        <KpiCard
          label={retentionOn ? "Post-Outsourcing + Retention Staff" : "Indecomm Annual"}
          value={fmtCurrency(retentionOn ? r.postOutsourcingAnnual : r.outsourced.totalAnnual)}
          sub={`Avg cost/loan: ${fmtCurrencyPrecise(r.perLoanOutsourced)}`}
          emphasis="indecomm"
        />
      </div>

      {retentionOn && (
        <div className="bg-white rounded-xl shadow-card border border-orange/30 p-3 text-xs">
          <div className="text-[10px] uppercase tracking-wider font-bold text-orange mb-1">Post-outsourcing breakdown</div>
          <div className="flex justify-between text-navy/80 py-0.5">
            <span>Indecomm fee</span>
            <strong>{fmtCurrency(r.outsourced.totalAnnual)}</strong>
          </div>
          <div className="flex justify-between text-navy/80 py-0.5">
            <span>Retained in-house staff</span>
            <strong>{fmtCurrency(r.retention.totalAnnual)}</strong>
          </div>
          <div className="flex justify-between text-navy border-t border-slate-200 mt-1 pt-1">
            <span className="font-bold">Total post-outsourcing</span>
            <strong>{fmtCurrency(r.postOutsourcingAnnual)}</strong>
          </div>
        </div>
      )}

      {/* Comparison bar with $ labels. Right-bar color uses the active model's
          accent so DocGenius/AuditGenius/etc. read distinctively on screen. */}
      <div className="bg-white rounded-xl shadow-card border border-slate-200 p-4">
        <h4 className="text-sm font-bold text-navy mb-2">Per-loan cost comparison</h4>
        <ComparisonBar
          internal={r.perLoanInternal}
          outsourced={r.perLoanOutsourced}
          rightLabel={rightLabel}
          rightColor={model.platform.accentHex}
        />
      </div>
    </aside>
  );
}

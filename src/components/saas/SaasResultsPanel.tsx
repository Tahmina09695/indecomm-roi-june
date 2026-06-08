"use client";
import { useSaasScenario } from "@/store/saasScenarioStore";
import { computeSaasRoi } from "@/lib/saas-engine";
import { fmtCurrency, fmtCurrencyPrecise, fmtPercent } from "@/lib/format";
import { ComparisonBar } from "../Charts";

export function SaasResultsPanel() {
  const model = useSaasScenario((s) => s.model);
  const inputs = useSaasScenario((s) => s.inputs);
  if (!model) return null;
  const r = computeSaasRoi(model, inputs);
  const accent = model.platform.accentHex;
  const savingsFirst = model.displayPreference === "savings-first";

  return (
    <aside className="space-y-4 lg:sticky lg:top-6 self-start">
      {/* Hero — varies based on model.displayPreference. */}
      {savingsFirst ? (
        <div className="rounded-xl shadow-card border-4 px-5 py-4" style={{ borderColor: accent, background: `${accent}15` }}>
          <div className="text-xs uppercase tracking-wider font-bold text-navy/70">Annual Savings</div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-navy/60">Year 1</div>
              <div className="text-3xl font-extrabold text-navy">{fmtCurrency(r.year1.savings)}</div>
              <div className="text-xs text-navy/70 mt-0.5">{fmtPercent(r.year1.savingsPct, 1)} of current cost</div>
            </div>
            <div className="border-l pl-3" style={{ borderColor: `${accent}55` }}>
              <div className="text-[10px] uppercase tracking-wider text-navy/60">Year 2</div>
              <div className="text-3xl font-extrabold" style={{ color: accent }}>{fmtCurrency(r.year2.savings)}</div>
              <div className="text-xs text-navy/70 mt-0.5">{fmtPercent(r.year2.savingsPct, 1)} of current cost</div>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t text-xs text-navy/70" style={{ borderColor: `${accent}33` }}>
            FTEs reduced: <strong>{r.internal.fteSaved.toFixed(1)}</strong> ({r.internal.totalFTEBefore.toFixed(1)} → {r.internal.totalFTEAfter.toFixed(1)}) · Pays back on day one.
          </div>
        </div>
      ) : (
        <div className="rounded-xl shadow-card border-4 px-5 py-4" style={{ borderColor: accent, background: `${accent}15` }}>
          <div className="text-xs uppercase tracking-wider font-bold text-navy/70">Return on Investment</div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-navy/60">Year 1 ROI</div>
              <div className="text-3xl font-extrabold text-navy">{fmtPercent(r.year1.roiPct, 0)}</div>
              <div className="text-xs text-navy/70 mt-0.5">Save {fmtCurrency(r.year1.savings)}</div>
            </div>
            <div className="border-l pl-3" style={{ borderColor: `${accent}55` }}>
              <div className="text-[10px] uppercase tracking-wider text-navy/60">Year 2 ROI</div>
              <div className="text-3xl font-extrabold" style={{ color: accent }}>{fmtPercent(r.year2.roiPct, 0)}</div>
              <div className="text-xs text-navy/70 mt-0.5">Save {fmtCurrency(r.year2.savings)}</div>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t flex justify-between text-xs" style={{ borderColor: `${accent}33` }}>
            <span className="text-navy/70">Savings %: <strong>Y1 {fmtPercent(r.year1.savingsPct, 0)}</strong> · <strong>Y2 {fmtPercent(r.year2.savingsPct, 0)}</strong></span>
          </div>
        </div>
      )}

      {/* Annual cost cards - Before vs After */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl px-4 py-4 border border-slate-200 bg-white shadow-card">
          <div className="text-xs uppercase tracking-wider font-semibold text-slate-500">Annual Before</div>
          <div className="text-2xl font-bold text-navy mt-1">{fmtCurrency(r.internal.annualBefore)}</div>
          <div className="text-xs text-slate-500 mt-1">Cost/loan: {fmtCurrencyPrecise(r.perLoanBefore)}</div>
        </div>
        <div className="rounded-xl px-4 py-4 border-2 shadow-card" style={{ borderColor: accent, background: `${accent}15` }}>
          <div className="text-xs uppercase tracking-wider font-semibold" style={{ color: accent }}>Annual After (Y2)</div>
          <div className="text-2xl font-bold text-navy mt-1">{fmtCurrency(r.internal.annualAfter + r.platform.year2Spend)}</div>
          <div className="text-xs text-slate-500 mt-1">Cost/loan: {fmtCurrencyPrecise(r.perLoanAfter)}</div>
        </div>
      </div>

      {/* Comparison bar (steady-state Y2). Uses Before/After labels and the
          product's accent color so IDX = light blue, DG = deep blue. */}
      <div className="bg-white rounded-xl shadow-card border border-slate-200 p-4">
        <h4 className="text-sm font-bold text-navy mb-2">Per-loan cost comparison (Year 2 steady state)</h4>
        <ComparisonBar
          internal={r.perLoanBefore}
          outsourced={r.perLoanAfter}
          leftLabel="Before"
          rightLabel="After (Y2)"
          rightColor={model.platform.accentHex}
        />
      </div>
    </aside>
  );
}

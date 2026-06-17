"use client";
import { useSaasScenario } from "@/store/saasScenarioStore";
import { InputSection, NumberInput, PercentInput } from "../InputSection";
import { computeSaasRoi } from "@/lib/saas-engine";
import { fmtCurrency, fmtFTE, fmtPercent } from "@/lib/format";

/**
 * Before vs After roles table — the heart of the SaaS calculator.
 *
 * Column order is deliberate: it leads with productivity (the lever) before
 * cost. Improvement % sits next to Baseline so the math reads naturally —
 * "baseline × improvement = improved productivity", THEN the human cost.
 *
 * Tone:
 *   - default — "FTEs Saved" / "headcount reduction" language
 *   - "capacity-freed" — softer framing ("Capacity Freed",
 *     "redeployable FTEs"). Set via model.tone for clients sensitive to
 *     layoff language (e.g., NFCU).
 */
export function SaasRolesTable() {
  const model = useSaasScenario((s) => s.model);
  const inputs = useSaasScenario((s) => s.inputs);
  const setRole = useSaasScenario((s) => s.setRole);
  if (!model) return null;
  const r = computeSaasRoi(model, inputs);
  const capacityFreed = model.tone === "capacity-freed";

  // Tone-aware label set.
  const labels = capacityFreed
    ? {
        sectionTitle: "Productivity Impact by Role",
        sectionSubtitle: "How much each role's productivity improves with the platform",
        callout: (
          <>
            <strong>How this works:</strong> The platform increases each
            role&apos;s productivity by the % shown. Each team handles the
            same volume with fewer hands required — freeing capacity that
            can be redeployed to higher-value work (exception management,
            growth volume, new product lines, etc.).
          </>
        ),
        savedColumn: "Capacity Freed",
        savedCard: "FTE Capacity Freed",
        savedCardSub: "Redeployable to higher-value work",
      }
    : {
        sectionTitle: "Productivity Impact by Role",
        sectionSubtitle: "How many FTEs you need before and after the platform",
        callout: (
          <>
            <strong>How this works:</strong> The platform increases each
            role&apos;s productivity by the % shown. With higher
            productivity, fewer FTEs are needed for the same volume — the
            savings come from headcount reduction (or redeployment).
          </>
        ),
        savedColumn: "Saved",
        savedCard: "FTEs Saved",
        savedCardSub: "",
      };

  return (
    <InputSection
      title={labels.sectionTitle}
      subtitle={labels.sectionSubtitle}
      defaultOpen
      callout={labels.callout}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="py-2 pr-3">Role</th>
              <th className="py-2 pr-3">Baseline Productivity</th>
              <th className="py-2 pr-3">Improvement %</th>
              <th className="py-2 pr-3" style={{ color: model.platform.accentHex }}>Improved Productivity</th>
              <th className="py-2 pr-3">Hourly Rate</th>
              <th className="py-2 pr-3 text-right">FTEs Before</th>
              <th className="py-2 pr-3 text-right" style={{ color: model.platform.accentHex }}>FTEs After</th>
              <th className="py-2 text-right">{labels.savedColumn}</th>
            </tr>
          </thead>
          <tbody>
            {model.roles.map((role) => {
              const ri = inputs.roles[role.id];
              const breakdown = r.internal.roles.find((d) => d.roleId === role.id)!;
              const baseline = ri?.baselineProductivity ?? role.defaultBaselineProductivity;
              const lift = ri?.improvementPct ?? role.defaultImprovementPct;
              // Improved Productivity — derived from baseline × (1+lift), shown
              // as read-only so users see the math without being able to
              // edit a redundant field.
              const improved = baseline * (1 + lift);
              const basisLabel = role.productivityBasis === "perDay" ? "day" : "month";
              return (
                <tr key={role.id} className="border-t border-slate-200">
                  <td className="py-2 pr-3 align-top">
                    <div className="font-semibold text-navy">{role.label}</div>
                    <div className="text-xs text-slate-500">loans / FTE / {basisLabel}</div>
                  </td>
                  <td className="py-2 pr-3">
                    <NumberInput
                      value={baseline}
                      onChange={(n) => setRole(role.id, { baselineProductivity: n })}
                      step={0.5}
                      min={0}
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <PercentInput
                      value={lift}
                      onChange={(n) => setRole(role.id, { improvementPct: n })}
                    />
                  </td>
                  <td className="py-2 pr-3 align-middle">
                    {/* Derived (read-only) — visually styled to mirror the
                        input column width so the table reads as a clean grid. */}
                    <div
                      className="px-3 py-1.5 rounded-md border text-sm font-bold"
                      style={{
                        background: `${model.platform.accentHex}10`,
                        borderColor: `${model.platform.accentHex}55`,
                        color: model.platform.accentHex,
                      }}
                      title={`Baseline × (1 + improvement %) = ${baseline} × ${(1 + lift).toFixed(2)} = ${improved.toFixed(2)}`}
                    >
                      {improved.toFixed(2)} <span className="text-[10px] font-normal text-slate-500">/ {basisLabel}</span>
                    </div>
                  </td>
                  <td className="py-2 pr-3">
                    <NumberInput
                      value={ri?.hourlyRate ?? role.defaultHourlyRate}
                      onChange={(n) => setRole(role.id, { hourlyRate: n })}
                      prefix="$"
                      step={1}
                      min={0}
                    />
                  </td>
                  <td className="py-2 pr-3 text-right font-semibold text-navy">{fmtFTE(breakdown.fteBefore)}</td>
                  <td className="py-2 pr-3 text-right font-semibold" style={{ color: model.platform.accentHex }}>{fmtFTE(breakdown.fteAfter)}</td>
                  <td className="py-2 text-right font-bold text-green">{fmtFTE(breakdown.fteBefore - breakdown.fteAfter)}</td>
                </tr>
              );
            })}
            <tr className="border-t-2 border-navy bg-navy/5">
              <td className="py-3 pr-3 text-sm uppercase tracking-wide font-bold text-navy">Total Direct FTEs</td>
              <td colSpan={4} />
              <td className="py-3 pr-3 text-right font-bold text-navy">{fmtFTE(r.internal.roles.reduce((s, x) => s + x.fteBefore, 0))}</td>
              <td className="py-3 pr-3 text-right font-bold" style={{ color: model.platform.accentHex }}>{fmtFTE(r.internal.roles.reduce((s, x) => s + x.fteAfter, 0))}</td>
              <td className="py-3 text-right font-bold text-green">{fmtFTE(r.internal.roles.reduce((s, x) => s + (x.fteBefore - x.fteAfter), 0))}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
        <div className="bg-navy/5 border border-navy/20 rounded-md px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider font-bold text-navy/70">Direct Cost Before</div>
          <div className="text-lg font-bold text-navy">{fmtCurrency(r.internal.directTotalBefore)}</div>
        </div>
        <div className="rounded-md px-3 py-2 border-2" style={{ background: `${model.platform.accentHex}15`, borderColor: model.platform.accentHex }}>
          <div className="text-[10px] uppercase tracking-wider font-bold" style={{ color: model.platform.accentHex }}>Direct Cost After</div>
          <div className="text-lg font-bold text-navy">{fmtCurrency(r.internal.directTotalAfter)}</div>
        </div>
        <div className="bg-green/20 border border-green/60 rounded-md px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider font-bold text-navy/70">{labels.savedCard}</div>
          <div className="text-lg font-bold text-navy">
            {fmtFTE(r.internal.fteSaved)}
            <span className="text-xs font-normal text-slate-600">
              {" "}({fmtPercent(r.internal.totalFTEBefore > 0 ? r.internal.fteSaved / r.internal.totalFTEBefore : 0)})
            </span>
          </div>
          {labels.savedCardSub && (
            <div className="text-[10px] text-slate-600 mt-0.5">{labels.savedCardSub}</div>
          )}
        </div>
      </div>
    </InputSection>
  );
}

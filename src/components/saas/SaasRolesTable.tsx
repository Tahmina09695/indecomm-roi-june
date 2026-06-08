"use client";
import { useSaasScenario } from "@/store/saasScenarioStore";
import { InputSection, NumberInput, PercentInput } from "../InputSection";
import { computeSaasRoi } from "@/lib/saas-engine";
import { fmtCurrency, fmtFTE, fmtPercent } from "@/lib/format";

/**
 * Before vs After roles table — the heart of the SaaS calculator.
 * Each row shows baseline productivity, hourly rate, improvement %, and the
 * resulting Before/After FTE & cost numbers.
 */
export function SaasRolesTable() {
  const model = useSaasScenario((s) => s.model);
  const inputs = useSaasScenario((s) => s.inputs);
  const setRole = useSaasScenario((s) => s.setRole);
  if (!model) return null;
  const r = computeSaasRoi(model, inputs);

  return (
    <InputSection
      title="Productivity Impact by Role"
      subtitle="How many FTEs you need before and after the platform"
      defaultOpen
      callout={
        <>
          <strong>How this works:</strong> The platform increases each role's productivity by the % shown. With higher productivity, fewer FTEs are needed for the same volume — the savings come from headcount reduction (or redeployment).
        </>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="py-2 pr-3">Role</th>
              <th className="py-2 pr-3">Baseline Productivity</th>
              <th className="py-2 pr-3">Hourly Rate</th>
              <th className="py-2 pr-3">Improvement %</th>
              <th className="py-2 pr-3 text-right">FTEs Before</th>
              <th className="py-2 pr-3 text-right" style={{ color: model.platform.accentHex }}>FTEs After</th>
              <th className="py-2 text-right">Saved</th>
            </tr>
          </thead>
          <tbody>
            {model.roles.map((role) => {
              const ri = inputs.roles[role.id];
              const breakdown = r.internal.roles.find((d) => d.roleId === role.id)!;
              return (
                <tr key={role.id} className="border-t border-slate-200">
                  <td className="py-2 pr-3 align-top">
                    <div className="font-semibold text-navy">{role.label}</div>
                    <div className="text-xs text-slate-500">
                      loans / FTE / {role.productivityBasis === "perDay" ? "day" : "month"}
                    </div>
                  </td>
                  <td className="py-2 pr-3">
                    <NumberInput
                      value={ri?.baselineProductivity ?? role.defaultBaselineProductivity}
                      onChange={(n) => setRole(role.id, { baselineProductivity: n })}
                      step={0.5}
                      min={0}
                    />
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
                  <td className="py-2 pr-3">
                    <PercentInput
                      value={ri?.improvementPct ?? role.defaultImprovementPct}
                      onChange={(n) => setRole(role.id, { improvementPct: n })}
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
              <td colSpan={3} />
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
          <div className="text-[10px] uppercase tracking-wider font-bold text-navy/70">FTEs Saved</div>
          <div className="text-lg font-bold text-navy">{fmtFTE(r.internal.fteSaved)} <span className="text-xs font-normal text-slate-600">({fmtPercent(r.internal.totalFTEBefore > 0 ? r.internal.fteSaved / r.internal.totalFTEBefore : 0)})</span></div>
        </div>
      </div>
    </InputSection>
  );
}

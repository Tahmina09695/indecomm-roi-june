"use client";
import { useSaasScenario } from "@/store/saasScenarioStore";
import { InputSection, FieldLabel, NumberInput, PercentInput } from "../InputSection";
import { computeSaasRoi } from "@/lib/saas-engine";
import { fmtCurrency, fmtFTE } from "@/lib/format";

export function SaasInternalCostInputs() {
  const model = useSaasScenario((s) => s.model);
  const inputs = useSaasScenario((s) => s.inputs);
  const setSupervisor = useSaasScenario((s) => s.setSupervisor);
  const setBenefitsRate = useSaasScenario((s) => s.setBenefitsRate);
  const setIndirect = useSaasScenario((s) => s.setIndirect);
  if (!model) return null;
  const r = computeSaasRoi(model, inputs);
  const accent = model.platform.accentHex;

  return (
    <>
      <InputSection
        title="Supervisor / Manager"
        subtitle="Scales with the direct team — fewer FTEs means fewer supervisors"
        defaultOpen={false}
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <FieldLabel label="Span of Control" />
            <NumberInput value={inputs.supervisor.spanOfControl} onChange={(n) => setSupervisor({ spanOfControl: n })} min={1} />
          </div>
          <div>
            <FieldLabel label="Annual Supervisor Salary" />
            <NumberInput value={inputs.supervisor.salary} onChange={(n) => setSupervisor({ salary: n })} prefix="$" step={1000} min={0} />
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-md p-3 text-xs">
            <div className="flex justify-between"><span className="text-slate-600">Before FTEs</span><span className="font-semibold text-navy">{fmtFTE(r.internal.supervisor.fteBefore)}</span></div>
            <div className="flex justify-between"><span className="text-slate-600">After FTEs</span><span className="font-semibold" style={{ color: accent }}>{fmtFTE(r.internal.supervisor.fteAfter)}</span></div>
            <div className="flex justify-between mt-1 pt-1 border-t border-slate-200"><span className="text-slate-600">Annual cost change</span><span className="font-semibold text-navy">{fmtCurrency(r.internal.supervisor.annualCostBefore - r.internal.supervisor.annualCostAfter)} saved</span></div>
          </div>
        </div>
      </InputSection>

      <InputSection
        title="Benefits & Taxes"
        subtitle="Loaded on top of direct + supervisor salaries"
        defaultOpen={false}
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <FieldLabel label="Benefits & Taxes %" help="Typical mortgage industry: 25-30%" />
            <PercentInput value={inputs.benefitsRate} onChange={(n) => setBenefitsRate(n)} />
          </div>
          <div className="sm:col-span-2 bg-slate-50 border border-slate-200 rounded-md p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">Benefits Before</span>
              <span className="font-semibold text-navy">{fmtCurrency(r.internal.benefitsBefore)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Benefits After</span>
              <span className="font-semibold" style={{ color: accent }}>{fmtCurrency(r.internal.benefitsAfter)}</span>
            </div>
          </div>
        </div>
      </InputSection>

      <InputSection
        title="Indirect Costs (the often-ignored bucket)"
        subtitle="Allocated share of corporate overhead — scales proportionally with FTE count"
        defaultOpen
        callout={
          <>
            <strong>Why this matters:</strong> Most prospects compare only direct labor when sizing in-house teams. In reality, rent, IT licenses, management overhead, and G&amp;A all need a fair allocation. After automation, indirect costs scale down proportionally with the reduced headcount.
          </>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3">Category</th>
                <th className="py-2 pr-3">Annual Cost Pool</th>
                <th className="py-2 pr-3">Allocation % (Before)</th>
                <th className="py-2 pr-3 text-right">Cost Before</th>
                <th className="py-2 text-right" style={{ color: accent }}>Cost After</th>
              </tr>
            </thead>
            <tbody>
              {model.indirectCosts.map((i) => {
                const ii = inputs.indirect[i.id];
                const br = r.internal.indirects.find((b) => b.id === i.id)!;
                return (
                  <tr key={i.id} className="border-t border-slate-200">
                    <td className="py-2 pr-3 align-top">
                      <div className="font-semibold text-navy">{i.label}</div>
                      {i.help && <div className="text-xs text-slate-500">{i.help}</div>}
                    </td>
                    <td className="py-2 pr-3">
                      <NumberInput
                        value={ii?.monthlyCost ?? i.defaultAnnualPool}
                        onChange={(n) => setIndirect(i.id, { monthlyCost: n })}
                        prefix="$"
                        step={10_000}
                        min={0}
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <PercentInput
                        value={ii?.beforeAllocationPct ?? i.defaultAllocationPct}
                        onChange={(n) => setIndirect(i.id, { beforeAllocationPct: n })}
                      />
                    </td>
                    <td className="py-2 pr-3 text-right font-semibold text-navy">{fmtCurrency(br.costBefore)}</td>
                    <td className="py-2 text-right font-semibold" style={{ color: accent }}>{fmtCurrency(br.costAfter)}</td>
                  </tr>
                );
              })}
              <tr className="border-t-2 border-navy bg-navy/5">
                <td className="py-3 pr-3 text-sm uppercase tracking-wide font-bold text-navy">Total Indirect Costs</td>
                <td colSpan={2} />
                <td className="py-3 pr-3 text-right font-bold text-navy text-base">{fmtCurrency(r.internal.indirectTotalBefore)}</td>
                <td className="py-3 text-right font-bold text-base" style={{ color: accent }}>{fmtCurrency(r.internal.indirectTotalAfter)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </InputSection>

      {/* Annual total comparison */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-navy text-white rounded-xl shadow-card px-5 py-4">
          <div className="text-xs uppercase tracking-wider opacity-80">Total Annual Cost Before</div>
          <div className="text-xs opacity-60 mt-0.5">{fmtFTE(r.internal.totalFTEBefore)} total FTEs</div>
          <div className="text-2xl font-bold mt-1">{fmtCurrency(r.internal.annualBefore)}</div>
          <div className="text-[11px] opacity-75 mt-2 leading-snug">
            Includes: direct labor + supervisor + benefits + indirect
            {r.internal.currentPlatformAnnualCost > 0
              ? <> + legacy platform ({fmtCurrency(r.internal.currentPlatformAnnualCost)})</>
              : null}
          </div>
        </div>
        <div className="rounded-xl shadow-card px-5 py-4 text-white" style={{ background: accent }}>
          <div className="text-xs uppercase tracking-wider opacity-90">Total Annual Cost After</div>
          <div className="text-xs opacity-75 mt-0.5">{fmtFTE(r.internal.totalFTEAfter)} total FTEs · {fmtFTE(r.internal.fteSaved)} saved</div>
          <div className="text-2xl font-bold mt-1">{fmtCurrency(r.internal.annualAfter)}</div>
          <div className="text-[11px] opacity-90 mt-2 leading-snug">
            Includes: direct labor + supervisor + benefits + indirect.
            <br />
            Indecomm platform spend shown separately below.
          </div>
        </div>
      </div>
    </>
  );
}

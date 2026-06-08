"use client";
import { useScenario } from "@/store/scenarioStore";
import { InputSection, FieldLabel, NumberInput, PercentInput } from "./InputSection";
import { computeRoi } from "@/lib/engine";
import { fmtCurrency, fmtFTE, fmtPercent } from "@/lib/format";

export function InternalCostInputs() {
  const model = useScenario((s) => s.model);
  const inputs = useScenario((s) => s.inputs);
  const setRole = useScenario((s) => s.setRole);
  const setSupervisor = useScenario((s) => s.setSupervisor);
  const setBenefitsRate = useScenario((s) => s.setBenefitsRate);
  const setIndirect = useScenario((s) => s.setIndirect);
  if (!model) return null;

  const r = computeRoi(model, inputs);

  return (
    <>
      <InputSection
        title="Direct Roles"
        subtitle="Headcount auto-computed from volume & productivity"
        defaultOpen
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3">Role</th>
                <th className="py-2 pr-3">Productivity</th>
                <th className="py-2 pr-3">Hourly Rate</th>
                <th className="py-2 pr-3 text-right">FTEs</th>
                <th className="py-2 text-right">Annual Cost</th>
              </tr>
            </thead>
            <tbody>
              {model.roles.map((role) => {
                const ri = inputs.roles[role.id];
                const breakdown = r.internal.directs.find((d) => d.roleId === role.id)!;
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
                        value={ri?.productivity ?? role.defaultProductivity}
                        onChange={(n) => setRole(role.id, { productivity: n })}
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
                    <td className="py-2 pr-3 text-right font-semibold text-navy">{fmtFTE(breakdown.fteCount)}</td>
                    <td className="py-2 text-right font-semibold text-navy">{fmtCurrency(breakdown.annualCost)}</td>
                  </tr>
                );
              })}
              <tr className="border-t-2 border-slate-300 bg-slate-50">
                <td className="py-2 pr-3 text-xs uppercase tracking-wide font-bold text-slate-600">Direct Roles Subtotal</td>
                <td colSpan={2} />
                <td className="py-2 pr-3 text-right font-bold text-navy">{fmtFTE(r.internal.directs.reduce((s, d) => s + d.fteCount, 0))}</td>
                <td className="py-2 text-right font-bold text-navy">{fmtCurrency(r.internal.directTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </InputSection>

      <InputSection
        title="Supervisor / Manager"
        subtitle="Layered oversight is often forgotten"
        defaultOpen={false}
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <FieldLabel label="Span of Control (direct reports per supervisor)" />
            <NumberInput value={inputs.supervisor.spanOfControl} onChange={(n) => setSupervisor({ spanOfControl: n })} min={1} />
          </div>
          <div>
            <FieldLabel label="Annual Supervisor Salary" />
            <NumberInput value={inputs.supervisor.salary} onChange={(n) => setSupervisor({ salary: n })} prefix="$" step={1000} min={0} />
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-md p-3 text-sm">
            <div className="flex justify-between"><span className="text-slate-600">Supervisor FTEs</span><span className="font-semibold text-navy">{fmtFTE(r.internal.supervisor.fteCount)}</span></div>
            <div className="flex justify-between mt-1"><span className="text-slate-600">Annual cost</span><span className="font-semibold text-navy">{fmtCurrency(r.internal.supervisor.annualCost)}</span></div>
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
              <span className="text-slate-600">Annual benefits & taxes loading</span>
              <span className="font-semibold text-navy">{fmtCurrency(r.internal.benefits)}</span>
            </div>
          </div>
        </div>
      </InputSection>

      {/* Total Direct Costs = Direct Roles + Supervisor + Benefits (everything fully-loaded people cost) */}
      <div className="bg-navy/5 border-2 border-navy rounded-xl px-5 py-4 shadow-card">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-navy/70 font-bold">Total Direct Costs</div>
            <div className="text-xs text-slate-600 mt-0.5">Direct Roles + Supervisor + Benefits &amp; Taxes</div>
          </div>
          <div className="text-2xl font-bold text-navy">{fmtCurrency(r.internal.directTotal + r.internal.supervisor.annualCost + r.internal.benefits)}</div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <div className="bg-white rounded-md border border-slate-200 px-3 py-2 flex justify-between"><span className="text-slate-600">Direct Roles</span><span className="font-semibold text-navy">{fmtCurrency(r.internal.directTotal)}</span></div>
          <div className="bg-white rounded-md border border-slate-200 px-3 py-2 flex justify-between"><span className="text-slate-600">Supervisor</span><span className="font-semibold text-navy">{fmtCurrency(r.internal.supervisor.annualCost)}</span></div>
          <div className="bg-white rounded-md border border-slate-200 px-3 py-2 flex justify-between"><span className="text-slate-600">Benefits &amp; Taxes</span><span className="font-semibold text-navy">{fmtCurrency(r.internal.benefits)}</span></div>
        </div>
      </div>

      <InputSection
        title="Indirect Costs (the often-ignored bucket)"
        subtitle="Allocated share of corporate overhead"
        defaultOpen
        callout={
          <>
            <strong>Why this matters:</strong> Most prospects compare only direct labor when sizing in-house teams. In reality, rent, IT licenses, management overhead, and G&amp;A all need a fair allocation. The default below assumes a $1M annual pool per category with a 5% allocation to this function. Adjust the pool size and allocation % to reflect your company's reality — the totals update instantly.
          </>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3">Category</th>
                <th className="py-2 pr-3">Annual Cost Pool</th>
                <th className="py-2 pr-3">Allocation %</th>
                <th className="py-2 text-right">Allocated Cost</th>
              </tr>
            </thead>
            <tbody>
              {model.indirectCosts.map((i) => {
                const ii = inputs.indirect[i.id];
                const cost = (ii?.pool ?? i.defaultAnnualPool) * (ii?.pct ?? i.defaultAllocationPct);
                return (
                  <tr key={i.id} className="border-t border-slate-200">
                    <td className="py-2 pr-3 align-top">
                      <div className="font-semibold text-navy">{i.label}</div>
                      {i.help && <div className="text-xs text-slate-500">{i.help}</div>}
                    </td>
                    <td className="py-2 pr-3">
                      <NumberInput
                        value={ii?.pool ?? i.defaultAnnualPool}
                        onChange={(n) => setIndirect(i.id, { pool: n })}
                        prefix="$"
                        step={10_000}
                        min={0}
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <PercentInput
                        value={ii?.pct ?? i.defaultAllocationPct}
                        onChange={(n) => setIndirect(i.id, { pct: n })}
                      />
                    </td>
                    <td className="py-2 text-right font-semibold text-navy">{fmtCurrency(cost)}</td>
                  </tr>
                );
              })}
              <tr className="border-t-2 border-navy bg-navy/5">
                <td className="py-3 pr-3 text-sm uppercase tracking-wide font-bold text-navy">Total Indirect Costs</td>
                <td colSpan={2} />
                <td className="py-3 text-right font-bold text-navy text-base">{fmtCurrency(r.internal.indirectTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </InputSection>

      <div className="bg-navy text-white rounded-xl shadow-card px-5 py-4 flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider opacity-80">Total in-house annual cost</div>
          <div className="text-xs opacity-60 mt-0.5">{fmtFTE(r.internal.totalFTE)} total FTEs · {fmtPercent(r.internal.indirectTotal / Math.max(r.internal.totalAnnual, 1))} indirect</div>
        </div>
        <div className="text-2xl font-bold">{fmtCurrency(r.internal.totalAnnual)}</div>
      </div>
    </>
  );
}

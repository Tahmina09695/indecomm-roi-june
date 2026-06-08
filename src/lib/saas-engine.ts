/**
 * Pure calculation engine for "SaaS Automation" ROI models (IDXGenius,
 * DecisionGenius). Companion to the services engine in ./engine.ts.
 *
 * Excel formula references (IDX & DG):
 *   For each role:
 *     - Headcount Before  = ROUND( volume / baseline_productivity, 0 )      (perMonth)
 *                        OR ROUND( volume / 20 / baseline_productivity, 0 ) (perDay)
 *     - Improved prod     = baseline * (1 + improvementPct)
 *     - Headcount After   = ROUND( same formula with improved productivity, 0 )
 *     - Annual salary     = hourlyRate * 2080
 *     - Annual cost       = FTE * annual salary
 *
 *   Supervisor: SUM(direct FTEs) / span, × salary
 *   Benefits:   SUM(direct + supervisor) × benefitsRate
 *   Indirect Before: monthlyCost * allocationPct
 *   Indirect After:  monthlyCost * (afterDirectFTEs * allocationPct / beforeDirectFTEs)
 *                    (i.e., proportional to the FTE ratio)
 *
 *   Platform spend:
 *     Year 1 = (loans_per_month * 12 * per-loan fee) + one-time impl fee
 *     Year 2 = (loans_per_month * 12 * per-loan fee)
 *
 *   Totals:
 *     Year 1 Total Spend  = Internal After Annual + Year 1 Platform
 *     Year 2 Total Spend  = Internal After Annual + Year 2 Platform
 *     Savings Year N      = Internal Before Annual - Year N Total Spend
 *     Savings %           = Savings / Internal Before Annual
 *     ROI %               = Savings / Platform Spend (Year N)
 */
import type { SaasModelConfig, SaasRoleDef } from "@/models/_saas-types";
import { WORKING_DAYS_PER_MONTH, WORKING_HOURS_PER_YEAR } from "@/models/_types";
import { recomputeDerivedVolumes } from "./engine";

export type SaasInputs = {
  clientName?: string;
  /** Volume input ID → value. */
  volumes: Record<string, number>;
  /** Per-role overrides. */
  roles: Record<string, {
    baselineProductivity: number;
    hourlyRate: number;
    improvementPct: number;
  }>;
  supervisor: { spanOfControl: number; salary: number };
  benefitsRate: number;
  /** Indirect overrides: { [id]: { monthlyCost, beforeAllocationPct } } */
  indirect: Record<string, { monthlyCost: number; beforeAllocationPct: number }>;
  pricing: {
    perLoanMonthlyFee: number;
    oneTimeImplementationFee: number;
  };
};

export function buildSaasDefaults(model: SaasModelConfig): SaasInputs {
  const volumes: Record<string, number> = {};
  for (const v of model.volumeInputs) {
    if (v.type !== "derived") volumes[v.id] = v.defaultValue;
  }
  // Recompute derived values (reuse same helper).
  for (const v of model.volumeInputs) {
    if (v.type === "derived" && v.derive) volumes[v.id] = v.derive(volumes);
  }
  const roles: SaasInputs["roles"] = {};
  for (const r of model.roles) {
    roles[r.id] = {
      baselineProductivity: r.defaultBaselineProductivity,
      hourlyRate: r.defaultHourlyRate,
      improvementPct: r.defaultImprovementPct,
    };
  }
  const indirect: SaasInputs["indirect"] = {};
  for (const i of model.indirectCosts) {
    indirect[i.id] = {
      monthlyCost: i.defaultAnnualPool,
      beforeAllocationPct: i.defaultAllocationPct,
    };
  }
  return {
    clientName: "",
    volumes,
    roles,
    supervisor: { spanOfControl: model.supervisor.spanOfControl, salary: model.supervisor.salary },
    benefitsRate: model.benefitsRate,
    indirect,
    pricing: {
      perLoanMonthlyFee: model.pricing.defaultPerLoanMonthlyFee,
      oneTimeImplementationFee: model.pricing.defaultOneTimeImplementationFee,
    },
  };
}

export function recomputeSaasDerivedVolumes(model: SaasModelConfig, volumes: Record<string, number>): Record<string, number> {
  // SaaS models reuse the services helper since the volume input shape is identical.
  return recomputeDerivedVolumes(model as any, volumes);
}

/** Round-half-up FTE need for one role at a given productivity (matches Excel ROUND). */
function fteNeed(
  role: SaasRoleDef,
  volume: number,
  productivity: number,
): number {
  if (productivity <= 0) return 0;
  const raw = role.productivityBasis === "perDay"
    ? volume / WORKING_DAYS_PER_MONTH / productivity
    : volume / productivity;
  return Math.round(raw);
}

export type SaasRoleBreakdown = {
  roleId: string;
  label: string;
  fteBefore: number;
  fteAfter: number;
  improvedProductivity: number;
  annualSalary: number;
  annualCostBefore: number;
  annualCostAfter: number;
};

export function computeSaasRoles(model: SaasModelConfig, inputs: SaasInputs): SaasRoleBreakdown[] {
  return model.roles.map((r) => {
    const ri = inputs.roles[r.id] ?? {
      baselineProductivity: r.defaultBaselineProductivity,
      hourlyRate: r.defaultHourlyRate,
      improvementPct: r.defaultImprovementPct,
    };
    const volume = inputs.volumes[r.volumeKey] ?? 0;
    const fteBefore = fteNeed(r, volume, ri.baselineProductivity);
    const improved = ri.baselineProductivity * (1 + ri.improvementPct);
    const fteAfter = fteNeed(r, volume, improved);
    const annualSalary = ri.hourlyRate * WORKING_HOURS_PER_YEAR;
    return {
      roleId: r.id,
      label: r.label,
      fteBefore,
      fteAfter,
      improvedProductivity: improved,
      annualSalary,
      annualCostBefore: fteBefore * annualSalary,
      annualCostAfter: fteAfter * annualSalary,
    };
  });
}

export type SaasSupervisorBreakdown = {
  fteBefore: number;
  fteAfter: number;
  salary: number;
  annualCostBefore: number;
  annualCostAfter: number;
};

export function computeSaasSupervisor(roles: SaasRoleBreakdown[], inputs: SaasInputs): SaasSupervisorBreakdown {
  const totalBefore = roles.reduce((s, r) => s + r.fteBefore, 0);
  const totalAfter = roles.reduce((s, r) => s + r.fteAfter, 0);
  const span = inputs.supervisor.spanOfControl || 1;
  const fteBefore = totalBefore / span;
  const fteAfter = totalAfter / span;
  return {
    fteBefore,
    fteAfter,
    salary: inputs.supervisor.salary,
    annualCostBefore: fteBefore * inputs.supervisor.salary,
    annualCostAfter: fteAfter * inputs.supervisor.salary,
  };
}

export type SaasIndirectBreakdown = {
  id: string;
  label: string;
  costBefore: number;
  costAfter: number;
};

/**
 * Indirect costs scale proportionally with direct FTE count. The Excel uses:
 *   Cost After = monthlyCost * ((afterDirectFTEs * beforeAllocationPct) / beforeDirectFTEs)
 * which simplifies to "scale before-cost by (after / before)".
 */
export function computeSaasIndirects(
  model: SaasModelConfig,
  inputs: SaasInputs,
  roles: SaasRoleBreakdown[],
): SaasIndirectBreakdown[] {
  const beforeDirectFTEs = roles.reduce((s, r) => s + r.fteBefore, 0);
  const afterDirectFTEs = roles.reduce((s, r) => s + r.fteAfter, 0);
  const ratio = beforeDirectFTEs > 0 ? afterDirectFTEs / beforeDirectFTEs : 0;
  return model.indirectCosts.map((i) => {
    const v = inputs.indirect[i.id] ?? { monthlyCost: i.defaultAnnualPool, beforeAllocationPct: i.defaultAllocationPct };
    const costBefore = v.monthlyCost * v.beforeAllocationPct;
    const costAfter = costBefore * ratio;
    return { id: i.id, label: i.label, costBefore, costAfter };
  });
}

export type SaasInternalBreakdown = {
  roles: SaasRoleBreakdown[];
  supervisor: SaasSupervisorBreakdown;
  benefitsBefore: number;
  benefitsAfter: number;
  indirects: SaasIndirectBreakdown[];
  directTotalBefore: number;
  directTotalAfter: number;
  indirectTotalBefore: number;
  indirectTotalAfter: number;
  annualBefore: number;
  annualAfter: number;
  totalFTEBefore: number;
  totalFTEAfter: number;
  fteSaved: number;
};

export function computeSaasInternal(model: SaasModelConfig, inputs: SaasInputs): SaasInternalBreakdown {
  const roles = computeSaasRoles(model, inputs);
  const supervisor = computeSaasSupervisor(roles, inputs);

  const directRolesBefore = roles.reduce((s, r) => s + r.annualCostBefore, 0);
  const directRolesAfter = roles.reduce((s, r) => s + r.annualCostAfter, 0);
  const directTotalBefore = directRolesBefore + supervisor.annualCostBefore;
  const directTotalAfter = directRolesAfter + supervisor.annualCostAfter;
  const benefitsBefore = directTotalBefore * inputs.benefitsRate;
  const benefitsAfter = directTotalAfter * inputs.benefitsRate;

  const indirects = computeSaasIndirects(model, inputs, roles);
  const indirectTotalBefore = indirects.reduce((s, i) => s + i.costBefore, 0);
  const indirectTotalAfter = indirects.reduce((s, i) => s + i.costAfter, 0);

  const annualBefore = directTotalBefore + benefitsBefore + indirectTotalBefore;
  const annualAfter = directTotalAfter + benefitsAfter + indirectTotalAfter;

  const totalFTEBefore = roles.reduce((s, r) => s + r.fteBefore, 0) + supervisor.fteBefore;
  const totalFTEAfter = roles.reduce((s, r) => s + r.fteAfter, 0) + supervisor.fteAfter;
  return {
    roles,
    supervisor,
    benefitsBefore,
    benefitsAfter,
    indirects,
    directTotalBefore,
    directTotalAfter,
    indirectTotalBefore,
    indirectTotalAfter,
    annualBefore,
    annualAfter,
    totalFTEBefore,
    totalFTEAfter,
    fteSaved: totalFTEBefore - totalFTEAfter,
  };
}

export type SaasPlatformSpend = {
  monthlyLicensePerLoan: number;
  loansPerMonth: number;
  annualLicense: number;
  oneTimeImpl: number;
  year1Spend: number;
  year2Spend: number;
};

export function computeSaasPlatformSpend(model: SaasModelConfig, inputs: SaasInputs): SaasPlatformSpend {
  // Pick the volume that drives per-loan pricing.
  const volKey = model.perLoanVolumeKey ?? model.roles[0]?.volumeKey ?? model.volumeInputs[0]?.id;
  const loansPerMonth = inputs.volumes[volKey ?? ""] ?? 0;
  const annualLicense = loansPerMonth * 12 * inputs.pricing.perLoanMonthlyFee;
  return {
    monthlyLicensePerLoan: inputs.pricing.perLoanMonthlyFee,
    loansPerMonth,
    annualLicense,
    oneTimeImpl: inputs.pricing.oneTimeImplementationFee,
    year1Spend: annualLicense + inputs.pricing.oneTimeImplementationFee,
    year2Spend: annualLicense,
  };
}

export type SaasYearResult = {
  totalSpend: number;        // = annualAfter + platform spend
  savings: number;           // = annualBefore - totalSpend
  savingsPct: number;        // = savings / annualBefore
  /** ROI % = savings / platform investment (Excel definition). */
  roiPct: number;
};

export type SaasResult = {
  internal: SaasInternalBreakdown;
  platform: SaasPlatformSpend;
  year1: SaasYearResult;
  year2: SaasYearResult;
  perLoanBefore: number;
  perLoanAfter: number;
  perLoanSavings: number;
  perLoanDenominatorAnnual: number;
};

export function computeSaasRoi(model: SaasModelConfig, inputs: SaasInputs): SaasResult {
  const internal = computeSaasInternal(model, inputs);
  const platform = computeSaasPlatformSpend(model, inputs);

  const year1Total = internal.annualAfter + platform.year1Spend;
  const year2Total = internal.annualAfter + platform.year2Spend;

  const year1Savings = internal.annualBefore - year1Total;
  const year2Savings = internal.annualBefore - year2Total;

  const year1: SaasYearResult = {
    totalSpend: year1Total,
    savings: year1Savings,
    savingsPct: internal.annualBefore > 0 ? year1Savings / internal.annualBefore : 0,
    roiPct: platform.year1Spend > 0 ? year1Savings / platform.year1Spend : 0,
  };
  const year2: SaasYearResult = {
    totalSpend: year2Total,
    savings: year2Savings,
    savingsPct: internal.annualBefore > 0 ? year2Savings / internal.annualBefore : 0,
    roiPct: platform.year2Spend > 0 ? year2Savings / platform.year2Spend : 0,
  };

  // Per-loan figures use applications × 12 as the denominator.
  const denomVolKey = model.perLoanVolumeKey ?? model.roles[0]?.volumeKey ?? model.volumeInputs[0]?.id;
  const denomMonthly = inputs.volumes[denomVolKey ?? ""] ?? 0;
  const perLoanDenominatorAnnual = denomMonthly * 12;
  const perLoanBefore = perLoanDenominatorAnnual > 0 ? internal.annualBefore / perLoanDenominatorAnnual : 0;
  const perLoanAfter = perLoanDenominatorAnnual > 0 ? (internal.annualAfter + platform.annualLicense) / perLoanDenominatorAnnual : 0;
  // Use "steady state" (Year 2 / per-loan cost without impl) for the bar chart.

  return {
    internal,
    platform,
    year1,
    year2,
    perLoanBefore,
    perLoanAfter,
    perLoanSavings: perLoanBefore - perLoanAfter,
    perLoanDenominatorAnnual,
  };
}

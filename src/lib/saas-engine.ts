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
    /**
     * Optional: client's current annual platform/system cost (legacy software
     * to be replaced by Indecomm's platforms). When > 0, the engine ADDS this
     * to the Before annual cost. The "After" side replaces it with Indecomm's
     * platform fee. Defaults from model.pricing.defaultCurrentPlatformAnnualCost.
     */
    currentPlatformAnnualCost?: number;
    /**
     * Optional: fixed annual license that overrides per-loan license
     * calculation (when the deal is priced as a flat annual figure).
     * Defaults from model.pricing.defaultFixedAnnualLicense.
     */
    fixedAnnualLicense?: number;
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
      currentPlatformAnnualCost: model.pricing.defaultCurrentPlatformAnnualCost ?? 0,
      fixedAnnualLicense: model.pricing.defaultFixedAnnualLicense,
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
    // When the platform fully eliminates this role (e.g., IDXGenius replacing
    // manual indexing), force After FTE to 0 regardless of the productivity
    // math. Otherwise compute from improved productivity.
    const fteAfter = r.eliminatedByPlatform ? 0 : fteNeed(r, volume, improved);
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
  /**
   * Current platform / legacy systems annual cost (Before only). 0 when the
   * model doesn't use this field.
   */
  currentPlatformAnnualCost: number;
  /**
   * Before annual = direct + benefits + indirect + currentPlatformAnnualCost.
   * After annual  = direct + benefits + indirect (NO current platform — Indecomm
   * platform cost is tracked separately in SaasPlatformSpend).
   */
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

  const currentPlatformAnnualCost = Math.max(0, inputs.pricing.currentPlatformAnnualCost ?? 0);

  const annualBefore = directTotalBefore + benefitsBefore + indirectTotalBefore + currentPlatformAnnualCost;
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
    currentPlatformAnnualCost,
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
  /** Year 3 spend = annualLicense × (1+escalator)^2. Equal to year2Spend × (1+escalator) when escalator > 0. */
  year3Spend: number;
};

export function computeSaasPlatformSpend(model: SaasModelConfig, inputs: SaasInputs): SaasPlatformSpend {
  // Pick the volume that drives per-loan pricing.
  const volKey = model.perLoanVolumeKey ?? model.roles[0]?.volumeKey ?? model.volumeInputs[0]?.id;
  const loansPerMonth = inputs.volumes[volKey ?? ""] ?? 0;
  // If the model defines a fixed annual license (NFCU-style RFP pricing),
  // use it as the authoritative annual license number — the per-loan field
  // becomes informational only. Otherwise, derive license from per-loan × volume.
  const fixed = inputs.pricing.fixedAnnualLicense;
  const annualLicense = (fixed !== undefined && fixed > 0)
    ? fixed
    : loansPerMonth * 12 * inputs.pricing.perLoanMonthlyFee;

  // Annual escalator (e.g., 0.03 = 3%) is applied to Y2 and Y3 license.
  // For models without a configured escalator, both years stay at the same license.
  const esc = model.pricingEscalatorAnnual ?? 0;
  const year2License = annualLicense * (1 + esc);
  const year3License = annualLicense * (1 + esc) * (1 + esc);

  return {
    monthlyLicensePerLoan: inputs.pricing.perLoanMonthlyFee,
    loansPerMonth,
    annualLicense,
    oneTimeImpl: inputs.pricing.oneTimeImplementationFee,
    year1Spend: annualLicense + inputs.pricing.oneTimeImplementationFee,
    year2Spend: year2License,
    year3Spend: year3License,
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
  /** Year 3 result, populated even when enableThreeYearView is false (it's free). */
  year3: SaasYearResult;
  /** Sum of Y1+Y2+Y3 savings. Used for the "3-year cumulative savings" hero. */
  threeYearCumulativeSavings: number;
  /** Sum of Y1+Y2+Y3 in-house "Before" cost (with legacy escalator applied). */
  threeYearCumulativeBefore: number;
  /** Sum of Y1+Y2+Y3 total spend after Indecomm (internal-after + platform). */
  threeYearCumulativeAfterSpend: number;
  perLoanBefore: number;
  perLoanAfter: number;
  perLoanSavings: number;
  perLoanDenominatorAnnual: number;
  /** Year-1 in-house "Before" annual (matches r.internal.annualBefore — alias for clarity in 3-year views). */
  year1Before: number;
  /** Year-2 "Before" with escalator applied to legacy platform cost. */
  year2Before: number;
  /** Year-3 "Before" with escalator applied to legacy platform cost. */
  year3Before: number;
};

export function computeSaasRoi(model: SaasModelConfig, inputs: SaasInputs): SaasResult {
  const internal = computeSaasInternal(model, inputs);
  const platform = computeSaasPlatformSpend(model, inputs);
  const esc = model.pricingEscalatorAnnual ?? 0;

  // The legacy platform cost rises with the same escalator (3% default for NFCU).
  // Labor + indirect held flat — the rep can override via inputs if needed.
  const legacyY1 = internal.currentPlatformAnnualCost;
  const legacyY2 = legacyY1 * (1 + esc);
  const legacyY3 = legacyY1 * (1 + esc) * (1 + esc);

  // "Before" annual = labor cost (constant) + escalating legacy platform cost.
  // We compute a labor-only baseline so we can re-add escalated legacy per year.
  const beforeLaborAndIndirect = internal.annualBefore - legacyY1;
  const year1Before = beforeLaborAndIndirect + legacyY1;
  const year2Before = beforeLaborAndIndirect + legacyY2;
  const year3Before = beforeLaborAndIndirect + legacyY3;

  // "After" labor + indirect is also held flat across Y1/Y2/Y3.
  const afterLaborAndIndirect = internal.annualAfter;

  const year1Total = afterLaborAndIndirect + platform.year1Spend;
  const year2Total = afterLaborAndIndirect + platform.year2Spend;
  const year3Total = afterLaborAndIndirect + platform.year3Spend;

  const year1Savings = year1Before - year1Total;
  const year2Savings = year2Before - year2Total;
  const year3Savings = year3Before - year3Total;

  const year1: SaasYearResult = {
    totalSpend: year1Total,
    savings: year1Savings,
    savingsPct: year1Before > 0 ? year1Savings / year1Before : 0,
    roiPct: platform.year1Spend > 0 ? year1Savings / platform.year1Spend : 0,
  };
  const year2: SaasYearResult = {
    totalSpend: year2Total,
    savings: year2Savings,
    savingsPct: year2Before > 0 ? year2Savings / year2Before : 0,
    roiPct: platform.year2Spend > 0 ? year2Savings / platform.year2Spend : 0,
  };
  const year3: SaasYearResult = {
    totalSpend: year3Total,
    savings: year3Savings,
    savingsPct: year3Before > 0 ? year3Savings / year3Before : 0,
    roiPct: platform.year3Spend > 0 ? year3Savings / platform.year3Spend : 0,
  };

  // Per-loan figures use the model's perLoanVolumeKey × 12 as the denominator.
  const denomVolKey = model.perLoanVolumeKey ?? model.roles[0]?.volumeKey ?? model.volumeInputs[0]?.id;
  const denomMonthly = inputs.volumes[denomVolKey ?? ""] ?? 0;
  const perLoanDenominatorAnnual = denomMonthly * 12;
  const perLoanBefore = perLoanDenominatorAnnual > 0 ? year1Before / perLoanDenominatorAnnual : 0;
  // Use steady state (Year 2 — without implementation) for the per-loan "After" cost.
  const perLoanAfter = perLoanDenominatorAnnual > 0
    ? (afterLaborAndIndirect + platform.year2Spend) / perLoanDenominatorAnnual
    : 0;

  return {
    internal,
    platform,
    year1,
    year2,
    year3,
    threeYearCumulativeSavings: year1Savings + year2Savings + year3Savings,
    threeYearCumulativeBefore: year1Before + year2Before + year3Before,
    threeYearCumulativeAfterSpend: year1Total + year2Total + year3Total,
    year1Before,
    year2Before,
    year3Before,
    perLoanBefore,
    perLoanAfter,
    perLoanSavings: perLoanBefore - perLoanAfter,
    perLoanDenominatorAnnual,
  };
}

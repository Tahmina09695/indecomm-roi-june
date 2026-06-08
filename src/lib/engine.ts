/**
 * Pure calculation engine for the ROI calculator.
 * Mirrors the formulas in the Excel ROI models.
 *
 * Excel formula references (PCQC):
 *   Headcount need = (Volume * Sample%) / WorkingDays / Productivity         (per role)
 *   Annual salary   = HourlyRate * 2080
 *   Direct annual cost = FTE_need * AnnualSalary
 *   Supervisor FTEs = SUM(direct FTEs) / spanOfControl
 *   Supervisor cost = SupFTEs * SupSalary
 *   Benefits        = SUM(direct + supervisor annual cost) * benefitsRate
 *   Indirect total  = SUM(pool * allocationPct)
 *   Internal annual = direct + supervisor + benefits + indirect
 *   Outsourced annual = SUM(perLoan * effectiveMonthlyVolume * 12) OR (FTEs * monthlyPricePerFTE * 12)
 *   Annual savings  = Internal - Outsourced
 */
import type {
  ModelConfig,
  RoleDef,
  IndirectCostDef,
  PricingDef,
} from "@/models/_types";
import { WORKING_DAYS_PER_MONTH, WORKING_HOURS_PER_YEAR } from "@/models/_types";

export type ScenarioInputs = {
  /** Client name (display only). */
  clientName?: string;
  /** Volume input ID → value. Sample rate is also stored here under the model's sampleRate.id. */
  volumes: Record<string, number>;
  /** Per-role overrides: { [roleId]: { productivity, hourlyRate } } */
  roles: Record<string, { productivity: number; hourlyRate: number }>;
  /** Supervisor overrides. */
  supervisor: { spanOfControl: number; salary: number };
  /** Benefits rate (0..1). */
  benefitsRate: number;
  /** Indirect cost overrides: { [id]: { pool, pct } } */
  indirect: Record<string, { pool: number; pct: number }>;
  /** Pricing overrides: { [pricingId]: number } */
  pricing: Record<string, number>;
  /**
   * Retained in-house staff (post-outsourcing). Only meaningful when
   * model.retention is defined; for other models the engine ignores this.
   */
  retention?: {
    /** Master toggle. When false, retention contributes $0 to outsourced cost. */
    enabled: boolean;
    /** % of direct (volume-driven) roles retained, 0..1. */
    retentionPct: number;
    /** Fixed supervisor count retained. */
    retainedSupervisors: number;
  };
};

export function buildDefaultInputs(model: ModelConfig): ScenarioInputs {
  const volumes: Record<string, number> = {};
  for (const v of model.volumeInputs) {
    if (v.type !== "derived") volumes[v.id] = v.defaultValue;
  }
  if (model.sampleRate) volumes[model.sampleRate.id] = model.sampleRate.default;
  // compute derived values after primitives set
  for (const v of model.volumeInputs) {
    if (v.type === "derived" && v.derive) volumes[v.id] = v.derive(volumes);
  }

  const roles: ScenarioInputs["roles"] = {};
  for (const r of model.roles) {
    roles[r.id] = { productivity: r.defaultProductivity, hourlyRate: r.defaultHourlyRate };
  }
  const indirect: ScenarioInputs["indirect"] = {};
  for (const i of model.indirectCosts) {
    indirect[i.id] = { pool: i.defaultAnnualPool, pct: i.defaultAllocationPct };
  }
  const pricing: ScenarioInputs["pricing"] = {};
  for (const p of model.pricing) {
    pricing[p.id] = p.type === "perLoan" ? p.defaultPrice : p.defaultMonthlyPricePerFTE;
  }
  const retention = model.retention
    ? {
        enabled: false, // off by default — rep opts in per prospect
        retentionPct: model.retention.defaultRetentionPct,
        retainedSupervisors: model.retention.defaultRetainedSupervisors,
      }
    : undefined;

  return {
    clientName: "",
    volumes,
    roles,
    supervisor: { spanOfControl: model.supervisor.spanOfControl, salary: model.supervisor.salary },
    benefitsRate: model.benefitsRate,
    indirect,
    pricing,
    retention,
  };
}

/** Recompute derived volume values (called after any primitive volume change). */
export function recomputeDerivedVolumes(model: ModelConfig, volumes: Record<string, number>): Record<string, number> {
  const next = { ...volumes };
  for (const v of model.volumeInputs) {
    if (v.type === "derived" && v.derive) next[v.id] = v.derive(next);
  }
  return next;
}

/** Effective monthly volume for a role, after applying sample rate if applicable. */
function effectiveMonthlyVolume(
  role: RoleDef,
  inputs: ScenarioInputs,
  model: ModelConfig,
): number {
  const base = inputs.volumes[role.volumeKey] ?? 0;
  const sample = role.appliesSampleRate && model.sampleRate
    ? (inputs.volumes[model.sampleRate.id] ?? 1)
    : 1;
  return base * sample;
}

/** Headcount need for a role given current inputs. */
export function computeRoleFTEs(role: RoleDef, inputs: ScenarioInputs, model: ModelConfig): number {
  const monthlyVol = effectiveMonthlyVolume(role, inputs, model);
  const prod = inputs.roles[role.id]?.productivity ?? role.defaultProductivity;
  const multiplier = role.productivityMultiplier ?? 1;
  if (prod <= 0) return 0;
  if (role.productivityBasis === "perDay") {
    // FTEs = (monthlyVol * multiplier) / 20 / prod
    return (monthlyVol * multiplier) / WORKING_DAYS_PER_MONTH / prod;
  }
  // perMonth: FTEs = (monthlyVol * multiplier) / prod
  return (monthlyVol * multiplier) / prod;
}

/** Annual salary for a role: hourlyRate * 2080. */
function roleAnnualSalary(role: RoleDef, inputs: ScenarioInputs): number {
  const hr = inputs.roles[role.id]?.hourlyRate ?? role.defaultHourlyRate;
  return hr * WORKING_HOURS_PER_YEAR;
}

export type RoleBreakdown = {
  roleId: string;
  label: string;
  fteCount: number;
  annualSalary: number;
  annualCost: number;
};

export function computeDirectRoles(model: ModelConfig, inputs: ScenarioInputs): RoleBreakdown[] {
  return model.roles.map((r) => {
    const fteCount = computeRoleFTEs(r, inputs, model);
    const annualSalary = roleAnnualSalary(r, inputs);
    return {
      roleId: r.id,
      label: r.label,
      fteCount,
      annualSalary,
      annualCost: fteCount * annualSalary,
    };
  });
}

export type SupervisorBreakdown = {
  fteCount: number;
  annualCost: number;
  salary: number;
};

export function computeSupervisor(directs: RoleBreakdown[], inputs: ScenarioInputs): SupervisorBreakdown {
  const totalDirectFTE = directs.reduce((s, r) => s + r.fteCount, 0);
  const span = inputs.supervisor.spanOfControl || 1;
  const fteCount = totalDirectFTE / span;
  return { fteCount, salary: inputs.supervisor.salary, annualCost: fteCount * inputs.supervisor.salary };
}

export function computeBenefits(directs: RoleBreakdown[], sup: SupervisorBreakdown, rate: number): number {
  const base = directs.reduce((s, r) => s + r.annualCost, 0) + sup.annualCost;
  return base * rate;
}

export type IndirectBreakdown = { id: string; label: string; cost: number };

export function computeIndirects(model: ModelConfig, inputs: ScenarioInputs): IndirectBreakdown[] {
  return model.indirectCosts.map<IndirectBreakdown>((i: IndirectCostDef) => {
    const v = inputs.indirect[i.id] ?? { pool: i.defaultAnnualPool, pct: i.defaultAllocationPct };
    return { id: i.id, label: i.label, cost: v.pool * v.pct };
  });
}

export type InternalCostBreakdown = {
  directs: RoleBreakdown[];
  directTotal: number;
  supervisor: SupervisorBreakdown;
  benefits: number;
  indirects: IndirectBreakdown[];
  indirectTotal: number;
  totalAnnual: number;
  totalFTE: number;
};

export function computeInternal(model: ModelConfig, inputs: ScenarioInputs): InternalCostBreakdown {
  const directs = computeDirectRoles(model, inputs);
  const directTotal = directs.reduce((s, r) => s + r.annualCost, 0);
  const supervisor = computeSupervisor(directs, inputs);
  const benefits = computeBenefits(directs, supervisor, inputs.benefitsRate);
  const indirects = computeIndirects(model, inputs);
  const indirectTotal = indirects.reduce((s, i) => s + i.cost, 0);
  const totalAnnual = directTotal + supervisor.annualCost + benefits + indirectTotal;
  const totalFTE = directs.reduce((s, r) => s + r.fteCount, 0) + supervisor.fteCount;
  return { directs, directTotal, supervisor, benefits, indirects, indirectTotal, totalAnnual, totalFTE };
}

export type OutsourcedLineItem = {
  pricingId: string;
  label: string;
  monthlyVolumeOrFTEs: number;
  unitPrice: number;
  annualCost: number;
};

function pricingMonthlyVolume(
  p: PricingDef,
  inputs: ScenarioInputs,
  model: ModelConfig,
  internal: InternalCostBreakdown,
): number {
  if (p.type === "perLoan") {
    const base = inputs.volumes[p.volumeKey] ?? 0;
    const sample = p.appliesSampleRate && model.sampleRate
      ? (inputs.volumes[model.sampleRate.id] ?? 1)
      : 1;
    return base * sample;
  }
  // perFTE: use computed FTEs for the chosen role, optionally rounded (PPR Excel
  // uses ROUND), then multiplied (e.g., 1.2 for offshore overhead), then offset
  // (e.g., +1 supervisor).
  const role = internal.directs.find((r) => r.roleId === p.roleId);
  let baseFte = role?.fteCount ?? 0;
  if (p.roundBaseFte === "round") baseFte = Math.round(baseFte);
  else if (p.roundBaseFte === "ceil") baseFte = Math.ceil(baseFte);
  else if (p.roundBaseFte === "floor") baseFte = Math.floor(baseFte);
  const multiplier = p.fteMultiplier ?? 1;
  const fte = baseFte * multiplier + (p.fteOffset ?? 0);
  return fte;
}

export function computeOutsourced(
  model: ModelConfig,
  inputs: ScenarioInputs,
  internal: InternalCostBreakdown,
): { items: OutsourcedLineItem[]; totalAnnual: number; totalAuditedLoansAnnual: number } {
  const items: OutsourcedLineItem[] = model.pricing.map<OutsourcedLineItem>((p) => {
    const unit = inputs.pricing[p.id] ?? (p.type === "perLoan" ? p.defaultPrice : p.defaultMonthlyPricePerFTE);
    const monthlyQty = pricingMonthlyVolume(p, inputs, model, internal);
    const annualCost = monthlyQty * unit * 12;
    return { pricingId: p.id, label: p.label, monthlyVolumeOrFTEs: monthlyQty, unitPrice: unit, annualCost };
  });
  const totalAnnual = items.reduce((s, it) => s + it.annualCost, 0);

  // Determine the "audited loans / year" denominator used for per-loan figures.
  // 1) If the model declares an explicit perLoanDenominator (used by per-FTE
  //    models like Underwriting), use that volume × 12.
  // 2) Otherwise sum the audited monthly volumes implied by per-loan pricing lines.
  let totalAuditedLoansAnnual = 0;
  if (model.perLoanDenominator) {
    const d = model.perLoanDenominator;
    const base = inputs.volumes[d.volumeKey] ?? 0;
    const sample = d.appliesSampleRate && model.sampleRate ? (inputs.volumes[model.sampleRate.id] ?? 1) : 1;
    totalAuditedLoansAnnual = base * sample * 12;
  } else {
    for (const p of model.pricing) {
      if (p.type === "perLoan") {
        const base = inputs.volumes[p.volumeKey] ?? 0;
        const sample = p.appliesSampleRate && model.sampleRate ? (inputs.volumes[model.sampleRate.id] ?? 1) : 1;
        totalAuditedLoansAnnual += base * sample * 12;
      }
    }
  }
  return { items, totalAnnual, totalAuditedLoansAnnual };
}

/**
 * Retained in-house staff cost (post-outsourcing).
 *
 * Computed from the in-house build-up:
 *   retainedDirect    = (sum of direct ROLES annual cost) × retentionPct
 *   retainedSupCost   = retainedSupervisors × supervisor salary
 *   retainedBenefits  = (retainedDirect + retainedSupCost) × benefitsRate
 *   retainedIndirect  = sum of in-house indirect × retentionPct
 *   total             = retainedDirect + retainedSupCost + retainedBenefits + retainedIndirect
 *
 * Only meaningful when model.retention is defined AND inputs.retention.enabled
 * is true; otherwise this returns zeros.
 */
export type RetainedCostBreakdown = {
  enabled: boolean;
  retentionPct: number;
  retainedSupervisors: number;
  /** Number of retained "team member" FTEs (volume-driven roles only, excluding supervisor). */
  retainedTeamFte: number;
  retainedDirectCost: number;
  retainedSupervisorCost: number;
  retainedBenefits: number;
  retainedIndirect: number;
  totalAnnual: number;
};

export function computeRetention(
  model: ModelConfig,
  inputs: ScenarioInputs,
  internal: InternalCostBreakdown,
): RetainedCostBreakdown {
  const cfg = model.retention;
  const ri = inputs.retention;
  if (!cfg || !ri || !ri.enabled) {
    return {
      enabled: false,
      retentionPct: ri?.retentionPct ?? cfg?.defaultRetentionPct ?? 0,
      retainedSupervisors: ri?.retainedSupervisors ?? cfg?.defaultRetainedSupervisors ?? 0,
      retainedTeamFte: 0,
      retainedDirectCost: 0,
      retainedSupervisorCost: 0,
      retainedBenefits: 0,
      retainedIndirect: 0,
      totalAnnual: 0,
    };
  }
  const pct = ri.retentionPct;
  const supCount = ri.retainedSupervisors;
  const retainedTeamFte = internal.directs.reduce((s, d) => s + d.fteCount, 0) * pct;
  const retainedDirectCost = internal.directTotal * pct;
  const retainedSupervisorCost = supCount * inputs.supervisor.salary;
  const retainedBenefits = (retainedDirectCost + retainedSupervisorCost) * inputs.benefitsRate;
  const retainedIndirect = internal.indirectTotal * pct;
  const totalAnnual = retainedDirectCost + retainedSupervisorCost + retainedBenefits + retainedIndirect;
  return {
    enabled: true,
    retentionPct: pct,
    retainedSupervisors: supCount,
    retainedTeamFte,
    retainedDirectCost,
    retainedSupervisorCost,
    retainedBenefits,
    retainedIndirect,
    totalAnnual,
  };
}

export type RoiResult = {
  internal: InternalCostBreakdown;
  outsourced: ReturnType<typeof computeOutsourced>;
  /** Retained in-house staff cost (added to outsourced cost when enabled). */
  retention: RetainedCostBreakdown;
  /** Annual audited loans used as denominator for per-loan figures. */
  auditedLoansAnnual: number;
  perLoanInternal: number;
  /**
   * Per-loan post-outsourcing cost — includes Indecomm fee + retained staff
   * (if retention is enabled). When retention is disabled, equals perLoanOutsourcedOnly.
   */
  perLoanOutsourced: number;
  /** Per-loan cost of just the Indecomm fee, ignoring retention. */
  perLoanOutsourcedOnly: number;
  /** Annual savings = internal − (outsourced + retention). */
  annualSavings: number;
  perLoanSavings: number;
  savingsPct: number; // 0..1
  /** Total post-outsourcing annual cost = outsourced + retention. */
  postOutsourcingAnnual: number;
};

export function computeRoi(model: ModelConfig, inputs: ScenarioInputs): RoiResult {
  const internal = computeInternal(model, inputs);
  const outsourced = computeOutsourced(model, inputs, internal);
  const retention = computeRetention(model, inputs, internal);
  const auditedLoansAnnual = outsourced.totalAuditedLoansAnnual || 0;
  const postOutsourcingAnnual = outsourced.totalAnnual + retention.totalAnnual;
  const perLoanInternal = auditedLoansAnnual > 0 ? internal.totalAnnual / auditedLoansAnnual : 0;
  const perLoanOutsourcedOnly = auditedLoansAnnual > 0 ? outsourced.totalAnnual / auditedLoansAnnual : 0;
  const perLoanOutsourced = auditedLoansAnnual > 0 ? postOutsourcingAnnual / auditedLoansAnnual : 0;
  const annualSavings = internal.totalAnnual - postOutsourcingAnnual;
  const perLoanSavings = perLoanInternal - perLoanOutsourced;
  const savingsPct = internal.totalAnnual > 0 ? annualSavings / internal.totalAnnual : 0;
  return {
    internal,
    outsourced,
    retention,
    auditedLoansAnnual,
    perLoanInternal,
    perLoanOutsourced,
    perLoanOutsourcedOnly,
    annualSavings,
    perLoanSavings,
    savingsPct,
    postOutsourcingAnnual,
  };
}

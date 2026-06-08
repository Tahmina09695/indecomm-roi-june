import { describe, it, expect } from "vitest";
import { pcqc } from "@/models/pcqc";
import { pfqc } from "@/models/pfqc";
import { underwriting } from "@/models/underwriting";
import { servicingQc } from "@/models/servicing-qc";
import { pchPostClose } from "@/models/pch-postclose";
import { pchTrailing } from "@/models/pch-trailing";
import { ppr } from "@/models/ppr";
import {
  buildDefaultInputs,
  computeRoi,
  recomputeDerivedVolumes,
  computeRoleFTEs,
} from "./engine";

/**
 * Tests reproduce the numbers from "4. QC solutions ROI model June 2025.xlsx" → ROI-PCQC
 * with these defaults:
 *  - Total funded: 1000, Conv/FHA: 80%, VA/USDA: 20%
 *  - Sample: 15%
 *  - Conv/FHA productivity: 4 loans/day, $30/hr
 *  - VA/USDA productivity: 3 loans/day, $30/hr
 *  - Reverification: 12 loans/day, $25/hr
 *  - Supervisor: span 8, $100K
 *  - Benefits: 25%
 *  - Indirect: 5 × $1M × 5% = $250,000
 *  - Pricing: $140 Conv/FHA, $175 VA/USDA
 *
 * Excel-derived expectations (computed by hand):
 *   Conv/FHA audited monthly volume = 1000 * 0.8 * 0.15 = 120
 *   VA/USDA audited monthly volume  = 1000 * 0.2 * 0.15 = 30
 *   Reverif effective monthly       = 1000 * 0.15      = 150
 *
 *   FTEs:
 *     Conv/FHA Auditors = 120 / 20 / 4   = 1.5
 *     VA/USDA Auditors  = 30  / 20 / 3   = 0.5
 *     Reverif           = 150 / 20 / 12  = 0.625
 *     Sum directs       = 2.625
 *     Supervisor        = 2.625 / 8       = 0.328125
 *
 *   Annual salaries:
 *     Auditors  = 30 * 2080 = 62,400
 *     Reverif   = 25 * 2080 = 52,000
 *
 *   Direct costs:
 *     Conv/FHA = 1.5    * 62,400 =  93,600
 *     VA/USDA  = 0.5    * 62,400 =  31,200
 *     Reverif  = 0.625  * 52,000 =  32,500
 *     Total direct                = 157,300
 *
 *   Supervisor cost = 0.328125 * 100,000 = 32,812.50
 *
 *   Benefits = (157,300 + 32,812.50) * 0.25 = 47,528.125
 *
 *   Indirect = 5 * (1,000,000 * 0.05) = 250,000
 *
 *   Internal total = 157,300 + 32,812.50 + 47,528.125 + 250,000 = 487,640.625
 *
 *   Outsourced annual:
 *     Conv/FHA = 120 * 140 * 12 = 201,600
 *     VA/USDA  = 30  * 175 * 12 =  63,000
 *     Total                      = 264,600
 *
 *   Annual savings = 487,640.625 - 264,600 = 223,040.625
 *   Audited annual = (120 + 30) * 12 = 1800
 *   Per-loan internal = 487,640.625 / 1800 = 270.911...
 *   Per-loan outsourced = 264,600 / 1800 = 147
 *   Savings % = 223,040.625 / 487,640.625 = 0.4574...
 */
describe("PCQC engine - defaults match Excel", () => {
  const inputs = buildDefaultInputs(pcqc);
  const r = computeRoi(pcqc, inputs);

  it("derived volumes are correct", () => {
    expect(inputs.volumes.convFhaVolume).toBe(800);
    expect(inputs.volumes.vaUsdaVolume).toBe(200);
  });

  it("role FTEs are correct", () => {
    expect(computeRoleFTEs(pcqc.roles[0], inputs, pcqc)).toBeCloseTo(1.5, 6);
    expect(computeRoleFTEs(pcqc.roles[1], inputs, pcqc)).toBeCloseTo(0.5, 6);
    expect(computeRoleFTEs(pcqc.roles[2], inputs, pcqc)).toBeCloseTo(0.625, 6);
  });

  it("direct cost total = 157,300", () => {
    expect(r.internal.directTotal).toBeCloseTo(157_300, 2);
  });

  it("supervisor cost = 32,812.50", () => {
    expect(r.internal.supervisor.annualCost).toBeCloseTo(32_812.5, 2);
  });

  it("benefits = 47,528.125", () => {
    expect(r.internal.benefits).toBeCloseTo(47_528.125, 2);
  });

  it("indirect total = 250,000", () => {
    expect(r.internal.indirectTotal).toBeCloseTo(250_000, 2);
  });

  it("internal annual total = 487,640.625", () => {
    expect(r.internal.totalAnnual).toBeCloseTo(487_640.625, 2);
  });

  it("outsourced annual total = 264,600", () => {
    expect(r.outsourced.totalAnnual).toBeCloseTo(264_600, 2);
  });

  it("annual savings, per-loan figures, savings %", () => {
    expect(r.annualSavings).toBeCloseTo(223_040.625, 2);
    expect(r.auditedLoansAnnual).toBe(1800);
    expect(r.perLoanInternal).toBeCloseTo(487_640.625 / 1800, 4);
    expect(r.perLoanOutsourced).toBeCloseTo(147, 4);
    expect(r.savingsPct).toBeCloseTo(223_040.625 / 487_640.625, 6);
  });
});

describe("recomputeDerivedVolumes", () => {
  it("updates derived values when primitives change", () => {
    const inputs = buildDefaultInputs(pcqc);
    const next = { ...inputs.volumes, totalFunded: 2000, convFhaPct: 0.7, vaUsdaPct: 0.3 };
    const recomputed = recomputeDerivedVolumes(pcqc, next);
    expect(recomputed.convFhaVolume).toBe(1400);
    expect(recomputed.vaUsdaVolume).toBe(600);
  });
});

/**
 * PFQC defaults — driven by APPLICATIONS (not funded loans).
 *  Apps = 1000, Conv/FHA 80%, VA/USDA 20%, Sample 10%
 *  Conv/FHA Auditors: 5 loans/day, $32/hr
 *  VA/USDA Auditors:  4 loans/day, $32/hr
 *  Supervisor span 8, $100K
 *  Benefits 25%
 *  Indirect 5 × $1M × 5% = $250,000
 *  Pricing: $115 Conv/FHA, $150 VA/USDA
 *
 * Hand-computed expected values:
 *   Conv/FHA audited monthly  = 1000 * 0.8 * 0.10 = 80
 *   VA/USDA audited monthly   = 1000 * 0.2 * 0.10 = 20
 *
 *   FTEs:
 *     Conv/FHA = 80 / 20 / 5 = 0.8
 *     VA/USDA  = 20 / 20 / 4 = 0.25
 *     Sum = 1.05
 *     Supervisor = 1.05 / 8 = 0.13125
 *
 *   Annual salary = 32 * 2080 = 66,560
 *   Direct Conv/FHA = 0.8  * 66,560 = 53,248
 *   Direct VA/USDA  = 0.25 * 66,560 = 16,640
 *   Direct total                     = 69,888
 *
 *   Supervisor cost = 0.13125 * 100,000 = 13,125
 *
 *   Benefits = (69,888 + 13,125) * 0.25 = 20,753.25
 *
 *   Indirect = 250,000
 *
 *   Internal total = 69,888 + 13,125 + 20,753.25 + 250,000 = 353,766.25
 *
 *   Outsourced annual:
 *     Conv/FHA = 80 * 115 * 12 = 110,400
 *     VA/USDA  = 20 * 150 * 12 =  36,000
 *     Total                     = 146,400
 *
 *   Annual savings = 207,366.25
 *   Audited/yr     = (80 + 20) * 12 = 1200
 *   Per-loan internal   = 353,766.25 / 1200 = 294.8052...
 *   Per-loan outsourced = 146,400    / 1200 = 122
 *   Savings %           = 207,366.25 / 353,766.25 = 0.5861...
 */
describe("PFQC engine - defaults match Excel", () => {
  const inputs = buildDefaultInputs(pfqc);
  const r = computeRoi(pfqc, inputs);

  it("derived volumes are correct", () => {
    expect(inputs.volumes.convFhaVolume).toBe(800);
    expect(inputs.volumes.vaUsdaVolume).toBe(200);
    expect(inputs.volumes.convFhaAudited).toBe(80);
    expect(inputs.volumes.vaUsdaAudited).toBe(20);
    expect(inputs.volumes.totalAudited).toBe(100);
  });

  it("role FTEs are correct", () => {
    expect(computeRoleFTEs(pfqc.roles[0], inputs, pfqc)).toBeCloseTo(0.8, 6);
    expect(computeRoleFTEs(pfqc.roles[1], inputs, pfqc)).toBeCloseTo(0.25, 6);
  });

  it("direct cost total = 69,888", () => {
    expect(r.internal.directTotal).toBeCloseTo(69_888, 2);
  });

  it("supervisor cost = 13,125", () => {
    expect(r.internal.supervisor.annualCost).toBeCloseTo(13_125, 2);
  });

  it("benefits = 20,753.25", () => {
    expect(r.internal.benefits).toBeCloseTo(20_753.25, 2);
  });

  it("indirect total = 250,000", () => {
    expect(r.internal.indirectTotal).toBeCloseTo(250_000, 2);
  });

  it("internal annual total = 353,766.25", () => {
    expect(r.internal.totalAnnual).toBeCloseTo(353_766.25, 2);
  });

  it("outsourced annual total = 146,400", () => {
    expect(r.outsourced.totalAnnual).toBeCloseTo(146_400, 2);
  });

  it("annual savings, per-loan figures, savings %", () => {
    expect(r.annualSavings).toBeCloseTo(207_366.25, 2);
    expect(r.auditedLoansAnnual).toBe(1200);
    expect(r.perLoanInternal).toBeCloseTo(353_766.25 / 1200, 4);
    expect(r.perLoanOutsourced).toBeCloseTo(122, 4);
    expect(r.savingsPct).toBeCloseTo(207_366.25 / 353_766.25, 6);
  });
});

/**
 * Underwriting defaults — driven by APPLICATIONS, single role, per-FTE pricing.
 *  Apps = 750, Pull-through 70% (funded = 525)
 *  UW: 2.5 loans/day, $42/hr
 *  Supervisor span 8, $100K, Benefits 25%
 *  Indirect 5 × $1M × 5% = $250,000
 *  Indecomm pricing: per-FTE, $3,450/mo, FTEs = in-house × 1.2
 *
 * Hand-computed expected values:
 *   Daily app load            = 750 / 20             = 37.5 apps/day
 *   UW FTEs                   = 37.5 / 2.5           = 15
 *   Annual salary             = 42 * 2080            = 87,360
 *   Direct UW cost            = 15 * 87,360          = 1,310,400
 *   Supervisor FTE            = 15 / 8               = 1.875
 *   Supervisor cost           = 1.875 * 100,000      = 187,500
 *   Benefits                  = (1,310,400 + 187,500) * 0.25 = 374,475
 *   Indirect total            = 5 * 50,000           = 250,000
 *   Internal total            =                       2,122,375
 *
 *   Indecomm FTEs             = 15 * 1.2             = 18
 *   Indecomm annual           = 18 * 3,450 * 12      = 745,200
 *
 *   Annual savings            = 2,122,375 - 745,200  = 1,377,175
 *   Per-loan denominator      = apps × 12 = 9,000
 *   Per-loan internal         = 2,122,375 / 9,000    ≈ 235.819
 *   Per-loan outsourced       = 745,200   / 9,000    = 82.80
 *   Savings %                 = 1,377,175 / 2,122,375 ≈ 0.6489 (64.9%)
 */
describe("Underwriting engine - defaults match Excel", () => {
  const inputs = buildDefaultInputs(underwriting);
  const r = computeRoi(underwriting, inputs);

  it("derived funded volume = 525", () => {
    expect(inputs.volumes.fundedDerived).toBe(525);
  });

  it("UW FTEs = 15", () => {
    expect(computeRoleFTEs(underwriting.roles[0], inputs, underwriting)).toBeCloseTo(15, 6);
  });

  it("direct cost = 1,310,400", () => {
    expect(r.internal.directTotal).toBeCloseTo(1_310_400, 2);
  });

  it("supervisor cost = 187,500", () => {
    expect(r.internal.supervisor.annualCost).toBeCloseTo(187_500, 2);
  });

  it("benefits = 374,475", () => {
    expect(r.internal.benefits).toBeCloseTo(374_475, 2);
  });

  it("indirect total = 250,000", () => {
    expect(r.internal.indirectTotal).toBeCloseTo(250_000, 2);
  });

  it("internal annual total = 2,122,375", () => {
    expect(r.internal.totalAnnual).toBeCloseTo(2_122_375, 2);
  });

  it("Indecomm FTEs = 15 × 1.2 = 18", () => {
    const line = r.outsourced.items[0];
    expect(line.monthlyVolumeOrFTEs).toBeCloseTo(18, 6);
  });

  it("outsourced annual total = 745,200", () => {
    expect(r.outsourced.totalAnnual).toBeCloseTo(745_200, 2);
  });

  it("annual savings, per-loan figures, savings %", () => {
    expect(r.annualSavings).toBeCloseTo(1_377_175, 2);
    expect(r.auditedLoansAnnual).toBe(9000);
    expect(r.perLoanInternal).toBeCloseTo(2_122_375 / 9000, 4);
    expect(r.perLoanOutsourced).toBeCloseTo(745_200 / 9000, 4);
    expect(r.savingsPct).toBeCloseTo(1_377_175 / 2_122_375, 6);
  });
});

/**
 * Servicing QC — performing vs non-performing.
 *  Volume 1300; performing 40% → 520, non-performing 60% → 780
 *  Perf prod 4.5/day, non-perf 2/day; both $35/hr
 *  Sup span 10, salary $100K; benefits 25%; indirect $250K
 *  Pricing $75 perf / $145 non-perf, per loan
 *
 *  FTEs: perf 520/20/4.5 ≈ 5.778; non-perf 780/20/2 = 19.5; total 25.278; sup 2.528
 *  Annual salary $35*2080 = 72,800
 *  Direct = (5.778+19.5) * 72,800 = 1,840,222.22
 *  Sup cost = 2.528 * 100,000 = 252,777.78
 *  Benefits = (1,840,222 + 252,778) * 0.25 = 523,250.00
 *  Indirect = 250,000
 *  Internal = 2,866,250.00
 *  Outsourced = 520*75*12 + 780*145*12 = 468,000 + 1,357,200 = 1,825,200
 *  Savings = 1,041,050; audited/yr = 15,600; savings % ≈ 0.3632
 */
describe("Servicing QC engine - defaults match Excel", () => {
  const inputs = buildDefaultInputs(servicingQc);
  const r = computeRoi(servicingQc, inputs);

  it("derived volumes", () => {
    expect(inputs.volumes.performingVolume).toBe(520);
    expect(inputs.volumes.nonPerformingVolume).toBe(780);
  });
  it("internal total ≈ 2,866,250", () => {
    expect(r.internal.totalAnnual).toBeCloseTo(2_866_250, 1);
  });
  it("outsourced annual = 1,825,200", () => {
    expect(r.outsourced.totalAnnual).toBeCloseTo(1_825_200, 2);
  });
  it("annual savings, audited/yr, savings %", () => {
    expect(r.annualSavings).toBeCloseTo(1_041_050, 1);
    expect(r.auditedLoansAnnual).toBe(15_600);
    expect(r.savingsPct).toBeCloseTo(1_041_050 / 2_866_250, 5);
  });
});

/**
 * PCH Post-Close — 4 roles with role multipliers.
 *  Volume 750; Auditors 20×2, Follow-up 65×0.1, Exception 50×0.1, Mailroom 70×1
 *  Hr rates: $25/$21/$20/$18; sup span 10 @ $65K; benefits 30%; indirect $250K (5×500K×10%)
 *  Pricing $25 per funded loan; per-loan denom = funded × 12.
 *
 *  FTEs: 3.75, 0.0577, 0.075, 0.5357 → total 4.418; sup 0.4418
 *  Direct = 195,000 + 2,520 + 3,120 + 20,057.14 = 220,697.14
 *  Sup = 28,719.64; Benefits = (220,697.14+28,719.64)*0.30 = 74,825.04
 *  Indirect = 250,000
 *  Internal = 574,241.82
 *  Outsourced = 750*25*12 = 225,000
 *  Savings = 349,241.82; audited/yr 9,000; savings% ≈ 0.6082
 */
describe("PCH Post-Close engine - defaults match Excel", () => {
  const inputs = buildDefaultInputs(pchPostClose);
  const r = computeRoi(pchPostClose, inputs);

  it("internal total ≈ 574,241.82", () => {
    expect(r.internal.totalAnnual).toBeCloseTo(574_241.82, 0);
  });
  it("outsourced annual = 225,000", () => {
    expect(r.outsourced.totalAnnual).toBeCloseTo(225_000, 2);
  });
  it("annual savings, audited/yr, savings %", () => {
    expect(r.annualSavings).toBeCloseTo(349_241.82, 0);
    expect(r.auditedLoansAnnual).toBe(9000);
    expect(r.savingsPct).toBeCloseTo(0.608179, 4);
  });
});

/**
 * PCH Trailing Docs — same 4-role structure with different defaults.
 *  Volume 750; Auditors 55×2, Follow-up 65×1, Exception 50×1, Mailroom 80×1
 *  Hr rates: $25/$25/$23/$20; sup span 10 @ $65K; benefits 30%; indirect $250K
 *  Pricing $16 per funded loan
 *
 *  Direct total ≈ 156,289.09
 *  Sup ≈ 20,535.51; Benefits ≈ 53,047.38; Indirect 250,000
 *  Internal ≈ 479,871.98
 *  Outsourced = 750*16*12 = 144,000
 *  Savings ≈ 335,871.98; savings% ≈ 0.6999
 */
describe("PCH Trailing Docs engine - defaults match Excel", () => {
  const inputs = buildDefaultInputs(pchTrailing);
  const r = computeRoi(pchTrailing, inputs);

  it("internal total ≈ 479,872", () => {
    expect(r.internal.totalAnnual).toBeCloseTo(479_871.98, 0);
  });
  it("outsourced annual = 144,000", () => {
    expect(r.outsourced.totalAnnual).toBeCloseTo(144_000, 2);
  });
  it("annual savings, audited/yr, savings %", () => {
    expect(r.annualSavings).toBeCloseTo(335_871.98, 0);
    expect(r.auditedLoansAnnual).toBe(9000);
    expect(r.savingsPct).toBeCloseTo(0.699920, 4);
  });
  it("retention defaults are seeded but disabled by default", () => {
    expect(inputs.retention).toBeDefined();
    expect(inputs.retention!.enabled).toBe(false);
    expect(inputs.retention!.retentionPct).toBeCloseTo(0.15, 6);
    expect(inputs.retention!.retainedSupervisors).toBeCloseTo(0.25, 6);
    expect(r.retention.enabled).toBe(false);
    expect(r.retention.totalAnnual).toBe(0);
    expect(r.postOutsourcingAnnual).toBeCloseTo(144_000, 2);
  });
});

/**
 * PCH Trailing Docs WITH retention enabled.
 *  - 15% retention + 0.25 supervisor (the QC/PCH-group defaults)
 *  - Same volume/role defaults as the base PCH Trailing Docs test above
 *
 * Hand-computed:
 *  Direct FTE total       = 3.1593
 *  Direct cost total      = $156,289.09
 *
 *  Retained direct labor  = 156,289.09 × 0.15   = 23,443.36
 *  Retained supervisor    = 0.25 × $65,000      = 16,250.00
 *  Retained benefits      = (23,443.36 + 16,250) × 0.30 = 11,908.01
 *  Retained indirect      = 250,000 × 0.15      = 37,500.00
 *  RETENTION TOTAL                              = 89,101.37
 *
 *  Indecomm fee                                 = 144,000.00
 *  POST-OUTSOURCING TOTAL                       = 233,101.37
 *  Annual savings (vs in-house)                 = 479,871.98 − 233,101.37 = 246,770.61
 *  Savings %                                    ≈ 51.42%
 */
describe("PCH Trailing Docs WITH retention enabled (15% + 0.25 sup)", () => {
  const baseline = buildDefaultInputs(pchTrailing);
  const inputs = {
    ...baseline,
    retention: { ...baseline.retention!, enabled: true },
  };
  const r = computeRoi(pchTrailing, inputs);

  it("retention is enabled and computes the retained-staff total", () => {
    expect(r.retention.enabled).toBe(true);
    expect(r.retention.retentionPct).toBeCloseTo(0.15, 6);
    expect(r.retention.retainedSupervisors).toBeCloseTo(0.25, 6);
    expect(r.retention.retainedDirectCost).toBeCloseTo(23_443.36, 1);
    expect(r.retention.retainedSupervisorCost).toBeCloseTo(16_250, 2);
    expect(r.retention.retainedBenefits).toBeCloseTo(11_908.01, 1);
    expect(r.retention.retainedIndirect).toBeCloseTo(37_500, 2);
    expect(r.retention.totalAnnual).toBeCloseTo(89_101.37, 1);
  });

  it("post-outsourcing total = Indecomm + retention", () => {
    expect(r.outsourced.totalAnnual).toBeCloseTo(144_000, 2);
    expect(r.postOutsourcingAnnual).toBeCloseTo(233_101.37, 1);
  });

  it("annual savings drops vs no retention; savings % ≈ 51.42%", () => {
    expect(r.annualSavings).toBeCloseTo(246_770.61, 1);
    expect(r.savingsPct).toBeCloseTo(0.5142, 3);
  });

  it("per-loan outsourced reflects retention", () => {
    // 9000 audited loans/yr → 233,101.37 / 9,000 ≈ $25.90
    expect(r.perLoanOutsourced).toBeCloseTo(25.9002, 3);
    expect(r.perLoanOutsourcedOnly).toBeCloseTo(16.0, 4);
  });

  it("retention OFF (default) keeps the old answer", () => {
    const inputsOff = buildDefaultInputs(pchTrailing);
    const rOff = computeRoi(pchTrailing, inputsOff);
    expect(rOff.postOutsourcingAnnual).toBeCloseTo(144_000, 2);
    expect(rOff.annualSavings).toBeCloseTo(335_871.98, 0);
  });
});

/**
 * Smoke-test that the OTHER QC + PCH models also expose retention defaults
 * (15% + 0.25 sup), and that the engine correctly leaves them off by default.
 * Engine math for each is already covered by the base tests above; we just
 * verify that flipping retention on adds a positive cost without breaking
 * the other numbers.
 */
describe("Retention defaults applied to PCQC, PFQC, Servicing QC, PCH Post-Close", () => {
  const cases: { name: string; model: typeof pchTrailing }[] = [
    { name: "PCQC", model: pcqc },
    { name: "PFQC", model: pfqc },
    { name: "Servicing QC", model: servicingQc },
    { name: "PCH Post-Close", model: pchPostClose },
  ];
  for (const { name, model } of cases) {
    it(`${name} — retention seeded with 15% + 0.25 sup, OFF by default`, () => {
      const inputs = buildDefaultInputs(model);
      expect(inputs.retention).toBeDefined();
      expect(inputs.retention!.enabled).toBe(false);
      expect(inputs.retention!.retentionPct).toBeCloseTo(0.15, 6);
      expect(inputs.retention!.retainedSupervisors).toBeCloseTo(0.25, 6);
      const rOff = computeRoi(model, inputs);
      expect(rOff.retention.totalAnnual).toBe(0);
      expect(rOff.postOutsourcingAnnual).toBeCloseTo(rOff.outsourced.totalAnnual, 2);
    });

    it(`${name} — flipping retention ON increases post-outsourcing total`, () => {
      const inputs = buildDefaultInputs(model);
      inputs.retention = { ...inputs.retention!, enabled: true };
      const rOn = computeRoi(model, inputs);
      expect(rOn.retention.enabled).toBe(true);
      expect(rOn.retention.totalAnnual).toBeGreaterThan(0);
      expect(rOn.postOutsourcingAnnual).toBeGreaterThan(rOn.outsourced.totalAnnual);
      // Savings should still be positive (outsourcing remains a win even with retention).
      expect(rOn.annualSavings).toBeGreaterThan(0);
    });
  }
});

/**
 * PPR — single role, per-FTE pricing with ROUND(FTE,0)+1.
 *  Volume 500; PPR Auditors 4/day, $30/hr
 *  Sup span 10, $75K; benefits 25%; indirect 5×$500K×5% = $125K
 *  Indecomm: per-FTE $2,750/mo; FTEs = round(in-house) + 1
 *
 *  FTE = 500/20/4 = 6.25; sup 0.625
 *  Direct = 6.25 * 62,400 = 390,000
 *  Sup = 46,875; Benefits = (390,000+46,875)*0.25 = 109,218.75
 *  Indirect = 125,000
 *  Internal = 671,093.75
 *
 *  Indecomm FTEs = round(6.25)=6, +1 = 7
 *  Outsourced = 7 * 2,750 * 12 = 231,000
 *  Savings = 440,093.75; audited/yr 6,000; savings% ≈ 0.6558
 */
describe("PPR engine - defaults match Excel", () => {
  const inputs = buildDefaultInputs(ppr);
  const r = computeRoi(ppr, inputs);

  it("internal total = 671,093.75", () => {
    expect(r.internal.totalAnnual).toBeCloseTo(671_093.75, 2);
  });
  it("Indecomm FTEs = round(6.25) + 1 = 7", () => {
    expect(r.outsourced.items[0].monthlyVolumeOrFTEs).toBe(7);
  });
  it("outsourced annual = 231,000", () => {
    expect(r.outsourced.totalAnnual).toBeCloseTo(231_000, 2);
  });
  it("annual savings, audited/yr, savings %", () => {
    expect(r.annualSavings).toBeCloseTo(440_093.75, 2);
    expect(r.auditedLoansAnnual).toBe(6000);
    expect(r.savingsPct).toBeCloseTo(440_093.75 / 671_093.75, 5);
  });
});

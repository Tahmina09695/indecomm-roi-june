import { describe, it, expect } from "vitest";
import { idxgenius } from "@/models/idxgenius";
import { idxgeniusBulk } from "@/models/idxgenius-bulk";
import { decisiongenius } from "@/models/decisiongenius";
import { navyFederal } from "@/models/navy-federal";
import { buildSaasDefaults, computeSaasRoi } from "./saas-engine";

/**
 * IDXGenius defaults — 4 roles, volume 500/month.
 *
 *  Roles → (FTE_before, FTE_after) using Math.round() (round-half-away-from-zero):
 *    Processors:    500/25       = 20         → 20/1.30 = 15.38 → 15
 *    Underwriters:  500/20/2.5   = 10         → 10/1.20 = 8.33 → 8
 *    Closers:       500/20/3     = 8.33 → 8   → 8/1.10 = 7.58 → 8
 *    Auditors:      500/20/2     = 12.5 → 13  → 12.5/1.35 = 9.26 → 9
 *
 *  Annual salaries: $32×2080=66,560; $42×2080=87,360
 *
 *  Direct roles (cost):
 *    Processors:   20×66,560 = 1,331,200   ; after 15×66,560 = 998,400
 *    Underwriters: 10×87,360 = 873,600     ; after 8×87,360  = 698,880
 *    Closers:      8×66,560  = 532,480     ; after 8×66,560  = 532,480
 *    Auditors:     13×87,360 = 1,135,680   ; after 9×87,360  = 786,240
 *    Direct roles total: before 3,872,960  after 3,016,000
 *
 *  Supervisor: span 10, $95K
 *    Before FTE = 51/10 = 5.1  cost = 484,500
 *    After  FTE = 40/10 = 4.0  cost = 380,000
 *
 *  Direct total:    before 4,357,460  after 3,396,000
 *  Benefits 25%:    before 1,089,365  after   849,000
 *
 *  Indirect (monthly × 0.5 each; "after" scales by FTE ratio 40/51 ≈ 0.7843):
 *    Total before = 1,750,000
 *    Total after  = 1,750,000 × (40/51) ≈ 1,372,549.02
 *
 *  Annual:
 *    Before = 4,357,460 + 1,089,365 + 1,750,000 = 7,196,825
 *    After  = 3,396,000 +   849,000 + 1,372,549.02 = 5,617,549.02
 *
 *  Platform:
 *    Annual license = 500 × 12 × $14 = 84,000
 *    Y1 spend = 84,000 + 40,000 = 124,000
 *    Y2 spend = 84,000
 *
 *  Year 1:
 *    Total = 5,617,549.02 + 124,000 = 5,741,549.02
 *    Savings = 7,196,825 − 5,741,549.02 = 1,455,275.98
 *    Savings % ≈ 0.2022
 *    ROI %     ≈ 11.7361
 *
 *  Year 2:
 *    Total = 5,617,549.02 + 84,000 = 5,701,549.02
 *    Savings = 1,495,275.98
 *    Savings % ≈ 0.2078
 *    ROI %     ≈ 17.8009
 */
describe("IDXGenius engine - defaults match Excel", () => {
  const inputs = buildSaasDefaults(idxgenius);
  const r = computeSaasRoi(idxgenius, inputs);

  it("role FTEs before/after", () => {
    const proc = r.internal.roles.find((x) => x.roleId === "processors")!;
    const uw   = r.internal.roles.find((x) => x.roleId === "underwriters")!;
    const cls  = r.internal.roles.find((x) => x.roleId === "closers")!;
    const aud  = r.internal.roles.find((x) => x.roleId === "auditors")!;
    expect(proc.fteBefore).toBe(20);
    expect(proc.fteAfter).toBe(15);
    expect(uw.fteBefore).toBe(10);
    expect(uw.fteAfter).toBe(8);
    expect(cls.fteBefore).toBe(8);
    expect(cls.fteAfter).toBe(8);
    expect(aud.fteBefore).toBe(13); // Math.round(12.5) = 13 in JS
    expect(aud.fteAfter).toBe(9);
  });

  it("direct totals", () => {
    expect(r.internal.directTotalBefore).toBeCloseTo(4_357_460, 2);
    expect(r.internal.directTotalAfter).toBeCloseTo(3_396_000, 2);
  });

  it("benefits", () => {
    expect(r.internal.benefitsBefore).toBeCloseTo(1_089_365, 2);
    expect(r.internal.benefitsAfter).toBeCloseTo(849_000, 2);
  });

  it("indirect totals", () => {
    expect(r.internal.indirectTotalBefore).toBeCloseTo(1_750_000, 2);
    // 1,750,000 × (40/51)
    expect(r.internal.indirectTotalAfter).toBeCloseTo(1_750_000 * (40 / 51), 2);
  });

  it("annual before/after", () => {
    expect(r.internal.annualBefore).toBeCloseTo(7_196_825, 2);
    expect(r.internal.annualAfter).toBeCloseTo(4_245_000 + 1_750_000 * (40 / 51), 2);
  });

  it("platform spend", () => {
    expect(r.platform.annualLicense).toBe(84_000);
    expect(r.platform.year1Spend).toBe(124_000);
    expect(r.platform.year2Spend).toBe(84_000);
  });

  it("year 1 savings + ROI", () => {
    expect(r.year1.savings).toBeCloseTo(1_455_275.98, 0);
    expect(r.year1.savingsPct).toBeCloseTo(0.2022, 3);
    expect(r.year1.roiPct).toBeCloseTo(11.7361, 3);
  });

  it("year 2 savings + ROI", () => {
    expect(r.year2.savings).toBeCloseTo(1_495_275.98, 0);
    expect(r.year2.savingsPct).toBeCloseTo(0.2078, 3);
    expect(r.year2.roiPct).toBeCloseTo(17.8009, 3);
  });
});

/**
 * DecisionGenius defaults — 1 role (UW), volume 500/month, +68% productivity.
 *
 *  UW FTE before = ROUND(500/20/2.5,0) = ROUND(10) = 10
 *  Improved prod = 2.5 × 1.68 = 4.2
 *  UW FTE after  = ROUND(500/20/4.2,0) = ROUND(5.952) = 6
 *
 *  Annual salary = 43 × 2080 = 89,440
 *  Direct UW cost: before 894,400  after 536,640
 *  Supervisor (span 10, $95K): FTE_b 1.0 cost 95,000; FTE_a 0.6 cost 57,000
 *  Direct total: before 989,400  after 593,640
 *  Benefits 25%: before 247,350  after 148,410
 *
 *  Indirect: 5 × $1M × 0.1 = $500,000 before; ratio 6/10 = 0.6 → after 300,000
 *
 *  Annual: before 1,736,750  after 1,042,050
 *
 *  Platform: 500×12×$75 = 450,000 license; impl 75K
 *    Y1 platform = 525,000; Y2 platform = 450,000
 *
 *  Year 1 total = 1,042,050 + 525,000 = 1,567,050
 *    savings = 169,700; savings % ≈ 0.0977; ROI % ≈ 0.3232
 *
 *  Year 2 total = 1,492,050
 *    savings = 244,700; savings % ≈ 0.1409; ROI % ≈ 0.5438
 */
describe("DecisionGenius engine - defaults match Excel", () => {
  const inputs = buildSaasDefaults(decisiongenius);
  const r = computeSaasRoi(decisiongenius, inputs);

  it("UW FTEs", () => {
    const uw = r.internal.roles[0];
    expect(uw.fteBefore).toBe(10);
    expect(uw.fteAfter).toBe(6);
  });

  it("direct + benefits + indirect totals", () => {
    expect(r.internal.directTotalBefore).toBeCloseTo(989_400, 2);
    expect(r.internal.directTotalAfter).toBeCloseTo(593_640, 2);
    expect(r.internal.benefitsBefore).toBeCloseTo(247_350, 2);
    expect(r.internal.benefitsAfter).toBeCloseTo(148_410, 2);
    expect(r.internal.indirectTotalBefore).toBeCloseTo(500_000, 2);
    expect(r.internal.indirectTotalAfter).toBeCloseTo(300_000, 2);
  });

  it("annual before/after", () => {
    expect(r.internal.annualBefore).toBeCloseTo(1_736_750, 2);
    expect(r.internal.annualAfter).toBeCloseTo(1_042_050, 2);
  });

  it("platform spend", () => {
    expect(r.platform.annualLicense).toBe(450_000);
    expect(r.platform.year1Spend).toBe(525_000);
    expect(r.platform.year2Spend).toBe(450_000);
  });

  it("year 1 + year 2 savings and ROI", () => {
    expect(r.year1.savings).toBeCloseTo(169_700, 2);
    expect(r.year1.savingsPct).toBeCloseTo(0.0977, 3);
    expect(r.year1.roiPct).toBeCloseTo(0.3232, 4);
    expect(r.year2.savings).toBeCloseTo(244_700, 2);
    expect(r.year2.savingsPct).toBeCloseTo(0.1409, 3);
    expect(r.year2.roiPct).toBeCloseTo(0.5438, 4);
  });
});

/**
 * IDXGenius — Bulk Business. Single role (Loan Setup team).
 *  Volume 2,000/month; baseline 10 loans/FTE/day; $20/hr; +70% lift.
 *  Sup span 10, $95K; benefits 25%; indirect 5 pools × 0.5 = $1.75M before.
 *  Pricing: $14/loan/mo, $40K impl.
 *
 *  Setup FTEs Before = round(2000/20/10)       = round(10)   = 10
 *  Improved prod     = 10 * 1.7                              = 17
 *  Setup FTEs After  = round(2000/20/17)       = round(5.88) = 6
 *
 *  Annual salary  = 20 * 2080 = 41,600
 *  Direct (role only): before 10 * 41,600 = 416,000; after 6 * 41,600 = 249,600
 *
 *  Supervisor: Before 1.0 FTE × 95K = 95,000; After 0.6 FTE × 95K = 57,000
 *  Direct total:   Before 511,000;            After 306,600
 *  Benefits 25%:   Before 127,750;            After 76,650
 *
 *  Indirect:       Before 1,750,000; After 1,750,000 × (6/10) = 1,050,000
 *
 *  Annual:         Before 2,388,750;          After 1,433,250
 *
 *  Platform:
 *    Annual license = 2000 × 12 × 14 = 336,000
 *    Y1 spend = 336,000 + 40,000     = 376,000
 *    Y2 spend = 336,000
 *
 *  Year 1: Savings = 579,500; Savings % ≈ 0.2426; ROI % ≈ 1.5412
 *  Year 2: Savings = 619,500; Savings % ≈ 0.2593; ROI % ≈ 1.8438
 */
describe("IDXGenius Bulk engine - matches hand calculations", () => {
  const inputs = buildSaasDefaults(idxgeniusBulk);
  const r = computeSaasRoi(idxgeniusBulk, inputs);

  it("FTEs before/after", () => {
    expect(r.internal.roles[0].fteBefore).toBe(10);
    expect(r.internal.roles[0].fteAfter).toBe(6);
  });

  it("direct + benefits + indirect totals", () => {
    expect(r.internal.directTotalBefore).toBeCloseTo(511_000, 2);
    expect(r.internal.directTotalAfter).toBeCloseTo(306_600, 2);
    expect(r.internal.benefitsBefore).toBeCloseTo(127_750, 2);
    expect(r.internal.benefitsAfter).toBeCloseTo(76_650, 2);
    expect(r.internal.indirectTotalBefore).toBeCloseTo(1_750_000, 2);
    expect(r.internal.indirectTotalAfter).toBeCloseTo(1_050_000, 2);
  });

  it("annual before/after", () => {
    expect(r.internal.annualBefore).toBeCloseTo(2_388_750, 2);
    expect(r.internal.annualAfter).toBeCloseTo(1_433_250, 2);
  });

  it("platform spend", () => {
    expect(r.platform.annualLicense).toBe(336_000);
    expect(r.platform.year1Spend).toBe(376_000);
    expect(r.platform.year2Spend).toBe(336_000);
  });

  it("year 1 + year 2 savings and ROI", () => {
    expect(r.year1.savings).toBeCloseTo(579_500, 2);
    expect(r.year1.savingsPct).toBeCloseTo(0.2426, 3);
    expect(r.year1.roiPct).toBeCloseTo(1.5412, 3);
    expect(r.year2.savings).toBeCloseTo(619_500, 2);
    expect(r.year2.savingsPct).toBeCloseTo(0.2593, 3);
    expect(r.year2.roiPct).toBeCloseTo(1.8438, 3);
  });
});

/**
 * Navy Federal Credit Union — Custom RFP Model.
 *
 * Four roles with independent volumes, fixed annual license (NFCU's
 * RFP-quoted bundle price), a $3M current-platform-cost line that adds
 * to the Before column, and currently a 0% annual escalator (per user
 * request — hook remains in the model for easy restore to 3%).
 *
 *   Indexing & Data Extraction: 5,167 /mo · 12/day · $22/hr · 100% lift · ELIMINATED
 *   RESPA auditor:              5,167 /mo · 6/day · $30/hr · +75% lift
 *   Post-Close auditor:         2,075 /mo · 6/day · $30/hr · +60% lift
 *   Trailing Docs:              6,667 /mo · 10/day · $30/hr · +50% lift
 *   Sup span 10 @ $95K · benefits 25% · indirect 5×$1M×5% = $250K
 *
 *   Fixed annual license: $3,242,000  (CEO-revised pricing, June 2026 — was $3,989,590)
 *   Implementation:       $520,000    (one-time, Y1)
 *   Current platform:     $3,000,000  (legacy Paradatec + Hyland + Trinity assumption)
 *   Escalator:            0% (Y1 = Y2 = Y3)
 *
 * Hand-computed expectations:
 *   FTEs Before: Index 22 + RESPA 43 + PC 17 + TD 33 = 115 direct + 11.5 sup = 126.5
 *   FTEs After:  Index  0 + RESPA 25 + PC 11 + TD 22 =  58 direct +  5.8 sup =  63.8
 *   Annual Before: $13,128,025 (incl. $3M current platform)
 *   Annual After:  $5,338,836.96
 *   Y1 platform spend: $3,762,000  (license + impl)
 *   Y2/Y3 platform:    $3,242,000  (no escalator)
 *   Y1 savings:    $4,027,188
 *   Y2/Y3 savings: $4,547,188 each
 *   3-yr cumulative: $13,121,564
 */
describe("Navy Federal — Custom RFP Model", () => {
  const inputs = buildSaasDefaults(navyFederal);
  const r = computeSaasRoi(navyFederal, inputs);

  it("seeds all four volume inputs from NFCU Table 1", () => {
    expect(inputs.volumes.indexingVolume).toBe(5167);
    expect(inputs.volumes.respaVolume).toBe(5167);
    expect(inputs.volumes.postCloseVolume).toBe(2075);
    expect(inputs.volumes.trailingDocsVolume).toBe(6667);
  });

  it("seeds NFCU-specific pricing (fixed annual license + current platform)", () => {
    expect(inputs.pricing.fixedAnnualLicense).toBe(3_242_000);
    expect(inputs.pricing.currentPlatformAnnualCost).toBe(3_000_000);
    expect(inputs.pricing.oneTimeImplementationFee).toBe(520_000);
  });

  it("computes FTEs per role using each role's own volume", () => {
    const idx = r.internal.roles.find((x) => x.roleId === "indexingExtraction")!;
    const respa = r.internal.roles.find((x) => x.roleId === "respaAuditor")!;
    const pc = r.internal.roles.find((x) => x.roleId === "postCloseAuditor")!;
    const td = r.internal.roles.find((x) => x.roleId === "trailingDocsAnalyst")!;
    // Indexing: eliminated by IDXGenius — After FTE forced to 0.
    expect(idx.fteBefore).toBe(22);
    expect(idx.fteAfter).toBe(0);
    expect(respa.fteBefore).toBe(43);
    expect(respa.fteAfter).toBe(25);
    expect(pc.fteBefore).toBe(17);
    expect(pc.fteAfter).toBe(11);
    expect(td.fteBefore).toBe(33);
    expect(td.fteAfter).toBe(22);
  });

  it("adds current platform cost ($3M) to Annual Before only", () => {
    expect(r.internal.currentPlatformAnnualCost).toBe(3_000_000);
    expect(r.internal.annualBefore).toBeCloseTo(13_128_025, 0);
    expect(r.internal.annualAfter).toBeCloseTo(5_338_837, 0);
  });

  it("uses fixed annual license, not per-loan calculation; escalator currently 0%", () => {
    expect(r.platform.annualLicense).toBe(3_242_000);
    expect(r.platform.year1Spend).toBe(3_242_000 + 520_000); // 3,762,000
    // 0% escalator → Y2 license = Y1 license.
    expect(r.platform.year2Spend).toBeCloseTo(3_242_000, 0);
    // 0% escalator → Y3 license = Y1 license.
    expect(r.platform.year3Spend).toBeCloseTo(3_242_000, 0);
  });

  it("year 1 / 2 / 3 savings — Y2 and Y3 equal because escalator is 0%", () => {
    //   Y1 savings = 13,128,025 − (5,338,837 + 3,762,000) = 4,027,188
    //   Y2 savings = 13,128,025 − (5,338,837 + 3,242,000) = 4,547,188
    //   Y3 savings = same as Y2 (no escalator)
    expect(r.year1.savings).toBeCloseTo(4_027_188, 0);
    expect(r.year1.savingsPct).toBeCloseTo(0.3068, 2);
    expect(r.year2.savings).toBeCloseTo(4_547_188, 0);
    expect(r.year3.savings).toBeCloseTo(4_547_188, 0);
  });

  it("3-year cumulative savings ≈ $13,121,564", () => {
    // Y1 + Y2 + Y3 = 4,027,188 + 4,547,188 + 4,547,188
    expect(r.threeYearCumulativeSavings).toBeCloseTo(13_121_564, 0);
  });

  it("FTEs reduced ≈ 62.7 (Indexing role eliminated + audit role lifts)", () => {
    // Before 126.5 (115 direct + 11.5 sup), After 63.8 (58 direct + 5.8 sup).
    expect(r.internal.fteSaved).toBeCloseTo(62.7, 1);
  });
});

/**
 * Engine sanity: a SaaS model WITHOUT currentPlatformAnnualCost should compute
 * exactly as before (zero added to annualBefore). This protects IDX and DG.
 */
describe("SaaS engine — currentPlatformAnnualCost is opt-in", () => {
  it("IDXGenius (no currentPlatformAnnualCost set) has zero current-platform cost", () => {
    const inputs = buildSaasDefaults(idxgenius);
    const r = computeSaasRoi(idxgenius, inputs);
    expect(r.internal.currentPlatformAnnualCost).toBe(0);
    expect(inputs.pricing.currentPlatformAnnualCost).toBe(0);
  });

  it("DecisionGenius (no fixed license) still derives license from per-loan × volume", () => {
    const inputs = buildSaasDefaults(decisiongenius);
    const r = computeSaasRoi(decisiongenius, inputs);
    // DG per-loan = $75 × 500/mo × 12 = $450,000
    expect(r.platform.annualLicense).toBe(450_000);
    expect(inputs.pricing.fixedAnnualLicense).toBeUndefined();
  });
});

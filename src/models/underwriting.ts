import type { ModelConfig } from "./_types";

/**
 * Underwriting (UW) — driven by APPLICATION volume.
 * Defaults derived from "3. Underwriting ROI model June 2025.xlsx" → sheet "ROI-UW".
 *
 *   Apps per month:    750
 *   Funded per month:  apps × 70% pull-through
 *   UW productivity:   2.5 loans/UW/day
 *   UW hourly rate:    $42
 *   Supervisor span:   8
 *   Supervisor salary: $100K
 *   Benefits:          25%
 *   Indirect:          5 × $1M × 5% = $250,000
 *
 *   Indecomm pricing (per-FTE):
 *     FTEs = in-house UW FTEs × 1.2 (offshore overhead allowance)
 *     Monthly price per FTE: $3,450
 *     Annual = FTEs × $3,450 × 12
 *
 *   Per-loan denominator = applications (every app gets reviewed)
 */
export const underwriting: ModelConfig = {
  id: "underwriting",
  name: "Underwriting",
  tagline:
    "Calculate the true in-house cost of underwriting and compare to Indecomm's DecisionGenius-powered outsourced pricing.",
  platform: {
    name: "DecisionGenius",
    logo: "/logos/Decision-Genius-Logo_color_Black.png",
    logoWhite: "/logos/Decision-Genius-Logo_Color_white.png",
    blurb:
      "Indecomm's DecisionGenius platform powers our underwriting service — combining automation, ML-driven decisioning, and rule-based intelligence to deliver faster, more consistent underwriting than a typical in-house team.",
    accentHex: "#2076BA",
  },

  volumeInputs: [
    {
      id: "totalApps",
      label: "Applications per Month",
      type: "number",
      defaultValue: 750,
      help: "Total mortgage applications underwritten per month.",
    },
    {
      id: "pullThrough",
      label: "Pull-Through %",
      type: "percent",
      defaultValue: 0.70,
      help: "% of applications that fund. Used to compute monthly funded loan estimate.",
    },
    {
      id: "fundedDerived",
      label: "Funded Loans per Month",
      type: "derived",
      defaultValue: 525,
      derive: (v) => Math.round((v.totalApps ?? 0) * (v.pullThrough ?? 0)),
    },
  ],

  roles: [
    {
      id: "underwriters",
      label: "Underwriters",
      productivityBasis: "perDay",
      defaultProductivity: 2.5,
      defaultHourlyRate: 42,
      volumeKey: "totalApps",
      appliesSampleRate: false,
      help: "Loans per underwriter per day.",
    },
  ],

  supervisor: { spanOfControl: 8, salary: 100_000 },
  benefitsRate: 0.25,

  indirectCosts: [
    {
      id: "management",
      label: "Management Costs",
      defaultAnnualPool: 1_000_000,
      defaultAllocationPct: 0.05,
      help: "Layered management above the line — often forgotten when sizing in-house teams.",
    },
    {
      id: "occupancy",
      label: "Occupancy & Equipment",
      defaultAnnualPool: 1_000_000,
      defaultAllocationPct: 0.05,
      help: "Rent, workstations, furniture, utilities.",
    },
    {
      id: "technology",
      label: "Technology Related",
      defaultAnnualPool: 1_000_000,
      defaultAllocationPct: 0.05,
      help: "LOS access, AUS / underwriting engines, productivity licenses, IT support.",
    },
    {
      id: "other",
      label: "Other Operating Expenses",
      defaultAnnualPool: 1_000_000,
      defaultAllocationPct: 0.05,
      help: "Training, travel, supplies, miscellaneous opex.",
    },
    {
      id: "gna",
      label: "General, Admin & Corporate",
      defaultAnnualPool: 1_000_000,
      defaultAllocationPct: 0.05,
      help: "HR, Finance, Legal, Compliance allocation. Always forgotten.",
    },
  ],

  pricing: [
    {
      type: "perFTE",
      id: "indecommUw",
      label: "Indecomm Underwriting (per FTE)",
      roleId: "underwriters",
      fteMultiplier: 1.2,
      defaultMonthlyPricePerFTE: 3450,
    },
  ],

  perLoanDenominator: {
    volumeKey: "totalApps",
    unitLabel: "applications",
  },
};

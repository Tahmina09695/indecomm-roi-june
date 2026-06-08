import type { SaasModelConfig } from "./_saas-types";

/**
 * DecisionGenius — SaaS automation ROI calculator (Underwriting platform).
 * Defaults derived from "1.2 DG ROI Model Oct 2025.xlsx" → ROI-DG.
 *
 *   Volume per month (Applications): 500
 *   Underwriters: 2.5 loans/day baseline, $43/hr, +68% productivity uplift
 *   Supervisor span 10, salary $95K
 *   Benefits 25%
 *
 *   Indirect (annual pool × allocation %):
 *     Management            1,000,000  × 0.1
 *     Occupancy & Equipment 1,000,000  × 0.1
 *     Technology Related    1,000,000  × 0.1
 *     Other Operating Exp   1,000,000  × 0.1
 *     G&A and Corporate     1,000,000  × 0.1
 *
 *   Pricing:
 *     DecisionGenius license:  $75 / application / month
 *     Implementation fee:      $75,000 one-time
 */
export const decisiongenius: SaasModelConfig = {
  kind: "saas",
  id: "decisiongenius",
  name: "DecisionGenius",
  tagline:
    "AI-powered underwriting automation. Quantify the productivity uplift and ROI when DecisionGenius is deployed against your application volume.",
  platform: {
    name: "DecisionGenius",
    logo: "/logos/Decision-Genius-Logo_color_Black.png",
    logoWhite: "/logos/Decision-Genius-Logo_Color_white.png",
    blurb:
      "DecisionGenius combines automation, ML-driven decisioning, and rule-based intelligence to lift underwriter productivity dramatically while improving decision consistency.",
    accentHex: "#2076BA",
    capabilities: [
      "ML-driven decisioning + configurable rule engine — codify your credit policy once, apply it consistently.",
      "Automated condition generation and AUS findings reconciliation.",
      "Investor / agency overlay automation across Fannie, Freddie, FHA, VA, USDA.",
      "Lifts underwriter productivity ~68% and improves decision consistency across the team.",
    ],
  },

  displayPreference: "roi-first",

  volumeInputs: [
    {
      id: "totalApps",
      label: "Applications per Month",
      type: "number",
      defaultValue: 500,
      help: "Total mortgage applications underwritten per month.",
    },
  ],

  roles: [
    {
      id: "underwriters",
      label: "Underwriters",
      productivityBasis: "perDay",
      defaultBaselineProductivity: 2.5,
      defaultHourlyRate: 43,
      defaultImprovementPct: 0.68,
      volumeKey: "totalApps",
      help: "Loans per underwriter per day. DecisionGenius typically delivers a 68% productivity lift.",
    },
  ],

  supervisor: { spanOfControl: 10, salary: 95_000 },
  benefitsRate: 0.25,

  indirectCosts: [
    { id: "management", label: "Management Costs",            defaultAnnualPool: 1_000_000, defaultAllocationPct: 0.1, help: "Layered management above the line — often forgotten when sizing in-house teams." },
    { id: "occupancy",  label: "Occupancy & Equipment",       defaultAnnualPool: 1_000_000, defaultAllocationPct: 0.1, help: "Rent, workstations, utilities." },
    { id: "technology", label: "Technology Related",          defaultAnnualPool: 1_000_000, defaultAllocationPct: 0.1, help: "LOS access, AUS / underwriting engines, productivity licenses, IT support." },
    { id: "other",      label: "Other Operating Expenses",    defaultAnnualPool: 1_000_000, defaultAllocationPct: 0.1, help: "Training, travel, supplies, miscellaneous opex." },
    { id: "gna",        label: "General, Admin & Corporate",  defaultAnnualPool: 1_000_000, defaultAllocationPct: 0.1, help: "HR, Finance, Legal, Compliance allocation." },
  ],

  pricing: {
    defaultPerLoanMonthlyFee: 75,
    defaultOneTimeImplementationFee: 75_000,
    licenseLineLabel: "DecisionGenius license (per application / month)",
    implementationLineLabel: "DecisionGenius implementation (one-time)",
  },

  perLoanUnitLabel: "applications",
  perLoanVolumeKey: "totalApps",
};

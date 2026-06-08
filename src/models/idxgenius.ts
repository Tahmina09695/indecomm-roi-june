import type { SaasModelConfig } from "./_saas-types";

/**
 * IDXGenius.ai — SaaS automation ROI calculator.
 * Defaults derived from "1.2 IDXGenius AI ROI Model June 2025.xlsx" → ROI-IDX.
 *
 *   Volume per month (Applications): 500
 *   Roles (loans / FTE / period, $/hr, improvement %):
 *     Processors    25/mo   $32  +30%
 *     Underwriters   2.5/day $42 +20%
 *     Closer         3/day   $32 +10%
 *     Auditors       2/day   $42 +35%
 *   Supervisor span 10, salary $95K
 *   Benefits 25%
 *
 *   Indirect (monthly cost × allocation %):
 *     Management            1,000,000  × 0.5
 *     Occupancy & Equipment   500,000  × 0.5
 *     Technology Related      750,000  × 0.5
 *     Other Operating Exp     500,000  × 0.5
 *     G&A and Corporate       750,000  × 0.5    (Excel uses =D34 → 750K)
 *
 *   Pricing:
 *     IDXGenius.ai license:   $14 / application / month
 *     Implementation fee:     $40,000 one-time
 */
export const idxgenius: SaasModelConfig = {
  kind: "saas",
  id: "idxgenius",
  name: "IDXGenius.ai — Retail Lenders",
  tagline:
    "For retail lenders. Document intelligence + automation across processing, underwriting, closing, and audit — measure the productivity lift when IDXGenius is deployed on your retail loan pipeline.",
  platform: {
    name: "IDXGenius",
    logo: "/logos/IDX logo - Dark-8.png",
    logoWhite: "/logos/IDX logo - White-8.png",
    blurb:
      "IDXGenius.ai is Indecomm's Gen AI–powered document intelligence platform. It classifies, indexes, and extracts data from every mortgage document the moment loans arrive — turning the doc package into decision-ready data and lifting productivity across processing, underwriting, closing, and audit.",
    accentHex: "#2BA8E0",
    capabilities: [
      "Gen AI + ML document intelligence — classifies and indexes 900+ mortgage document types at 95% accuracy, with 90% data-extraction accuracy across 4,000+ fields.",
      "Auto-stacks, versions & organizes — names, versions, and files every doc by your organization strategy so your team always works the latest, correct version.",
      "Validates, verifies & flags anomalies — cross-checks data across documents, surfaces incorrect, inconsistent, or missing items so underwriters spend time on decisions, not data hunting.",
      "Truly hands-off for lenders — no staffing up to clear exceptions or remediate; documents are decision-ready in under 4 hours from submission.",
      "Proven at scale — 3M+ mortgage documents indexed per year for some of the largest U.S. banks and lenders, with accuracy that improves as the system learns.",
    ],
  },

  // IDX produces very high ROI % at default volumes because the license fee is
  // tiny relative to multi-role labor cost. Lead with $ savings instead of %
  // to avoid "too good to be true" reactions from prospects.
  displayPreference: "savings-first",

  volumeInputs: [
    {
      id: "totalApps",
      label: "Applications per Month",
      type: "number",
      defaultValue: 500,
      help: "Total mortgage applications processed per month.",
    },
  ],

  roles: [
    {
      id: "processors",
      label: "Processors",
      productivityBasis: "perMonth",
      defaultBaselineProductivity: 25,
      defaultHourlyRate: 32,
      defaultImprovementPct: 0.30,
      volumeKey: "totalApps",
      help: "Loans per processor per month, with a 30% productivity lift from IDXGenius.",
    },
    {
      id: "underwriters",
      label: "Underwriters",
      productivityBasis: "perDay",
      defaultBaselineProductivity: 2.5,
      defaultHourlyRate: 42,
      defaultImprovementPct: 0.20,
      volumeKey: "totalApps",
      help: "Loans per underwriter per day, with 20% productivity lift.",
    },
    {
      id: "closers",
      label: "Closers",
      productivityBasis: "perDay",
      defaultBaselineProductivity: 3,
      defaultHourlyRate: 32,
      defaultImprovementPct: 0.10,
      volumeKey: "totalApps",
      help: "Loans per closer per day, with 10% productivity lift.",
    },
    {
      id: "auditors",
      label: "Auditors",
      productivityBasis: "perDay",
      defaultBaselineProductivity: 2,
      defaultHourlyRate: 42,
      defaultImprovementPct: 0.35,
      volumeKey: "totalApps",
      help: "Loans per auditor per day, with 35% productivity lift (largest AI impact).",
    },
  ],

  supervisor: { spanOfControl: 10, salary: 95_000 },
  benefitsRate: 0.25,

  indirectCosts: [
    { id: "management",  label: "Management Costs",                       defaultAnnualPool: 1_000_000, defaultAllocationPct: 0.5, help: "Layered management above the line — often forgotten when sizing in-house teams." },
    { id: "occupancy",   label: "Occupancy & Equipment",                   defaultAnnualPool:   500_000, defaultAllocationPct: 0.5, help: "Rent, workstations, furniture, utilities." },
    { id: "technology",  label: "Technology Related",                      defaultAnnualPool:   750_000, defaultAllocationPct: 0.5, help: "LOS access, doc processing tools, productivity licenses, IT support." },
    { id: "other",       label: "Other Operating Expenses",                defaultAnnualPool:   500_000, defaultAllocationPct: 0.5, help: "Training, travel, supplies, miscellaneous opex." },
    { id: "gna",         label: "General, Admin & Corporate",              defaultAnnualPool:   750_000, defaultAllocationPct: 0.5, help: "HR, Finance, Legal, Compliance allocation." },
  ],

  pricing: {
    defaultPerLoanMonthlyFee: 14,
    defaultOneTimeImplementationFee: 40_000,
    licenseLineLabel: "IDXGenius.ai license (per application / month)",
    implementationLineLabel: "IDXGenius.ai implementation (one-time)",
  },

  perLoanUnitLabel: "applications",
  perLoanVolumeKey: "totalApps",
};

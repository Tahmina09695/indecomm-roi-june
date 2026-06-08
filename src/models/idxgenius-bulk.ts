import type { SaasModelConfig } from "./_saas-types";

/**
 * IDXGenius.ai — Bulk Business variant.
 *
 * Bulk operations differ from retail in a fundamental way: only the Loan Setup
 * team (which manually indexes incoming loan files today) is materially
 * impacted by IDXGenius. Downstream roles (UW, closing, audit) on bulk deals
 * don't exist for the bulk buyer the same way they do for a retail lender, so
 * we model a single role here.
 *
 *   Volume per month (Applications/loan files): 2,000
 *   Loan Setup team:    10 loans/day baseline, $20/hr, +70% productivity lift
 *   Supervisor span 10, $95K (same as Retail)
 *   Benefits 25%
 *   Indirect same pool/allocation pattern as Retail
 *   Pricing: $14 / loan / month license, $40K one-time implementation
 */
export const idxgeniusBulk: SaasModelConfig = {
  kind: "saas",
  id: "idxgenius-bulk",
  name: "IDXGenius.ai — Bulk Business",
  tagline:
    "For bulk acquirers and aggregators. Quantify the productivity lift when IDXGenius automates the manual loan-file indexing that today drives the entire Loan Setup team.",
  platform: {
    name: "IDXGenius",
    logo: "/logos/IDX logo - Dark-8.png",
    logoWhite: "/logos/IDX logo - White-8.png",
    blurb:
      "IDXGenius.ai is Indecomm's Gen AI–powered document intelligence platform. On bulk acquisitions, it eliminates the manual indexing burden that drives loan-setup headcount — turning each incoming loan file into decision-ready data automatically.",
    accentHex: "#2BA8E0",
    capabilities: [
      "Gen AI + ML document intelligence — classifies and indexes 900+ mortgage document types at 95% accuracy, with 90% data-extraction accuracy across 4,000+ fields.",
      "Eliminates manual indexing — your loan-setup team stops re-keying and starts validating, with throughput up ~70% on the same headcount.",
      "Auto-stacks, versions & organizes — names, versions, and files every doc by your organization strategy so downstream review starts on clean data.",
      "Validates, verifies & flags anomalies — surfaces incorrect, inconsistent, or missing items before they reach pricing or due diligence.",
      "Proven at scale — 3M+ mortgage documents indexed per year for some of the largest U.S. banks and aggregators, with accuracy that improves as the system learns.",
    ],
  },

  // Bulk also produces very high ROI % at default volumes because the license
  // fee is small relative to setup-team labor. Lead with $ savings.
  displayPreference: "savings-first",

  volumeInputs: [
    {
      id: "totalApps",
      label: "Loan Files per Month",
      type: "number",
      defaultValue: 2000,
      help: "Total loan files (applications) acquired and indexed per month in your bulk operation.",
    },
  ],

  roles: [
    {
      id: "loanSetup",
      label: "Loan Setup Team (manual indexing)",
      productivityBasis: "perDay",
      defaultBaselineProductivity: 10,
      defaultHourlyRate: 20,
      defaultImprovementPct: 0.70,
      volumeKey: "totalApps",
      help: "Loans indexed per setup person per day. IDXGenius automation typically lifts productivity ~70% by eliminating manual re-keying.",
    },
  ],

  supervisor: { spanOfControl: 10, salary: 95_000 },
  benefitsRate: 0.25,

  indirectCosts: [
    { id: "management",  label: "Management Costs",            defaultAnnualPool: 1_000_000, defaultAllocationPct: 0.5, help: "Layered management above the line — often forgotten when sizing in-house teams." },
    { id: "occupancy",   label: "Occupancy & Equipment",       defaultAnnualPool:   500_000, defaultAllocationPct: 0.5, help: "Rent, workstations, furniture, utilities." },
    { id: "technology",  label: "Technology Related",          defaultAnnualPool:   750_000, defaultAllocationPct: 0.5, help: "LOS access, doc processing tools, productivity licenses, IT support." },
    { id: "other",       label: "Other Operating Expenses",    defaultAnnualPool:   500_000, defaultAllocationPct: 0.5, help: "Training, travel, supplies, miscellaneous opex." },
    { id: "gna",         label: "General, Admin & Corporate",  defaultAnnualPool:   750_000, defaultAllocationPct: 0.5, help: "HR, Finance, Legal, Compliance allocation." },
  ],

  pricing: {
    defaultPerLoanMonthlyFee: 14,
    defaultOneTimeImplementationFee: 40_000,
    licenseLineLabel: "IDXGenius.ai license (per loan file / month)",
    implementationLineLabel: "IDXGenius.ai implementation (one-time)",
  },

  perLoanUnitLabel: "loan files",
  perLoanVolumeKey: "totalApps",
};

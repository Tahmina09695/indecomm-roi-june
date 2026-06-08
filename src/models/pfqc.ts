import type { ModelConfig } from "./_types";

/**
 * Pre-Fund QC (PFQC) — driven by APPLICATION volume rather than funded loans.
 * Defaults derived from "4. QC solutions ROI model June 2025.xlsx" → sheet "ROI-PFQC".
 *
 *   Volume per month (Apps)          1000
 *   Conv/FHA share                    80%
 *   VA/USDA share                     20%
 *   Sample %                          10%
 *   Auditors Conv/FHA: 5 loans/day, $32/hr
 *   Auditors VA/USDA:  4 loans/day, $32/hr
 *   Supervisor span 8, salary $100K
 *   Benefits 25%
 *   Indirect 5 × $1M × 5% = $250K
 *   Pricing: $115/loan Conv/FHA, $150/loan VA/USDA
 */
export const pfqc: ModelConfig = {
  id: "pfqc",
  name: "Pre-Fund QC",
  tagline:
    "Calculate the true in-house cost of Pre-Fund Quality Control on application volume and compare to Indecomm's AuditGenius-powered outsourced pricing.",
  platform: {
    name: "AuditGenius",
    logo: "/logos/Audit-Genius-Logo-Color_Black.png",
    logoWhite: "/logos/Audit-Genius-Logo_Color_White.png",
    blurb:
      "Indecomm's AuditGenius platform powers our Pre-Fund QC service — combining automation, structured workflows, and audit intelligence to catch defects before funding, faster and more consistently than a typical in-house team.",
    accentHex: "#F1A421",
  },

  volumeInputs: [
    {
      id: "totalApps",
      label: "Applications per Month",
      type: "number",
      defaultValue: 1000,
      help: "Total mortgage applications per month across all channels.",
    },
    {
      id: "convFhaPct",
      label: "Conventional + FHA Share",
      type: "percent",
      defaultValue: 0.8,
      help: "% of applications that are Conventional or FHA.",
    },
    {
      id: "vaUsdaPct",
      label: "VA + USDA + Other Share",
      type: "percent",
      defaultValue: 0.2,
      help: "% of applications that are VA, USDA, or other government programs.",
    },
    {
      id: "convFhaVolume",
      label: "Conv/FHA Apps per Month",
      type: "derived",
      defaultValue: 800,
      derive: (v) => Math.round((v.totalApps ?? 0) * (v.convFhaPct ?? 0)),
    },
    {
      id: "vaUsdaVolume",
      label: "VA/USDA Apps per Month",
      type: "derived",
      defaultValue: 200,
      derive: (v) => Math.round((v.totalApps ?? 0) * (v.vaUsdaPct ?? 0)),
    },
    {
      id: "convFhaAudited",
      label: "Conv/FHA Loans Audited per Month",
      type: "derived",
      defaultValue: 80,
      derive: (v) => Math.round((v.totalApps ?? 0) * (v.convFhaPct ?? 0) * (v.sampleRate ?? 0)),
    },
    {
      id: "vaUsdaAudited",
      label: "VA/USDA Loans Audited per Month",
      type: "derived",
      defaultValue: 20,
      derive: (v) => Math.round((v.totalApps ?? 0) * (v.vaUsdaPct ?? 0) * (v.sampleRate ?? 0)),
    },
    {
      id: "totalAudited",
      label: "Total Loans Audited per Month",
      type: "derived",
      defaultValue: 100,
      derive: (v) => Math.round((v.totalApps ?? 0) * (v.sampleRate ?? 0)),
    },
  ],

  sampleRate: {
    id: "sampleRate",
    label: "Pre-Fund QC Sample %",
    default: 0.10,
    help: "Percent of applications selected for Pre-Fund QC audit (typically lower than Post-Close).",
  },

  roles: [
    {
      id: "auditorsConvFha",
      label: "QC Pre-Fund Auditors — Conv/FHA",
      productivityBasis: "perDay",
      defaultProductivity: 5,
      defaultHourlyRate: 32,
      volumeKey: "convFhaVolume",
      appliesSampleRate: true,
      help: "Loans per pre-fund auditor per day for Conv/FHA applications.",
    },
    {
      id: "auditorsVaUsda",
      label: "QC Pre-Fund Auditors — VA/USDA",
      productivityBasis: "perDay",
      defaultProductivity: 4,
      defaultHourlyRate: 32,
      volumeKey: "vaUsdaVolume",
      appliesSampleRate: true,
      help: "Loans per pre-fund auditor per day for VA/USDA applications (typically slower).",
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
      help: "LOS access, QC tooling, productivity licenses, IT support.",
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
      type: "perLoan",
      id: "priceConvFha",
      label: "Conv/FHA Price per Loan",
      volumeKey: "convFhaVolume",
      appliesSampleRate: true,
      defaultPrice: 115,
    },
    {
      type: "perLoan",
      id: "priceVaUsda",
      label: "VA/USDA Price per Loan",
      volumeKey: "vaUsdaVolume",
      appliesSampleRate: true,
      defaultPrice: 150,
    },
  ],

  /**
   * Retention defaults: 15% of the volume-driven team retained for
   * exception management / vendor oversight + 0.25 supervisor (a quarter
   * of one supervisor, typical when supervisor capacity is shared across
   * multiple outsourced functions).
   */
  retention: {
    defaultRetentionPct: 0.15,
    defaultRetainedSupervisors: 0.25,
    help:
      "Some clients keep a small team in-house for exception management and vendor oversight after outsourcing. Toggle on to include those retained costs in the comparison.",
  },
};

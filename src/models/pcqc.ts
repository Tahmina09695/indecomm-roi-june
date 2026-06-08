import type { ModelConfig } from "./_types";

/**
 * Post-Close QC (PCQC) — MVP model.
 * Defaults derived from "4. QC solutions ROI model June 2025.xlsx" → sheet "ROI-PCQC".
 */
export const pcqc: ModelConfig = {
  id: "pcqc",
  name: "Post-Close QC",
  tagline:
    "Calculate the true in-house cost of Post-Close Quality Control and compare to Indecomm's AuditGenius-powered outsourced pricing.",
  platform: {
    name: "AuditGenius",
    logo: "/logos/Audit-Genius-Logo-Color_Black.png",
    logoWhite: "/logos/Audit-Genius-Logo_Color_White.png",
    blurb:
      "Indecomm's AuditGenius platform is the engine behind our PCQC service — combining automation, structured workflows, and audit intelligence to deliver faster, more consistent QC than a typical in-house team.",
    accentHex: "#F1A421",
  },

  volumeInputs: [
    {
      id: "totalFunded",
      label: "Funded Loans per Month",
      type: "number",
      defaultValue: 1000,
      help: "Total funded loans per month across all channels.",
    },
    {
      id: "convFhaPct",
      label: "Conventional + FHA Share",
      type: "percent",
      defaultValue: 0.8,
      help: "% of funded loans that are Conventional or FHA.",
    },
    {
      id: "vaUsdaPct",
      label: "VA + USDA + Other Share",
      type: "percent",
      defaultValue: 0.2,
      help: "% of funded loans that are VA, USDA, or other government programs.",
    },
    {
      id: "convFhaVolume",
      label: "Conv/FHA Funded per Month",
      type: "derived",
      defaultValue: 800,
      derive: (v) => Math.round((v.totalFunded ?? 0) * (v.convFhaPct ?? 0)),
    },
    {
      id: "vaUsdaVolume",
      label: "VA/USDA Funded per Month",
      type: "derived",
      defaultValue: 200,
      derive: (v) => Math.round((v.totalFunded ?? 0) * (v.vaUsdaPct ?? 0)),
    },
    {
      id: "convFhaAudited",
      label: "Conv/FHA Loans Audited per Month",
      type: "derived",
      defaultValue: 120,
      derive: (v) => Math.round((v.totalFunded ?? 0) * (v.convFhaPct ?? 0) * (v.sampleRate ?? 0)),
    },
    {
      id: "vaUsdaAudited",
      label: "VA/USDA Loans Audited per Month",
      type: "derived",
      defaultValue: 30,
      derive: (v) => Math.round((v.totalFunded ?? 0) * (v.vaUsdaPct ?? 0) * (v.sampleRate ?? 0)),
    },
    {
      id: "totalAudited",
      label: "Total Loans Audited per Month",
      type: "derived",
      defaultValue: 150,
      derive: (v) => Math.round((v.totalFunded ?? 0) * (v.sampleRate ?? 0)),
    },
  ],

  sampleRate: {
    id: "sampleRate",
    label: "QC Sample %",
    default: 0.15,
    help: "Percent of funded loans selected for Post-Close QC audit.",
  },

  roles: [
    {
      id: "auditorsConvFha",
      label: "QC Auditors — Conv/FHA",
      productivityBasis: "perDay",
      defaultProductivity: 4, // loans/day/FTE
      defaultHourlyRate: 30,
      volumeKey: "convFhaVolume",
      appliesSampleRate: true,
      help: "Productivity = loans per auditor per day for Conv/FHA QC.",
    },
    {
      id: "auditorsVaUsda",
      label: "QC Auditors — VA/USDA",
      productivityBasis: "perDay",
      defaultProductivity: 3,
      defaultHourlyRate: 30,
      volumeKey: "vaUsdaVolume",
      appliesSampleRate: true,
      help: "Productivity = loans per auditor per day for VA/USDA QC (typically slower).",
    },
    {
      id: "reverification",
      label: "Reverification Analyst",
      productivityBasis: "perDay",
      defaultProductivity: 12,
      defaultHourlyRate: 25,
      volumeKey: "totalFunded",
      appliesSampleRate: true,
      help: "Handles reverifications / follow-ups on sampled loans.",
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
      defaultPrice: 140,
    },
    {
      type: "perLoan",
      id: "priceVaUsda",
      label: "VA/USDA Price per Loan",
      volumeKey: "vaUsdaVolume",
      appliesSampleRate: true,
      defaultPrice: 175,
    },
  ],

  /**
   * Retention defaults (typical for QC outsourcing): 15% of the volume-driven
   * team stays for exception management / vendor oversight, plus a fractional
   * (0.25) supervisor — a quarter of one supervisor's time, since most clients
   * share supervisor capacity across multiple outsourced functions.
   * Reps can toggle this on per prospect; defaults to OFF.
   */
  retention: {
    defaultRetentionPct: 0.15,
    defaultRetainedSupervisors: 0.25,
    help:
      "Some clients keep a small team in-house for exception management and vendor oversight after outsourcing. Toggle on to include those retained costs in the comparison.",
  },
};

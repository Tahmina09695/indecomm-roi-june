import type { ModelConfig } from "./_types";

/**
 * Servicing QC — performing vs non-performing loan QC.
 * Defaults from "5. Servicing QC solutions ROI model June 2025.xlsx" → ROI-Servicing QC.
 *
 *   Volume per month:    1300
 *     Performing sample (40%):     520
 *     Non-performing sample (60%): 780
 *   Performing auditor: 4.5 loans/day, $35/hr
 *   Non-perf auditor:   2.0 loans/day, $35/hr
 *   Supervisor span 10, salary $100K
 *   Benefits 25%; Indirect 5×$1M×5% = $250K
 *   Pricing: $75 performing, $145 non-performing (per loan)
 *   Per-loan denominator = total Servicing QC volume × 12 (no sample %).
 */
export const servicingQc: ModelConfig = {
  id: "servicing-qc",
  name: "Servicing QC",
  tagline:
    "Servicing QC for performing and non-performing loans — compare your true in-house cost to Indecomm's AuditGenius-powered outsourced pricing.",
  platform: {
    name: "AuditGenius",
    logo: "/logos/Audit-Genius-Logo-Color_Black.png",
    logoWhite: "/logos/Audit-Genius-Logo_Color_White.png",
    blurb:
      "Indecomm's AuditGenius platform powers our Servicing QC service — combining automation and audit intelligence to deliver faster, more consistent reviews on both performing and non-performing loans.",
    accentHex: "#F1A421",
  },

  volumeInputs: [
    {
      id: "totalServicingVolume",
      label: "Servicing QC Volume per Month",
      type: "number",
      defaultValue: 1300,
      help: "Total loans selected for Servicing QC each month.",
    },
    {
      id: "performingPct",
      label: "Performing Loans Share",
      type: "percent",
      defaultValue: 0.4,
      help: "% of QC volume that are performing loans.",
    },
    {
      id: "nonPerformingPct",
      label: "Non-Performing Loans Share",
      type: "percent",
      defaultValue: 0.6,
      help: "% of QC volume that are non-performing loans (slower to audit).",
    },
    {
      id: "performingVolume",
      label: "Performing Loans per Month",
      type: "derived",
      defaultValue: 520,
      derive: (v) => Math.round((v.totalServicingVolume ?? 0) * (v.performingPct ?? 0)),
    },
    {
      id: "nonPerformingVolume",
      label: "Non-Performing Loans per Month",
      type: "derived",
      defaultValue: 780,
      derive: (v) => Math.round((v.totalServicingVolume ?? 0) * (v.nonPerformingPct ?? 0)),
    },
  ],

  roles: [
    {
      id: "auditorsPerforming",
      label: "Servicing QC Auditors — Performing",
      productivityBasis: "perDay",
      defaultProductivity: 4.5,
      defaultHourlyRate: 35,
      volumeKey: "performingVolume",
      appliesSampleRate: false,
      help: "Loans per auditor per day for performing-loan servicing QC.",
    },
    {
      id: "auditorsNonPerforming",
      label: "Servicing QC Auditors — Non-Performing",
      productivityBasis: "perDay",
      defaultProductivity: 2,
      defaultHourlyRate: 35,
      volumeKey: "nonPerformingVolume",
      appliesSampleRate: false,
      help: "Loans per auditor per day for non-performing loans (slower).",
    },
  ],

  supervisor: { spanOfControl: 10, salary: 100_000 },
  benefitsRate: 0.25,

  indirectCosts: [
    { id: "management", label: "Management Costs", defaultAnnualPool: 1_000_000, defaultAllocationPct: 0.05, help: "Layered management above the line." },
    { id: "occupancy", label: "Occupancy & Equipment", defaultAnnualPool: 1_000_000, defaultAllocationPct: 0.05, help: "Rent, workstations, utilities." },
    { id: "technology", label: "Technology Related", defaultAnnualPool: 1_000_000, defaultAllocationPct: 0.05, help: "Servicing systems, QC tooling, IT support." },
    { id: "other", label: "Other Operating Expenses", defaultAnnualPool: 1_000_000, defaultAllocationPct: 0.05, help: "Training, travel, supplies." },
    { id: "gna", label: "General, Admin & Corporate", defaultAnnualPool: 1_000_000, defaultAllocationPct: 0.05, help: "HR, Finance, Legal, Compliance allocation." },
  ],

  pricing: [
    {
      type: "perLoan",
      id: "pricePerforming",
      label: "Performing — Price per Loan",
      volumeKey: "performingVolume",
      appliesSampleRate: false,
      defaultPrice: 75,
    },
    {
      type: "perLoan",
      id: "priceNonPerforming",
      label: "Non-Performing — Price per Loan",
      volumeKey: "nonPerformingVolume",
      appliesSampleRate: false,
      defaultPrice: 145,
    },
  ],

  /**
   * Retention defaults: 15% of the team retained + 0.25 supervisor.
   */
  retention: {
    defaultRetentionPct: 0.15,
    defaultRetainedSupervisors: 0.25,
    help:
      "Some clients keep a small team in-house for exception management and vendor oversight after outsourcing. Toggle on to include those retained costs in the comparison.",
  },
};

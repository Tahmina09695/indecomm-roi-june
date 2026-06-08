import type { ModelConfig } from "./_types";

/**
 * Pre-Purchase Reviews (PPR) — single role, per-FTE pricing.
 * Defaults from "7. PPR ROI model June 2025.xlsx".
 *
 *   Volume per month:  500
 *   PPR Auditors:      4 loans/day, $30/hr
 *   Supervisor:        span 10, $75,000
 *   Benefits 25%
 *   Indirect 5 × $500,000 × 5% = $125,000
 *
 *   Indecomm pricing (per-FTE):
 *     FTEs = round(in-house PPR FTEs) + 1
 *     Monthly price per FTE: $2,750
 *
 *   Per-loan denominator = volume × 12
 */
export const ppr: ModelConfig = {
  id: "ppr",
  name: "Pre-Purchase Reviews",
  tagline:
    "Pre-Purchase Reviews (PPR) — compare your true in-house cost to Indecomm's AuditGenius-powered per-FTE pricing.",
  platform: {
    name: "AuditGenius",
    logo: "/logos/Audit-Genius-Logo-Color_Black.png",
    logoWhite: "/logos/Audit-Genius-Logo_Color_White.png",
    blurb:
      "Indecomm's AuditGenius platform powers our Pre-Purchase Reviews — combining automation, structured workflows, and audit intelligence to clear PPR reviews faster and more consistently than a typical in-house team.",
    accentHex: "#F1A421",
  },

  volumeInputs: [
    {
      id: "volume",
      label: "PPR Volume per Month",
      type: "number",
      defaultValue: 500,
      help: "Total loans to be pre-purchase reviewed per month.",
    },
  ],

  roles: [
    {
      id: "pprAuditors",
      label: "PPR Auditors",
      productivityBasis: "perDay",
      defaultProductivity: 4,
      defaultHourlyRate: 30,
      volumeKey: "volume",
      help: "Loans per PPR auditor per day.",
    },
  ],

  supervisor: { spanOfControl: 10, salary: 75_000 },
  benefitsRate: 0.25,

  indirectCosts: [
    { id: "management", label: "Management Costs", defaultAnnualPool: 500_000, defaultAllocationPct: 0.05, help: "Layered management above the line." },
    { id: "occupancy", label: "Occupancy & Equipment", defaultAnnualPool: 500_000, defaultAllocationPct: 0.05, help: "Rent, workstations, utilities." },
    { id: "technology", label: "Technology Related", defaultAnnualPool: 500_000, defaultAllocationPct: 0.05, help: "LOS access, PPR tooling, IT support." },
    { id: "other", label: "Other Operating Expenses", defaultAnnualPool: 500_000, defaultAllocationPct: 0.05, help: "Training, travel, supplies." },
    { id: "gna", label: "General, Admin & Corporate", defaultAnnualPool: 500_000, defaultAllocationPct: 0.05, help: "HR, Finance, Legal, Compliance allocation." },
  ],

  pricing: [
    {
      type: "perFTE",
      id: "indecommPpr",
      label: "Indecomm PPR (per FTE)",
      roleId: "pprAuditors",
      roundBaseFte: "round",
      fteOffset: 1,
      defaultMonthlyPricePerFTE: 2750,
    },
  ],

  perLoanDenominator: {
    volumeKey: "volume",
    unitLabel: "loans",
  },
};

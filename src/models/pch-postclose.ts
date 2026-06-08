import type { ModelConfig } from "./_types";

/**
 * PCH Post-Close — multi-role operational ROI.
 * Defaults from "6. PCH Post Close solutions ROI Model June 2025.xlsx".
 *
 *   Volume per month: 750 funded loans
 *   Roles (loans/FTE/day, with role multipliers):
 *     Auditors:           20  × 2.0 (two-pass review),       $25/hr
 *     Follow-up:          65  × 0.1 (10% of loans),          $21/hr
 *     Exception Handling: 50  × 0.1 (10% of loans),          $20/hr
 *     Mailroom Operations:70  × 1.0,                         $18/hr
 *   Supervisor: span 10, salary $65,000
 *   Benefits: 30%
 *   Indirect: 5 × $500,000 × 10% = $250,000
 *   Pricing: $25 per funded loan
 */
export const pchPostClose: ModelConfig = {
  id: "pch-postclose",
  name: "PCH Post-Close",
  tagline:
    "Post-close audits, follow-up, exception handling, and mailroom — compare your true in-house cost to Indecomm's DocGenius-powered outsourced pricing.",
  platform: {
    name: "DocGenius",
    logo: "/logos/Doc-Genius-Logo_color_Black.png",
    logoWhite: "/logos/Doc-Genius-Logo_Color_White.png",
    blurb:
      "Indecomm's DocGenius platform powers our PCH Post-Close service — combining document automation, structured workflows, and exception handling to deliver faster, more consistent post-close operations than a typical in-house team.",
    accentHex: "#8064A2",
  },

  volumeInputs: [
    {
      id: "totalFunded",
      label: "Funded Loans per Month",
      type: "number",
      defaultValue: 750,
      help: "Total funded loans per month across all channels.",
    },
  ],

  roles: [
    {
      id: "auditors",
      label: "Auditors",
      productivityBasis: "perDay",
      defaultProductivity: 20,
      productivityMultiplier: 2,
      defaultHourlyRate: 25,
      volumeKey: "totalFunded",
      help: "Two-pass audit (×2 multiplier). Productivity is loans per auditor per day.",
    },
    {
      id: "followup",
      label: "Follow-up",
      productivityBasis: "perDay",
      defaultProductivity: 65,
      productivityMultiplier: 0.1,
      defaultHourlyRate: 21,
      volumeKey: "totalFunded",
      help: "Only ~10% of loans need follow-up. Productivity is loans per FTE per day.",
    },
    {
      id: "exception",
      label: "Exception Handling",
      productivityBasis: "perDay",
      defaultProductivity: 50,
      productivityMultiplier: 0.1,
      defaultHourlyRate: 20,
      volumeKey: "totalFunded",
      help: "Only ~10% of loans need exception handling.",
    },
    {
      id: "mailroom",
      label: "Mailroom Operations",
      productivityBasis: "perDay",
      defaultProductivity: 70,
      productivityMultiplier: 1,
      defaultHourlyRate: 18,
      volumeKey: "totalFunded",
      help: "Loans handled per mailroom FTE per day.",
    },
  ],

  supervisor: { spanOfControl: 10, salary: 65_000 },
  benefitsRate: 0.30,

  indirectCosts: [
    { id: "management", label: "Management Costs", defaultAnnualPool: 500_000, defaultAllocationPct: 0.10, help: "Layered management above the line." },
    { id: "occupancy", label: "Occupancy & Equipment", defaultAnnualPool: 500_000, defaultAllocationPct: 0.10, help: "Rent, workstations, mailroom equipment." },
    { id: "technology", label: "Technology Related", defaultAnnualPool: 500_000, defaultAllocationPct: 0.10, help: "Document systems, OCR, workflow tools." },
    { id: "other", label: "Other Operating Expenses", defaultAnnualPool: 500_000, defaultAllocationPct: 0.10, help: "Training, travel, supplies, postage." },
    { id: "gna", label: "General, Admin & Corporate", defaultAnnualPool: 500_000, defaultAllocationPct: 0.10, help: "HR, Finance, Legal, Compliance allocation." },
  ],

  pricing: [
    {
      type: "perLoan",
      id: "pricePerLoan",
      label: "Price per Funded Loan",
      volumeKey: "totalFunded",
      defaultPrice: 25,
    },
  ],

  /**
   * Retention defaults: 15% of the team retained + 0.25 supervisor (a quarter
   * of a supervisor's time, typical when supervisor capacity is shared across
   * multiple outsourced PCH functions).
   */
  retention: {
    defaultRetentionPct: 0.15,
    defaultRetainedSupervisors: 0.25,
    help:
      "Some clients keep a small team in-house for exception management and vendor oversight after outsourcing. Toggle on to include those retained costs in the comparison.",
  },
};

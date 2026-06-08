import type { ModelConfig } from "./_types";

/**
 * PCH Trailing Docs — same 4-role structure as Post-Close with different productivity.
 * Defaults from "6. PCH Trailing Docs solutions ROI Model June 2025.xlsx".
 *
 *   Volume per month: 750 funded loans
 *   Roles (loans/FTE/day):
 *     Auditors:           55  × 2.0,    $25/hr
 *     Follow-up:          65  × 1.0,    $25/hr
 *     Exception Handling: 50  × 1.0,    $23/hr
 *     Mailroom:           80  × 1.0,    $20/hr
 *   Supervisor: span 10, salary $65,000
 *   Benefits: 30%; Indirect: 5 × $500K × 10% = $250K
 *   Pricing: $16 per funded loan
 */
export const pchTrailing: ModelConfig = {
  id: "pch-trailing",
  name: "PCH Trailing Docs",
  tagline:
    "Trailing-doc tracking, follow-up, and exceptions — compare your true in-house cost to Indecomm's DocGenius-powered outsourced pricing.",
  platform: {
    name: "DocGenius",
    logo: "/logos/Doc-Genius-Logo_color_Black.png",
    logoWhite: "/logos/Doc-Genius-Logo_Color_White.png",
    blurb:
      "Indecomm's DocGenius platform powers our Trailing Docs service — automating document tracking, follow-up, and exception handling so you can clear trailing docs faster and more consistently than an in-house team.",
    accentHex: "#8064A2",
  },

  volumeInputs: [
    {
      id: "totalFunded",
      label: "Funded Loans per Month",
      type: "number",
      defaultValue: 750,
      help: "Total funded loans per month requiring trailing-doc tracking.",
    },
  ],

  roles: [
    {
      id: "auditors",
      label: "Auditors",
      productivityBasis: "perDay",
      defaultProductivity: 55,
      productivityMultiplier: 2,
      defaultHourlyRate: 25,
      volumeKey: "totalFunded",
      help: "Two-pass audit on trailing documents.",
    },
    {
      id: "followup",
      label: "Follow-up",
      productivityBasis: "perDay",
      defaultProductivity: 65,
      productivityMultiplier: 1,
      defaultHourlyRate: 25,
      volumeKey: "totalFunded",
      help: "Loans per follow-up FTE per day.",
    },
    {
      id: "exception",
      label: "Exception Handling",
      productivityBasis: "perDay",
      defaultProductivity: 50,
      productivityMultiplier: 1,
      defaultHourlyRate: 23,
      volumeKey: "totalFunded",
      help: "Loans per exception FTE per day.",
    },
    {
      id: "mailroom",
      label: "Mailroom Operations",
      productivityBasis: "perDay",
      defaultProductivity: 80,
      productivityMultiplier: 1,
      defaultHourlyRate: 20,
      volumeKey: "totalFunded",
      help: "Loans per mailroom FTE per day.",
    },
  ],

  supervisor: { spanOfControl: 10, salary: 65_000 },
  benefitsRate: 0.30,

  indirectCosts: [
    { id: "management", label: "Management Costs", defaultAnnualPool: 500_000, defaultAllocationPct: 0.10, help: "Layered management above the line." },
    { id: "occupancy", label: "Occupancy & Equipment", defaultAnnualPool: 500_000, defaultAllocationPct: 0.10, help: "Rent, workstations, mailroom equipment." },
    { id: "technology", label: "Technology Related", defaultAnnualPool: 500_000, defaultAllocationPct: 0.10, help: "Document tracking systems, OCR, workflow tools." },
    { id: "other", label: "Other Operating Expenses", defaultAnnualPool: 500_000, defaultAllocationPct: 0.10, help: "Training, travel, supplies, postage." },
    { id: "gna", label: "General, Admin & Corporate", defaultAnnualPool: 500_000, defaultAllocationPct: 0.10, help: "HR, Finance, Legal, Compliance allocation." },
  ],

  pricing: [
    {
      type: "perLoan",
      id: "pricePerLoan",
      label: "Price per Funded Loan",
      volumeKey: "totalFunded",
      defaultPrice: 16,
    },
  ],

  /**
   * Retention defaults (matched to the other QC/PCH models):
   *   - 15% of the volume-driven team retained for exception management
   *     & vendor oversight
   *   - 0.25 supervisor (a quarter of one supervisor's time, since
   *     supervisor capacity is typically shared across multiple
   *     outsourced functions)
   * Reps can toggle this on per prospect; defaults to OFF.
   */
  retention: {
    defaultRetentionPct: 0.15,
    defaultRetainedSupervisors: 0.25,
    help:
      "Some clients keep a small team in-house for exception management and vendor oversight after outsourcing. Toggle on to include those retained costs in the comparison.",
  },
};

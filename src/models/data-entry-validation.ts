import type { ModelConfig } from "./_types";

/**
 * Data Entry & Validation — onshore BPO ROI model.
 *
 * Use case: Client runs a two-step application-intake process today in-house
 * (or wants to). Indecomm replaces both functions with offshore-priced FTEs,
 * priced per FTE per month — same headcount as the client would need
 * onshore, but at a lower per-FTE cost.
 *
 * Volume driver: applications per month (single volume drives both roles).
 *
 *   Data Entry productivity:
 *     20 min / loan × 7.5 hrs / day = 22.5 loans / FTE / day
 *     22.5 × 20 days = 450 loans / FTE / month
 *     9,000 vol → 9,000 / 450 = 20 FTE
 *
 *   Validation productivity:
 *     30 min / loan × 7.5 hrs / day = 15 loans / FTE / day
 *     15 × 20 days = 300 loans / FTE / month
 *     9,000 vol → 9,000 / 300 = 30 FTE
 *
 *   Onshore labor rates:
 *     Data Entry  $20/hr
 *     Validation  $30/hr
 *
 *   Supervisor:   span 8, $100K salary  (standard services-model default)
 *   Benefits:     25%                   (standard services-model default)
 *   Indirect:     5 × $1M × 5% = $250K  (standard services-model default)
 *
 *   Indecomm per-FTE pricing (FTE count mirrors the in-house need — same
 *   number of FTEs, but cheaper per FTE because the work is offshore):
 *     Data Entry  $1,800 / FTE / month → annual = 20 × $1,800 × 12 = $432,000
 *     Validation  $2,000 / FTE / month → annual = 30 × $2,000 × 12 = $720,000
 *
 *   Per-loan denominator: applications (every application gets data entry +
 *   validation; one application = one indivisible unit of work).
 */
export const dataEntryValidation: ModelConfig = {
  id: "data-entry-validation",
  name: "Data Entry & Validation",
  tagline:
    "Replace your onshore data-entry and validation team with Indecomm's offshore BPO at a fraction of the per-FTE cost — same headcount, same SLA, lower bill.",
  platform: {
    name: "Indecomm BPO",
    logo: "/logos/indecomm.png",
    blurb:
      "Indecomm's offshore BPO operations deliver data entry and validation at industry-standard productivity with SLAs, audit-trail reporting, and a managed-service model — no infrastructure or hiring for the client to absorb.",
    accentHex: "#2076BA",
  },

  volumeInputs: [
    {
      id: "applications",
      label: "Applications per Month",
      type: "number",
      defaultValue: 9000,
      help: "Total applications processed per month. One application requires one data-entry pass and one validation pass.",
    },
  ],

  roles: [
    {
      id: "dataEntry",
      label: "Data Entry",
      productivityBasis: "perDay",
      defaultProductivity: 22.5,
      defaultHourlyRate: 20,
      volumeKey: "applications",
      appliesSampleRate: false,
      help:
        "Loans per data-entry FTE per day. 20 min / loan × 7.5 hrs / day = 22.5 loans / day.",
    },
    {
      id: "validation",
      label: "Validation",
      productivityBasis: "perDay",
      defaultProductivity: 15,
      defaultHourlyRate: 30,
      volumeKey: "applications",
      appliesSampleRate: false,
      help:
        "Loans per validation FTE per day. 30 min / loan × 7.5 hrs / day = 15 loans / day.",
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
      help: "LOS access, intake portals, productivity licenses, IT support.",
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

  // Indecomm prices per-FTE for both functions. The FTE count mirrors the
  // client's in-house need (same headcount required to do the work; the
  // savings are in the per-FTE rate, not in productivity gains).
  pricing: [
    {
      type: "perFTE",
      id: "indecommDataEntry",
      label: "Indecomm Data Entry (per FTE)",
      roleId: "dataEntry",
      defaultMonthlyPricePerFTE: 1800,
    },
    {
      type: "perFTE",
      id: "indecommValidation",
      label: "Indecomm Validation (per FTE)",
      roleId: "validation",
      defaultMonthlyPricePerFTE: 2000,
    },
  ],

  perLoanDenominator: {
    volumeKey: "applications",
    unitLabel: "applications",
  },
};

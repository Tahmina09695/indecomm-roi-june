import type { SaasModelConfig } from "./_saas-types";

/**
 * Navy Federal Credit Union — Custom RFP Model.
 *
 * STATUS: Hidden from the landing page and from all groups. Reachable only
 * by direct URL: /calculator/navy-federal. Only people with the URL can open
 * it. This is "security through obscurity" — fine for early RFP-stage
 * sharing; upgrade to a passcode gate later if broader visibility is needed.
 *
 * SHAPE: SaaS Before/After variant — Navy Federal keeps the work in-house
 * in both scenarios; we lift productivity with Indecomm platforms instead
 * of replacing the team.
 *
 * THREE FUNCTIONS (each its own row, each with its own volume):
 *   1. RESPA / TRID auditor                — AuditGenius
 *   2. Post-close auditor                  — AuditGenius
 *   3. Trailing-docs analyst               — DocGenius
 *      (IDXGenius sits upstream of all three; its impact is baked into
 *       each role's productivity lift rather than shown as a separate row.)
 *
 * Defaults sourced from:
 *   - "Indecomm NFCU Pricing Final for Claude with two audits only.xlsx"
 *   - "NFCU Pricing Slides.pptx"
 *   - User-confirmed productivity + hourly rates + current-platform cost
 *
 * Pricing model:
 *   - FIXED annual license (NFCU is a flat-bundle RFP price, not per-loan)
 *   - Y1: $3,989,590 (revised in-scope, with 5% Y1 discount per the slide)
 *   - One-time implementation: $520,000 (revised, RESPA + Post-Close + IDX + DG)
 *   - Current legacy platforms (Paradatec + Hyland Voyager + Trinity): ~$3M/yr
 */
export const navyFederal: SaasModelConfig = {
  kind: "saas",
  id: "navy-federal",
  name: "Navy Federal Credit Union — Custom RFP Model",
  tagline:
    "Custom Navy Federal scenario reflecting their three in-scope functions (RESPA, Post-Close, Trailing Docs), proposed Indecomm platform pricing, and assumed legacy-platform cost.",
  platform: {
    name: "IDXGenius + AuditGenius + DocGenius",
    // Use AuditGenius as the visual lead since two of the three functions are AG-driven.
    logo: "/logos/Audit-Genius-Logo-Color_Black.png",
    logoWhite: "/logos/Audit-Genius-Logo_Color_White.png",
    blurb:
      "Indecomm's integrated post-settlement stack — IDXGenius (Gen AI document intelligence) feeding AuditGenius (RESPA + Post-Close audit workflows) and DocGenius (trailing-doc lifecycle management) — running on a single technology stack with SourceConnect linking Empower and downstream systems.",
    accentHex: "#F1A421",
    capabilities: [
      "IDXGenius — Gen AI + ML document classification, versioning, and 250+ field extraction upstream of every audit workflow.",
      "AuditGenius — RESPA/TRID + Post-Close audit workflows with compliance-engine integration, configurable checklists, and full audit-trail reporting.",
      "DocGenius — dedicated NFCU instance for trailing-doc lifecycle: ERD tracking, follow-ups, exception handling, agent performance.",
      "One vendor, one technology stack — document processing, audit workflows, and trailing-doc management integrated end-to-end via SourceConnect.",
      "Onshore product + customer support; offshore engineering, HITL, and platform operations bundled into the per-loan license.",
    ],
  },

  // Lead with $ savings — the in-house team is large enough that absolute
  // savings is the more compelling story than ROI %.
  displayPreference: "savings-first",

  // NFCU is sensitive about layoff language. The calculator uses softer
  // "capacity freed / redeployable FTEs" framing throughout.
  tone: "capacity-freed",

  // Annual escalator hook — applied to both Indecomm license (Y2/Y3) AND
  // the legacy platform cost so the 3-year comparison stays apples-to-apples.
  // Currently set to 0% per user request (Nov 2025). Set to 0.03 to restore
  // the original 3% NFCU-RFP escalator behavior.
  pricingEscalatorAnnual: 0,
  enableThreeYearView: true,

  // Show the annual volume number (matches NFCU RFP Table 1) prominently,
  // with the monthly equivalent in a small subscript.
  volumeDisplay: "annual-primary",

  volumeInputs: [
    {
      id: "indexingVolume",
      label: "Loans Indexed per Month",
      type: "number",
      defaultValue: 5167,
      help: "Monthly loans flowing through indexing / data extraction (upstream of all three audit functions). Defaults to NFCU RESPA volume as the broadest in-scope pipeline.",
    },
    {
      id: "respaVolume",
      label: "RESPA / TRID Reviews per Month",
      type: "number",
      defaultValue: 5167,
      help: "Monthly RESPA / TRID review volume (NFCU Table 1: 62,000 annually ÷ 12).",
    },
    {
      id: "postCloseVolume",
      label: "Post-Close Audits per Month",
      type: "number",
      defaultValue: 2075,
      help: "Monthly Post-Close audit volume (NFCU Table 1: 24,900 annually ÷ 12).",
    },
    {
      id: "trailingDocsVolume",
      label: "Trailing-Doc Reviews per Month",
      type: "number",
      defaultValue: 6667,
      help: "Monthly trailing-doc / onboarding review volume (NFCU Table 1: 80,000 annually ÷ 12).",
    },
  ],

  // Each role drives its OWN volume key. The engine already supports this
  // (SaasRoleDef.volumeKey is per-role).
  roles: [
    {
      id: "indexingExtraction",
      label: "Indexing & Data Extraction",
      productivityBasis: "perDay",
      defaultBaselineProductivity: 12,
      defaultHourlyRate: 22,
      defaultImprovementPct: 1.0,
      volumeKey: "indexingVolume",
      // IDXGenius fully eliminates this role (Gen AI document classification +
      // 250+ field extraction replace manual indexing). The eliminatedByPlatform
      // flag forces After FTE to 0 regardless of the improvement % math.
      eliminatedByPlatform: true,
      help:
        "Files per indexer per day. IDXGenius eliminates this role entirely — Gen AI document classification, versioning, and 250+ field extraction replace manual indexing. After-state FTE = 0.",
    },
    {
      id: "respaAuditor",
      label: "RESPA / TRID Auditor",
      productivityBasis: "perDay",
      defaultBaselineProductivity: 6,
      defaultHourlyRate: 30,
      defaultImprovementPct: 0.75,
      volumeKey: "respaVolume",
      help:
        "Loans per RESPA auditor per day. AuditGenius (with IDX upstream) typically delivers ~75% productivity lift on RESPA/TRID workflows — automated tolerance checks, prepopulated questions, and one-pane review interface.",
    },
    {
      id: "postCloseAuditor",
      label: "Post-Close Auditor",
      productivityBasis: "perDay",
      defaultBaselineProductivity: 6,
      defaultHourlyRate: 30,
      defaultImprovementPct: 0.60,
      volumeKey: "postCloseVolume",
      help:
        "Loans per post-close auditor per day. AuditGenius typically delivers ~60% productivity lift via configurable checklists, IDX-extracted data, and automation of routine checks.",
    },
    {
      id: "trailingDocsAnalyst",
      label: "Trailing-Docs Analyst",
      productivityBasis: "perDay",
      defaultBaselineProductivity: 10,
      defaultHourlyRate: 30,
      defaultImprovementPct: 0.50,
      volumeKey: "trailingDocsVolume",
      help:
        "Loans per trailing-docs analyst per day. DocGenius lifts productivity ~50% with ERD tracking, automated follow-ups, and exception management.",
    },
  ],

  supervisor: { spanOfControl: 10, salary: 95_000 },
  benefitsRate: 0.25,

  // Standard $1M pool × 5% allocation per category. Reps can adjust per NFCU's
  // actual corporate overhead allocations once known.
  indirectCosts: [
    { id: "management",  label: "Management Costs",            defaultAnnualPool: 1_000_000, defaultAllocationPct: 0.05, help: "Layered management above the line." },
    { id: "occupancy",   label: "Occupancy & Equipment",       defaultAnnualPool: 1_000_000, defaultAllocationPct: 0.05, help: "Rent, workstations, utilities." },
    { id: "technology",  label: "Technology Related",          defaultAnnualPool: 1_000_000, defaultAllocationPct: 0.05, help: "LOS access, IT support, infrastructure." },
    { id: "other",       label: "Other Operating Expenses",    defaultAnnualPool: 1_000_000, defaultAllocationPct: 0.05, help: "Training, travel, supplies." },
    { id: "gna",         label: "General, Admin & Corporate",  defaultAnnualPool: 1_000_000, defaultAllocationPct: 0.05, help: "HR, Finance, Legal, Compliance allocation." },
  ],

  pricing: {
    // Per-loan numbers from slide 3 ($71.50/loan when a loan goes through all
    // functions). These are informational only because we use the fixed annual
    // license below as the authoritative number.
    defaultPerLoanMonthlyFee: 71.5,
    defaultOneTimeImplementationFee: 520_000,
    licenseLineLabel: "Indecomm Annual License (RESPA + Post-Close + IDX + DocGenius)",
    implementationLineLabel: "Indecomm Implementation (RESPA + Post-Close + IDX + DocGenius)",

    // NFCU is priced as a FIXED annual bundle. CEO-revised pricing (June 2026):
    //   IDXGenius:    $1,360,000  (per-loan, billed annually)
    //   AuditGenius:  $1,500,000  (annual platform fee, up to 90,000 audits)
    //   DocGenius:    $  450,000  (annual platform fee, up to 80,000 loans)
    //   Subtotal:     $3,310,000
    //   Y1 discount:  −$  68,000  (~2%)
    //   NET ANNUAL:   $3,242,000   ← this number
    // (Previous RFP-quoted bundle was $3,989,590; revised down 19% per slide 7.)
    defaultFixedAnnualLicense: 3_242_000,

    // NFCU's assumed current legacy platforms (Paradatec, Hyland Voyager,
    // Trinity). Indecomm doesn't have NFCU's actual contract figures —
    // this is a working assumption per user. Rep can override per scenario.
    defaultCurrentPlatformAnnualCost: 3_000_000,
  },

  perLoanUnitLabel: "loans (blended)",
  // Use RESPA volume as the per-loan denominator for "Cost / loan" displays
  // since it's the largest in-scope audit volume.
  perLoanVolumeKey: "respaVolume",
};

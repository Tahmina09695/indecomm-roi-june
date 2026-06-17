// Type definitions for the "SaaS Automation" model variant used by IDXGenius and
// DecisionGenius. Distinct from ModelConfig because the calculation shape is
// fundamentally different: instead of "in-house vs outsourced", we compare
// "before automation" vs "after automation" across multiple roles, each with
// its own productivity-improvement %, plus a per-loan license fee and one-time
// implementation fee.

import type { IndirectCostDef, VolumeInput } from "./_types";

export type SaasRoleDef = {
  id: string;
  label: string;
  /** "perDay" = baseline is loans/FTE/day; "perMonth" = baseline is loans/FTE/month. */
  productivityBasis: "perDay" | "perMonth";
  defaultBaselineProductivity: number;
  defaultHourlyRate: number;
  /** Default % productivity improvement after the platform is implemented (0..1). */
  defaultImprovementPct: number;
  /** Volume input ID that drives FTE need for this role. */
  volumeKey: string;
  /**
   * When true, the After-state FTE for this role is forced to 0 — the role is
   * fully eliminated by the platform (e.g., manual indexing replaced by
   * IDXGenius Gen-AI extraction). This overrides the productivity-improvement
   * math, which would otherwise only halve / reduce the role.
   */
  eliminatedByPlatform?: boolean;
  help?: string;
};

/**
 * Indirect cost definitions for SaaS models reuse the same shape as services,
 * but the "after" column allocates proportionally based on the in-house FTE
 * ratio (after / before). The engine handles this automatically.
 */
export type SaasIndirectCostDef = IndirectCostDef;

export type SaasPricing = {
  /** Per-loan / per-application license fee charged monthly. */
  defaultPerLoanMonthlyFee: number;
  /** One-time implementation fee paid in Year 1 only. */
  defaultOneTimeImplementationFee: number;
  /** Display label for the license fee, e.g. "IDXGenius.ai cost". */
  licenseLineLabel: string;
  /** Display label for the implementation fee, e.g. "IDXGenius.ai implementation". */
  implementationLineLabel: string;
  /**
   * Optional: client's current annual platform/system cost (legacy software
   * being replaced by Indecomm's stack). When set, the engine ADDS this to
   * the "Before" annual cost and the platform line replaces it on the
   * "After" side. Use this for models where the prospect's incumbent
   * platforms are a meaningful cost line (e.g., NFCU's Paradatec, Hyland
   * Voyager, Trinity).
   */
  defaultCurrentPlatformAnnualCost?: number;
  /**
   * Optional fixed annual license fee that overrides the per-loan license
   * calculation entirely. Used when the proposed pricing is a flat or
   * pre-negotiated annual figure (e.g., NFCU's RFP-quoted bundle price).
   * When set, `defaultPerLoanMonthlyFee` is ignored for total spend
   * calculations; per-loan unit prices still display as informational.
   */
  defaultFixedAnnualLicense?: number;
};

export type SaasModelConfig = {
  /** Discriminator so the UI can route SaaS vs services models. */
  kind: "saas";
  id: string;
  name: string;
  tagline: string;
  /** Indecomm product/platform delivering the SaaS automation. */
  platform: {
    name: string;          // "IDXGenius" | "DecisionGenius"
    logo: string;
    /**
     * Optional white version of the logo, used for dark backgrounds
     * (Excel navy header band). Falls back to `logo` when not set.
     */
    logoWhite?: string;
    blurb: string;
    accentHex: string;     // primary accent color for this model
    /** Product-specific capability bullets shown in the on-screen Platform Callout
     *  and the printed Dashboard. Replaces the generic services bullets. */
    capabilities?: string[];
  };
  volumeInputs: VolumeInput[];
  /** Roles affected by the platform's automation gains. */
  roles: SaasRoleDef[];
  supervisor: { spanOfControl: number; salary: number };
  benefitsRate: number;
  indirectCosts: SaasIndirectCostDef[];
  pricing: SaasPricing;
  /** "applications", "loans" — used as denominator for per-loan cost figures. */
  perLoanUnitLabel?: string;
  /** Per-loan denominator volume key (default: first non-derived volume input). */
  perLoanVolumeKey?: string;
  /**
   * How to display the headline result.
   *  - "roi-first"     = big ROI % on the hero (default; works well when ROI < ~300%).
   *  - "savings-first" = lead with $ Annual Savings, show Savings % as secondary.
   *    Use when ROI % is dominated by a small license fee and would look implausible
   *    to a prospect (e.g., IDXGenius at default volumes shows ROI > 1000%).
   */
  displayPreference?: "roi-first" | "savings-first";

  /**
   * Tone for labels around headcount reduction. Some clients (e.g., NFCU) are
   * sensitive about "layoffs / FTEs saved" language and prefer to frame the
   * productivity lift as freed capacity that can be redeployed.
   *  - "savings"        = default — "FTEs Saved", "Headcount Reduction" etc.
   *  - "capacity-freed" = softer — "FTE Capacity Freed", "Redeployable FTEs"
   */
  tone?: "savings" | "capacity-freed";

  /**
   * Optional 3-year pricing escalator (e.g., 0.03 for 3% annual). When set,
   * the engine produces a year3 result and applies the escalator to:
   *   - Indecomm annual license (Y2 = annual × (1+esc), Y3 = annual × (1+esc)^2)
   *   - Current platform cost (legacy) — same escalator
   *   - In-house labor + indirect — held flat by default
   * Reps can adjust per scenario.
   */
  pricingEscalatorAnnual?: number;

  /**
   * When true, the engine includes a 3-year aggregate (Y1+Y2+Y3) view in the
   * SaaS result. Defaults to false; turn on for RFP-stage models that pitch
   * 3-year totals (NFCU).
   */
  enableThreeYearView?: boolean;

  /**
   * Volume input display preference. When "annual-primary", the volume input
   * field shows the annual number as the headline value (matching RFP figures
   * like NFCU's Table 1) with a smaller "monthly equivalent" subscript.
   * Internally the engine still uses monthly volume — only display changes.
   *  - "monthly-primary" (default) — original behavior
   *  - "annual-primary" — annual number prominent, monthly underneath
   */
  volumeDisplay?: "monthly-primary" | "annual-primary";
};

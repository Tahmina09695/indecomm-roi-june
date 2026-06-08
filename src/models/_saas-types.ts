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
};

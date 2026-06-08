// Type definitions for ROI model configuration.
// One ModelConfig drives one ROI calculator (e.g., PCQC).

export type ProductivityBasis = "perDay" | "perMonth";

// Days per working month assumption used across all Excel models.
export const WORKING_DAYS_PER_MONTH = 20;
export const WORKING_HOURS_PER_YEAR = 2080;

export type VolumeInput = {
  id: string;
  label: string;
  /** "number" = absolute number; "percent" = 0..1 fraction; "derived" = computed from others */
  type: "number" | "percent" | "derived";
  defaultValue: number;
  help?: string;
  /** Used by "derived" inputs to compute themselves from other inputs map. */
  derive?: (values: Record<string, number>) => number;
};

export type RoleDef = {
  id: string;
  label: string;
  productivityBasis: ProductivityBasis;
  /** Loans-per-FTE per day OR per month, depending on basis. */
  defaultProductivity: number;
  /** Productivity multiplier applied to volume before FTE math (e.g., 2x for two passes, 0.1 for 10% of loans). */
  productivityMultiplier?: number;
  defaultHourlyRate: number;
  /** Volume input ID that drives this role's FTE need (after applying sampleRate if applicable). */
  volumeKey: string;
  /** If true, volume is multiplied by the sample rate before computing FTEs. */
  appliesSampleRate?: boolean;
  help?: string;
};

export type IndirectCostDef = {
  id: string;
  label: string;
  defaultAnnualPool: number;
  defaultAllocationPct: number; // 0..1
  help?: string;
};

export type PerLoanPricing = {
  type: "perLoan";
  id: string;
  label: string;
  volumeKey: string;
  /** If true, volume is multiplied by sample rate before pricing. */
  appliesSampleRate?: boolean;
  defaultPrice: number;
};

export type PerFTEPricing = {
  type: "perFTE";
  id: string;
  label: string;
  /** Source role ID whose FTE count drives the pricing. */
  roleId: string;
  /** Optional rounding applied to base FTE before multiplier/offset.
   *  Matches some Excel models (e.g., PPR) that use ROUND(FTE,0)+1. */
  roundBaseFte?: "round" | "ceil" | "floor";
  /** Optional multiplier applied to source role FTEs (e.g., 1.2 for offshore overhead). */
  fteMultiplier?: number;
  /** Optional bump added to FTE count AFTER the multiplier (e.g., +1 supervisor). */
  fteOffset?: number;
  defaultMonthlyPricePerFTE: number;
};

export type PricingDef = PerLoanPricing | PerFTEPricing;

export type ModelConfig = {
  id: string;
  name: string;
  /** Short tagline shown on landing tile. */
  tagline: string;
  /** Indecomm product/platform delivering this service (the differentiator). */
  platform: {
    name: string;          // "AuditGenius"
    logo: string;          // path under /public (colored/dark version for light backgrounds)
    /**
     * Optional path to the white version of the same logo, used for dark
     * backgrounds (Excel navy header band, PDF dark hero, etc.). Falls back
     * to `logo` when not set.
     */
    logoWhite?: string;
    blurb: string;         // why this platform is a differentiator
    accentHex: string;     // primary accent color for this model
  };
  volumeInputs: VolumeInput[];
  sampleRate?: { id: string; label: string; default: number; help?: string };
  roles: RoleDef[];
  supervisor: { spanOfControl: number; salary: number };
  benefitsRate: number; // 0..1
  indirectCosts: IndirectCostDef[];
  pricing: PricingDef[];
  /**
   * Optional override for the denominator used to compute "avg cost per loan".
   * Defaults to the audited volumes implied by per-loan pricing lines. Use this
   * for per-FTE models (e.g., Underwriting) where the audited basis is a
   * different volume input — typically applications or funded loans.
   */
  perLoanDenominator?: {
    volumeKey: string;
    appliesSampleRate?: boolean;
    /** Display label e.g. "applications", "funded loans". */
    unitLabel?: string;
  };

  /**
   * Optional retention support. Some clients keep a small in-house team for
   * exception management and vendor oversight even after outsourcing to
   * Indecomm — usually a % of the original direct team plus a fixed supervisor.
   *
   * When this config is present, the calculator exposes a "Retained In-house
   * Staff" toggle/section. When enabled, the engine adds a retained-staff
   * cost (direct + supervisor + benefits + pro-rated indirect) on top of the
   * Indecomm outsourcing cost.
   *
   * Existing models that don't set this work exactly as before — pure
   * in-house vs Indecomm.
   */
  retention?: {
    /** Default % of original direct (volume-driven) roles retained. */
    defaultRetentionPct: number;       // 0..1
    /** Default fixed supervisor count retained (independent of % above). */
    defaultRetainedSupervisors: number;
    /** Short copy shown above the retention section. */
    help?: string;
  };
};

import { pcqc } from "./pcqc";
import { pfqc } from "./pfqc";
import { servicingQc } from "./servicing-qc";
import { pchPostClose } from "./pch-postclose";
import { pchTrailing } from "./pch-trailing";
import { ppr } from "./ppr";
import { underwriting } from "./underwriting";
import { idxgenius } from "./idxgenius";
import { idxgeniusBulk } from "./idxgenius-bulk";
import { decisiongenius } from "./decisiongenius";
import type { ModelConfig } from "./_types";
import type { SaasModelConfig } from "./_saas-types";

// Active services models — implemented and usable.
export const MODELS: Record<string, ModelConfig> = {
  pcqc,
  pfqc,
  "servicing-qc": servicingQc,
  "pch-postclose": pchPostClose,
  "pch-trailing": pchTrailing,
  ppr,
  underwriting,
};

// Active SaaS automation models — implemented and usable. Distinct from MODELS
// because their calculation shape is different (before/after vs in-house/outsourced).
export const SAAS_MODELS: Record<string, SaasModelConfig> = {
  idxgenius,
  "idxgenius-bulk": idxgeniusBulk,
  decisiongenius,
};

export type ComingSoonModel = {
  id: string;
  name: string;
  tagline: string;
  platform: string;
};

export const COMING_SOON: ComingSoonModel[] = [];

// ----- Grouping -----------------------------------------------------------

export type Group = {
  id: string;
  name: string;
  tagline: string;
  /** Platform name highlighted on the group tile. */
  platform: string;
  /** Hex accent color used on the group tile (matches the platform's brand color). */
  accentHex: string;
  /** Path to a banner illustration (SVG) shown at the top of the group tile. */
  imageSrc?: string;
  /** Platform logos shown on the group hero page next to the illustration. */
  platformLogos?: { src: string; alt: string }[];
  /** Ordered list of model IDs in this group (can mix services + SaaS). */
  modelIds: string[];
};

// Order: Automation first (newest / most differentiated), then services groups
// (QC, PCH, UW+PPR). On a 3-up grid this puts Automation, QC, and PCH on the
// first row; UW+PPR wraps to the second row.
export const GROUPS: Group[] = [
  {
    id: "automation",
    name: "Automation ROI",
    tagline:
      "Quantify the productivity uplift and Year 1 / Year 2 ROI of adopting Indecomm's SaaS automation platforms — IDXGenius.ai and DecisionGenius.",
    platform: "IDXGenius + DecisionGenius",
    accentHex: "#2BA8E0",
    imageSrc: "/groups/automation.svg",
    platformLogos: [
      { src: "/logos/IDX logo - Dark-8.png", alt: "IDXGenius" },
      { src: "/logos/Decision-Genius-Logo_color_Black.png", alt: "DecisionGenius" },
    ],
    modelIds: ["idxgenius", "idxgenius-bulk", "decisiongenius"],
  },
  {
    id: "qc",
    name: "QC Solutions",
    tagline:
      "Pre-Fund, Post-Close, and Servicing Quality Control — compare your true in-house cost to Indecomm's AuditGenius-powered outsourced pricing.",
    platform: "AuditGenius",
    accentHex: "#F1A421",
    imageSrc: "/groups/qc.svg",
    platformLogos: [{ src: "/logos/Audit-Genius-Logo-Color_Black.png", alt: "AuditGenius" }],
    modelIds: ["pfqc", "pcqc", "servicing-qc"],
  },
  {
    id: "pch",
    name: "Post-Close & Trailing Docs (PCH)",
    tagline:
      "Post-Close audits, trailing document tracking, follow-up, and exception handling — delivered through DocGenius automation.",
    platform: "DocGenius",
    accentHex: "#8064A2",
    imageSrc: "/groups/pch.svg",
    platformLogos: [{ src: "/logos/Doc-Genius-Logo_color_Black.png", alt: "DocGenius" }],
    modelIds: ["pch-postclose", "pch-trailing"],
  },
  {
    id: "uw-ppr",
    name: "Underwriting & Pre-Purchase Reviews",
    tagline:
      "Loan underwriting and pre-purchase review ROI — powered by DecisionGenius (UW) and AuditGenius (PPR).",
    platform: "DecisionGenius + AuditGenius",
    accentHex: "#2076BA",
    imageSrc: "/groups/uw-ppr.svg",
    platformLogos: [
      { src: "/logos/Decision-Genius-Logo_color_Black.png", alt: "DecisionGenius" },
      { src: "/logos/Audit-Genius-Logo-Color_Black.png", alt: "AuditGenius" },
    ],
    modelIds: ["underwriting", "ppr"],
  },
];

// Helper accessors --------------------------------------------------------

export function getModel(id: string): ModelConfig | undefined {
  return MODELS[id];
}

export function getSaasModel(id: string): SaasModelConfig | undefined {
  return SAAS_MODELS[id];
}

/** True if the model ID corresponds to a SaaS automation model. */
export function isSaasModel(id: string): boolean {
  return !!SAAS_MODELS[id];
}

export function getGroup(id: string): Group | undefined {
  return GROUPS.find((g) => g.id === id);
}

/** Returns the group a given model belongs to. Works for both services + SaaS. */
export function getGroupForModel(modelId: string): Group | undefined {
  return GROUPS.find((g) => g.modelIds.includes(modelId));
}

export type ResolvedModelTile = {
  id: string;
  name: string;
  tagline: string;
  platform: string;
  active: boolean;
};

/** Resolve a model ID into a tile-ready summary (services, SaaS, or coming-soon). */
export function resolveModelTile(id: string): ResolvedModelTile | null {
  const m = MODELS[id];
  if (m) {
    return { id: m.id, name: m.name, tagline: m.tagline, platform: m.platform.name, active: true };
  }
  const s = SAAS_MODELS[id];
  if (s) {
    return { id: s.id, name: s.name, tagline: s.tagline, platform: s.platform.name, active: true };
  }
  const cs = COMING_SOON.find((c) => c.id === id);
  if (cs) {
    return { id: cs.id, name: cs.name, tagline: cs.tagline, platform: cs.platform, active: false };
  }
  return null;
}

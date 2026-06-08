"use client";
import Link from "next/link";
import type { Group } from "@/models";
import { MODELS, SAAS_MODELS } from "@/models";

type Props = { group: Group };

/**
 * Vibrant landing-page tile for an entire solution group.
 * Banner image at top tinted with the group's accent color; below: an "ROI Calculator"
 * eyebrow, name, tagline, and list of calculators with active vs coming-soon indicators.
 *
 * Sized compactly so all 3 tiles fit on a typical laptop screen below the hero.
 */
export function GroupTile({ group }: Props) {
  const activeCount = group.modelIds.filter((id) => MODELS[id] || SAAS_MODELS[id]).length;
  const total = group.modelIds.length;
  // Lightweight cream/tint backgrounds for the banner per group.
  const bannerBg =
    group.id === "qc" ? "#FFF7E6"
      : group.id === "pch" ? "#F2EDF9"
        : group.id === "automation" ? "#E2F1FB"
          : "#E2F1FB";

  return (
    <Link
      href={`/group/${group.id}`}
      className="block h-full rounded-2xl bg-white border border-slate-200 hover:shadow-2xl transition-all shadow-card overflow-hidden hover:-translate-y-0.5"
    >
      {/* Banner image with accent strip overlay */}
      <div className="relative" style={{ background: bannerBg }}>
        {group.imageSrc && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={group.imageSrc}
            alt=""
            className="block w-full h-24 object-cover"
          />
        )}
        {/* Bottom accent ribbon */}
        <div className="absolute bottom-0 left-0 right-0 h-1.5" style={{ background: group.accentHex }} aria-hidden />
        {/* Floating platform badge */}
        <div
          className="absolute top-2 right-2 text-[10px] uppercase tracking-wider font-bold text-white px-2 py-1 rounded-md shadow"
          style={{ background: group.accentHex }}
        >
          {group.platform}
        </div>
      </div>

      <div className="p-4 flex flex-col">
        <div
          className="text-[10px] uppercase tracking-[0.18em] font-extrabold mb-1"
          style={{ color: group.accentHex }}
        >
          ROI Calculator
        </div>
        <h3 className="text-lg font-bold text-navy leading-tight">{group.name}</h3>
        <p className="text-xs text-slate-600 mt-1.5 leading-snug">{group.tagline}</p>

        <ul className="mt-3 space-y-1 text-xs">
          {group.modelIds.map((id) => {
            const isActive = !!MODELS[id] || !!SAAS_MODELS[id];
            return (
              <li key={id} className="flex items-center gap-2">
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full"
                  style={{ background: isActive ? group.accentHex : "#CBD5E1" }}
                />
                <span className={isActive ? "text-navy font-medium" : "text-slate-400"}>
                  {labelFor(id)}
                </span>
                {!isActive && (
                  <span className="text-[9px] uppercase tracking-wider text-slate-400 ml-1">
                    Coming soon
                  </span>
                )}
              </li>
            );
          })}
        </ul>

        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            {activeCount} of {total} calculator{total === 1 ? "" : "s"}
          </span>
          <span
            className="text-xs font-bold"
            style={{ color: group.accentHex }}
          >
            Open ROI calculators →
          </span>
        </div>
      </div>
    </Link>
  );
}

function labelFor(id: string): string {
  const map: Record<string, string> = {
    pcqc: "Post-Close QC",
    pfqc: "Pre-Fund QC",
    "servicing-qc": "Servicing QC",
    "pch-postclose": "PCH Post-Close",
    "pch-trailing": "PCH Trailing Docs",
    ppr: "Pre-Purchase Reviews",
    underwriting: "Underwriting",
    idxgenius: "IDXGenius.ai — Retail",
    "idxgenius-bulk": "IDXGenius.ai — Bulk",
    decisiongenius: "DecisionGenius",
  };
  return map[id] ?? id;
}

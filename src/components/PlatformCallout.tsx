"use client";

type Props = {
  name: string;
  logoSrc: string;
  blurb: string;
  /** Optional product-specific capability bullets. Falls back to the default
   *  services bullets (QC-style) when not provided. */
  capabilities?: string[];
  /** Accent color hex for the callout border/labels. Defaults to AuditGenius
   *  orange to preserve the look on services calculators. */
  accentHex?: string;
};

const DEFAULT_BULLETS = [
  "Robust reporting & interactive dashboards — real-time visibility into QC performance, defects, and trends.",
  "Consistent QC quality across loan types and channels.",
];

export function PlatformCallout({ name, logoSrc, blurb, capabilities, accentHex = "#F1A421" }: Props) {
  const bullets = capabilities && capabilities.length > 0 ? capabilities : DEFAULT_BULLETS;
  return (
    <div
      className="rounded-xl shadow-card p-4 border-2 border-l-8"
      style={{ background: `${accentHex}1A`, borderColor: accentHex }}
    >
      <div className="flex items-start gap-4">
        <div className="shrink-0 bg-white rounded-md p-2 border" style={{ borderColor: `${accentHex}55` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc} alt={name} className="h-9 w-auto" />
        </div>
        <div className="flex-1">
          <div className="text-xs uppercase tracking-wider font-bold" style={{ color: accentHex }}>
            Indecomm Differentiator
          </div>
          <div className="text-sm text-navy mt-0.5"><strong>{name}</strong> — {blurb}</div>
          <ul className="mt-2 text-xs text-navy/80 space-y-1 list-disc pl-5">
            {bullets.map((b, i) => (
              <li key={i} dangerouslySetInnerHTML={{ __html: highlightFirstPhrase(b) }} />
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/**
 * If a bullet starts with a short phrase followed by " — " (em-dash with spaces),
 * bold that phrase. This matches how the default services bullets and most
 * config-driven capability strings are written (e.g.,
 * "Robust reporting & interactive dashboards — real-time visibility...").
 */
function highlightFirstPhrase(s: string): string {
  const m = s.match(/^([^—]{2,80})\s+—\s+(.*)$/);
  if (m) return `<strong>${escapeHtml(m[1])}</strong> — ${escapeHtml(m[2])}`;
  return escapeHtml(s);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

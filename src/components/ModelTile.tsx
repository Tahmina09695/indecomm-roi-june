"use client";
import Link from "next/link";

type Props = {
  id: string;
  name: string;
  tagline: string;
  platform: string;
  active?: boolean;
};

export function ModelTile({ id, name, tagline, platform, active }: Props) {
  const inner = (
    <div
      className={[
        "rounded-xl p-5 h-full flex flex-col justify-between transition shadow-card border",
        active
          ? "bg-white border-orange/40 hover:border-orange hover:shadow-lg cursor-pointer"
          : "bg-white/70 border-slate-200 cursor-not-allowed",
      ].join(" ")}
    >
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span
            className={[
              "inline-block w-2 h-2 rounded-full",
              active ? "bg-orange" : "bg-slate-300",
            ].join(" ")}
          />
          <span className="text-xs uppercase tracking-wider text-navy/70 font-semibold">
            Powered by {platform}
          </span>
        </div>
        <h3 className="text-lg font-bold text-navy">{name}</h3>
        <p className="text-sm text-slate-600 mt-2 leading-snug">{tagline}</p>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <span
          className={[
            "text-sm font-semibold",
            active ? "text-orange" : "text-slate-400",
          ].join(" ")}
        >
          {active ? "Open calculator →" : "Coming soon"}
        </span>
      </div>
    </div>
  );

  return active ? (
    <Link href={`/calculator/${id}`} className="block h-full">{inner}</Link>
  ) : (
    <div className="block h-full">{inner}</div>
  );
}

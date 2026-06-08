import { Header } from "@/components/Header";
import { GroupTile } from "@/components/GroupTile";
import { GROUPS } from "@/models";

export default function HomePage() {
  const totalCalculators = GROUPS.reduce((sum, g) => sum + g.modelIds.length, 0);
  return (
    <div className="min-h-screen flex flex-col">
      <Header showHome={false} />

      {/* Vibrant gradient hero — compact, so the 3 group tiles appear above the fold. */}
      <section className="relative overflow-hidden text-white" style={{
        background: "linear-gradient(135deg, #002060 0%, #003B95 45%, #2076BA 100%)",
      }}>
        {/* Decorative accent glows */}
        <div className="pointer-events-none absolute -top-24 -right-24 w-96 h-96 rounded-full opacity-30" style={{ background: "radial-gradient(circle, #F1A421 0%, transparent 70%)" }} aria-hidden />
        <div className="pointer-events-none absolute -bottom-24 -left-24 w-96 h-96 rounded-full opacity-30" style={{ background: "radial-gradient(circle, #2BA8E0 0%, transparent 70%)" }} aria-hidden />

        <div className="relative mx-auto max-w-[1400px] px-6 pt-5 pb-6">
          {/* Big, eye-catching ROI Suite badge */}
          <div className="flex justify-center mb-3">
            <div
              className="brand-pulse inline-flex items-center gap-3 rounded-full px-6 py-2.5 border-2 border-orange/70"
              style={{ background: "linear-gradient(90deg, rgba(241,164,33,0.18) 0%, rgba(241,164,33,0.05) 50%, rgba(241,164,33,0.18) 100%)" }}
            >
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-orange shadow-[0_0_12px_#F1A421]" />
              <span className="text-base sm:text-lg font-extrabold tracking-[0.25em] uppercase shimmer-text">
                Indecomm ROI Suite
              </span>
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-orange shadow-[0_0_12px_#F1A421]" />
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold leading-tight text-center max-w-6xl mx-auto">
            Compare your true in-house cost to Indecomm's
            <span className="text-orange whitespace-nowrap"> tech-enabled solutions.</span>
          </h1>
          <p className="mt-2 text-white/85 text-center max-w-5xl mx-auto text-sm sm:text-base">
            Most prospects under-estimate the real cost of running mortgage operations in-house — they forget supervisor overhead, benefits, occupancy, IT, and G&amp;A. These calculators build the honest number and put it side-by-side with what you'd pay Indecomm.
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2 text-xs">
            <span className="bg-white/10 border border-white/20 rounded-full px-3 py-1">{GROUPS.length} solution groups</span>
            <span className="bg-white/10 border border-white/20 rounded-full px-3 py-1">{totalCalculators} calculators</span>
            <span className="bg-orange text-navy font-bold rounded-full px-3 py-1">Live ROI in seconds</span>
          </div>
        </div>
      </section>

      <main className="flex-1" style={{ background: "linear-gradient(180deg, #F7F8FC 0%, #EEF2FB 100%)" }}>
        <div className="mx-auto max-w-[1400px] px-6 py-5">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-lg font-bold text-navy">Choose a solution group</h2>
            <span className="text-xs text-slate-500">
              {GROUPS.length} groups · {totalCalculators} calculators
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {GROUPS.map((g) => (
              <GroupTile key={g.id} group={g} />
            ))}
          </div>
        </div>
      </main>

      <footer className="bg-navy text-white/70 text-xs">
        <div className="mx-auto max-w-[1400px] px-6 py-3 flex justify-between">
          <span>Indecomm ROI Calculator</span>
          <span>Internal &amp; client use · All rights reserved</span>
        </div>
      </footer>
    </div>
  );
}

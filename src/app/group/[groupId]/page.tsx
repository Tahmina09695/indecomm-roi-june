import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { ModelTile } from "@/components/ModelTile";
import { getGroup, resolveModelTile } from "@/models";

export default function GroupPage({ params }: { params: { groupId: string } }) {
  const group = getGroup(params.groupId);
  if (!group) notFound();

  const tiles = group.modelIds
    .map((id) => resolveModelTile(id))
    .filter((t): t is NonNullable<typeof t> => t !== null);

  // Gradient: navy → deep blue → group accent
  const heroBg = `linear-gradient(135deg, #002060 0%, #003B95 45%, ${group.accentHex} 130%)`;

  return (
    <div className="min-h-screen flex flex-col">
      <Header showHome={false} />

      <section className="relative overflow-hidden text-white" style={{ background: heroBg }}>
        {/* Accent glow */}
        <div
          className="pointer-events-none absolute -top-24 -right-24 w-96 h-96 rounded-full opacity-30"
          style={{ background: `radial-gradient(circle, ${group.accentHex} 0%, transparent 70%)` }}
          aria-hidden
        />
        <div className="relative mx-auto max-w-[1400px] px-6 py-8">
          <nav className="text-xs text-white/70 mb-3">
            <Link href="/" className="hover:text-orange transition">All Groups</Link>
            <span className="mx-2 opacity-60">/</span>
            <span className="text-white">{group.name}</span>
          </nav>
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-full px-3 py-1 mb-2 border border-white/20">
                <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: group.accentHex }} />
                <span className="text-[11px] uppercase tracking-widest font-semibold text-white">Powered by {group.platform}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold">{group.name}</h1>
              <p className="text-white/85 mt-2 max-w-3xl text-sm sm:text-base">{group.tagline}</p>
            </div>

            {/* Right side: product logo(s) + illustration */}
            <div className="hidden md:flex items-center gap-3 flex-shrink-0">
              {group.platformLogos && group.platformLogos.length > 0 && (
                <div className="flex flex-col gap-2">
                  {group.platformLogos.map((logo) => (
                    <div key={logo.src} className="bg-white rounded-md px-3 py-2 shadow-lg border border-white/40">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={logo.src} alt={logo.alt} className="h-7 w-auto" />
                    </div>
                  ))}
                </div>
              )}
              {group.imageSrc && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={group.imageSrc} alt="" className="h-24 rounded-lg shadow-lg" />
              )}
            </div>
          </div>
        </div>
      </section>

      <main className="flex-1" style={{ background: "linear-gradient(180deg, #F7F8FC 0%, #EEF2FB 100%)" }}>
        <div className="mx-auto max-w-[1400px] px-6 py-8">
          <h2 className="text-lg font-bold text-navy mb-4">Choose a calculator</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tiles.map((t) => (
              <ModelTile
                key={t.id}
                id={t.id}
                name={t.name}
                tagline={t.tagline}
                platform={t.platform}
                active={t.active}
              />
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

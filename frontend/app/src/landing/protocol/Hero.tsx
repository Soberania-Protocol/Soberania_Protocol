import { LogoRotating } from '../../components/logo/LogoRotating';
import { MINERALS } from '../enterprise/minerals';
import { FRONTERA_SYSTEMS_NAME, FRONTERA_SYSTEMS_URL } from '../brand';

const m = MINERALS.amethyst;

// Dark bookend, matching the visual rhythm every other AOC surface's hero
// uses (../enterprise/Hero.tsx, governed-access/Hero.tsx, assurance/Hero.tsx):
// light-primary page, dark #0B1220 hero + closing CTA.
export function Hero() {
  return (
    <section id="overview" className="scroll-mt-16 bg-[#0B1220] px-6 pt-20 pb-24 md:pt-28 md:pb-32 text-center">
      <div className="max-w-5xl mx-auto flex flex-col items-center">
        <div className="flex items-center gap-2.5">
          <LogoRotating size={18} inverted />
          <p className={`text-xs font-bold uppercase tracking-[0.14em] ${m.onDark}`}>
            Open Protocol &middot; Digital Assets &amp; Sovereignty
          </p>
        </div>

        <h1 className="mt-7 text-[40px] md:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-[1.05]">
          A digital asset is only legitimate when its owners can explicitly define how it is
          governed.
        </h1>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="#digital-asset"
            className={`inline-flex items-center justify-center rounded-full ${m.solid} px-7 py-3.5 text-sm font-semibold text-white ${m.solidHover} transition-colors`}
          >
            Explore the capabilities &darr;
          </a>

          <a
            href={FRONTERA_SYSTEMS_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-full border border-white/15 hover:border-white/30 px-7 py-3.5 text-sm font-semibold text-white transition-colors"
          >
            See {FRONTERA_SYSTEMS_NAME}
          </a>
        </div>
      </div>
    </section>
  );
}

import { BUILDER_AUDIENCES } from './content';
import { SectionHeader, Card } from '../enterprise/primitives';
import { MINERALS } from '../enterprise/minerals';
import { LogoRotating } from '../../components/logo/LogoRotating';
import type { CSSProperties } from 'react';
import { PROTOCOL_PACKAGE_URL } from '../brand';
import './Developers.css';

const m = MINERALS.amethyst;

export function Developers() {
  return (
    <section id="developers" className="scroll-mt-16 max-w-7xl mx-auto px-6 py-20 border-t border-slate-200">
      <div className="developers-layout">
        <div className="developers-copy">
          <SectionHeader
            eyebrow="Developers and Builders"
            title="Who builds with Soberanía Protocol."
            description="@aoc/protocol publishes the versioned public contract layer — capability, proof, credential-manifest and claim shapes — as an open-source package under Apache-2.0. It's not yet published to a registry; build it from source in the repository."
            mineral="amethyst"
          />

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <a
              href={PROTOCOL_PACKAGE_URL}
              target="_blank"
              rel="noreferrer"
              className={`inline-flex items-center justify-center rounded-xl border ${m.border} px-6 py-3 text-sm font-semibold ${m.text} transition hover:bg-violet-50`}
            >
              View @aoc/protocol on GitHub
            </a>
            <a
              href="/?view=docs"
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
            >
              Read the docs
            </a>
          </div>
        </div>

        <div className="developers-orbit">
          <div className="developers-orbit__center" aria-hidden="true">
            <LogoRotating size={56} inverted={false} />
          </div>

          <div className="developers-orbit__ring" aria-hidden="true" />

          <ol className="developers-orbit__layer" aria-label="Developer and builder audiences">
            {BUILDER_AUDIENCES.map((audience, index) => {
              const angle = -90 + index * (360 / BUILDER_AUDIENCES.length);
              const orbitStyle = { '--orbit-angle': `${angle}deg` } as CSSProperties;

              return (
                <li className="developers-orbit__node" style={orbitStyle} key={audience.name} tabIndex={0}>
                  <div className="developers-orbit__counter">
                    <Card className="developer-card p-3.5">
                      <p className="text-xs font-extrabold leading-snug text-slate-900">{audience.name}</p>
                      <p className="mt-1 text-[11px] leading-snug text-slate-500">{audience.summary}</p>
                    </Card>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}

import { useEffect } from 'react';
import { SOBERANIA_PROTOCOL_URL } from '../../brand';

const PAGE_URL = `${SOBERANIA_PROTOCOL_URL}/?view=assurance`;
const TITLE = 'Soberanía Assurance — Sovereignty and Governance Capability Assessment | Soberanía Enterprise';
const DESCRIPTION =
  'Soberanía Assurance evaluates, validates and continuously monitors every sovereignty capability defined by Soberanía Protocol and every governance capability operated by Soberanía Enterprise — capability inventory, evidence validation, maturity rating, and a path to continuous assurance.';

// Per-page metadata injection, mirroring landing/protocol/usePageMeta.ts and
// landing/useIntelligenceRiskPageMeta.ts. Overrides the root index.html
// defaults (title/description/canonical), which predate W007 and are
// scoped to the paid Intelligence Risk offers now living at
// /assurance/intelligence-risk — see
// docs/w007-assurance-canonical-assessment-layer.md "Metadata and SEO".
export function useAssurancePageMeta() {
  useEffect(() => {
    const prevTitle = document.title;

    const setMeta = (name: string, content: string, prop = false) => {
      const attr = prop ? 'property' : 'name';
      let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
      const created = !el;
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, name);
        document.head.appendChild(el);
      }
      const prevContent = el.getAttribute('content');
      el.setAttribute('content', content);
      return { el, prevContent, created };
    };

    const prevCanonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    const prevCanonicalHref = prevCanonical?.getAttribute('href') ?? null;
    const canonicalCreated = !prevCanonical;
    const canonicalEl = prevCanonical ?? document.createElement('link');
    if (canonicalCreated) {
      canonicalEl.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalEl);
    }
    canonicalEl.setAttribute('href', PAGE_URL);

    document.title = TITLE;

    const restorers: Array<() => void> = [];
    const track = (name: string, content: string, prop = false) => {
      const { el, prevContent, created } = setMeta(name, content, prop);
      restorers.push(() => {
        if (created) el.remove();
        else if (prevContent !== null) el.setAttribute('content', prevContent);
      });
    };

    track('description', DESCRIPTION);
    track('og:title', TITLE, true);
    track('og:description', DESCRIPTION, true);
    track('og:url', PAGE_URL, true);
    track('twitter:title', TITLE);
    track('twitter:description', DESCRIPTION);

    return () => {
      document.title = prevTitle;
      restorers.forEach((restore) => restore());
      if (canonicalCreated) canonicalEl.remove();
      else if (prevCanonicalHref !== null) canonicalEl.setAttribute('href', prevCanonicalHref);
    };
  }, []);
}

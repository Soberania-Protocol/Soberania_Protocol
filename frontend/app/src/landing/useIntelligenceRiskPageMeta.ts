import { useEffect } from 'react';
import { SOBERANIA_PROTOCOL_URL } from './brand';

const PAGE_URL = `${SOBERANIA_PROTOCOL_URL}/assurance/intelligence-risk`;
const TITLE = 'Intelligence Risk — a Soberanía Assurance Module | Soberanía Assurance';
const DESCRIPTION =
  'Intelligence Risk is the specialized Soberanía Assurance module that assesses Knowledge Loss, Key Person Dependency, Institutional Memory and Constitutional Index posture. Part of Soberanía Assurance, the assessment and continuous-monitoring layer for Soberanía Protocol and Soberanía Enterprise.';

// Per-page metadata injection, mirroring landing/protocol/usePageMeta.ts.
// Intelligence Risk moved from the canonical `/?view=assurance` URL to this
// dedicated route as part of W007 — see
// docs/w007-assurance-canonical-assessment-layer.md. This hook keeps the
// live document head (title, description, canonical URL) pointed at the
// module's own identity instead of inheriting the root index.html defaults.
export function useIntelligenceRiskPageMeta() {
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

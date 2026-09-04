import { useEffect } from 'react';
import { SOBERANIA_PROTOCOL_URL } from '../brand';

const PAGE_URL = `${SOBERANIA_PROTOCOL_URL}/`;
const TITLE = 'Soberanía Protocol — An Open Protocol for Digital Assets, Capabilities & Sovereignty';
const DESCRIPTION =
  "Soberanía Protocol is an open, provider-neutral protocol for digital assets — identity, integrity, provenance, capabilities and sovereignty that compatible systems can interpret. Frontera Systems operationalizes governance on top of it.";

// Per-page metadata injection so the root URL's live document head matches
// the Protocol thesis instead of the static index.html defaults (which are
// scoped to Soberanía Assurance for social scrapers that don't execute JS — see
// the index.html edits in the same change for that fallback). Mirrors the
// pattern already used by GovVsSovPage / WhatIsAiSovereigntyPage.
export function usePageMeta() {
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
    track('og:site_name', 'Soberanía Protocol', true);
    track('twitter:title', TITLE);
    track('twitter:description', DESCRIPTION);

    return () => {
      document.title = prevTitle;
      restorers.forEach((restore) => restore());
    };
  }, []);
}

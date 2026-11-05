/**
 * The OAuth terms page's script (SPEC §6; §15 DR-151). The server renders that page
 * itself, with each contract section's Markdown as plain text in an element marked
 * `data-terms-markdown`; this turns each into HTML in place, through the same
 * sanitizing pipeline the admin uses (§9.3), so both show exactly the same terms.
 * Until it runs, or if it never loads, the page shows the Markdown as written, so
 * no part of the terms is ever hidden.
 *
 * Built as its own entry at a fixed name, `static/terms-markdown.js` (vite.config.ts),
 * for the server's template to load.
 */

import { markdownToHtml } from 'components/templating/markdown';

document.querySelectorAll<HTMLElement>('[data-terms-markdown]').forEach((element) => {
  element.innerHTML = markdownToHtml(element.textContent ?? '');
  // Every link opens in a new tab, this site's too, so the page asking for agreement
  // (and the app's request with it) stays put.
  element.querySelectorAll('a').forEach((link) => {
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  });
  // Rendered: the page's styles for Markdown as written no longer apply.
  element.removeAttribute('data-terms-markdown');
});

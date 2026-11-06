/**
 * A contract version's text (SPEC §6; §15 DR-145, DR-153): one Markdown document,
 * its headings its sections, rendered through the sanitizing pipeline (§9.3).
 */

import { markdownToHtml, RenderedMarkdown } from 'components/templating';
import { useMemo } from 'react';

import classes from './ContractText.module.css';

export function ContractText({ body }: { body: string }) {
  const html = useMemo(() => markdownToHtml(body), [body]);
  return (
    <div className={classes.text}>
      <RenderedMarkdown html={html} />
    </div>
  );
}

/** When a version took effect, as a date. */
export function formatEffectiveDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

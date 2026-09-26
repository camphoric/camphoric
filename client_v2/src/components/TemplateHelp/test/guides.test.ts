import { markdownToHtml } from 'components/templating';
import { describe, expect, it } from 'vitest';

import { escapeTablePipes, GUIDE_TOPICS, guideTopic } from '../guides';

describe('guides', () => {
  it('has the topic the server’s read-only message points to', () => {
    // env.py: "see Template Help › Computed values".
    expect(GUIDE_TOPICS.map((t) => t.title)).toContain('Computed values');
  });

  it('falls back to the first topic', () => {
    expect(guideTopic('nope')).toBe(GUIDE_TOPICS[0]);
    expect(guideTopic('lodging').title).toBe('Lodging');
  });

  it('keeps filters intact inside table cells', () => {
    expect(escapeTablePipes('| `a | money` | b |\ntext `x | y`')).toBe(
      '| `a \\| money` | b |\ntext `x | y`',
    );
    const html = markdownToHtml(guideTopic('formatting').body);
    expect(html).toContain('<code>{{ event.start | date }}</code>');
  });

  it('documents every Handlebars helper', () => {
    const body = guideTopic('handlebars').body;
    expect(body).toContain('### getLodgingValue');
    expect(body).toContain('### eachsort');
  });
});

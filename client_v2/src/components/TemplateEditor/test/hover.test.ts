import { describe, expect, it } from 'vitest';

import { hoverMarkdown } from '../hover';
import { sampleDescription as description } from '../sampleDescription';

const hover = (text: string) => hoverMarkdown(text, description, 'report');

describe('hoverMarkdown', () => {
  it('describes fields with their owner and type', () => {
    const text = hover('{{ event.nights');
    expect(text).toContain('`event.nights`: `list<date>`');
  });

  it('describes loop variables by their type', () => {
    expect(hover('{% for c in campers %}{{ c')).toContain('`c`: `camper`');
    expect(hover('{% for c in campers %}{{ c.attributes.linens')).toContain(
      '`attributes:camper.linens`: `bool`',
    );
  });

  it('describes roots, filters and tests', () => {
    expect(hover('{{ campers')).toContain('`campers`: `list<camper>`');
    expect(hover('{{ x | money')).toContain('**filter**');
    expect(hover('{% if x is defined')).toContain('**test**');
  });

  it('says nothing outside expressions or for unknown names', () => {
    expect(hover('event')).toBeNull();
    expect(hover('{{ nope')).toBeNull();
    expect(hover('{{ event.nope')).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';

import { processHandlebarsTemplate as render } from './pipeline';

describe('templating helpers', () => {
  it('count returns array length and throws on non-arrays', () => {
    expect(render('{{count items}}', { items: [1, 2, 3] })).toBe('3');
    expect(() => render('{{count items}}', { items: 5 })).toThrow();
  });

  it('math helpers: sum, subtract, abs', () => {
    expect(render('{{sum 5 10 20}}', {})).toBe('35');
    expect(render('{{subtract 20 5 10}}', {})).toBe('5');
    expect(render('{{abs -5}}', {})).toBe('5');
  });

  it('comparison helpers: lt, gt, or', () => {
    expect(render('{{#if (lt 5 8)}}yes{{else}}no{{/if}}', {})).toBe('yes');
    expect(render('{{#if (gt 5 8)}}yes{{else}}no{{/if}}', {})).toBe('no');
    expect(render('{{or false 0 winner}}', { winner: 'bob' })).toBe('bob');
  });

  it('compare block renders only when the comparison holds', () => {
    expect(render("{{#compare name '===' 'bob'}}hi{{/compare}}", { name: 'bob' })).toBe('hi');
    expect(render("{{#compare name '===' 'bob'}}hi{{/compare}}", { name: 'sue' })).toBe('');
  });

  it('filter narrows an array by a path comparison', () => {
    const vars = {
      campers: [
        { attributes: { age: '0-4', first_name: 'bob' } },
        { attributes: { age: '5-9', first_name: 'sue' } },
      ],
    };
    const tpl = "{{#each (filter campers 'attributes.age' '===' '0-4')}}{{attributes.first_name}}{{/each}}";
    expect(render(tpl, vars)).toBe('bob');
  });

  it('lookup helpers resolve an id against a @root lookup table', () => {
    const vars = { camperLookup: { '1': { attributes: { first_name: 'bob' } } } };
    expect(render("{{getCamperValue '1' 'attributes.first_name'}}", vars)).toBe('bob');
    // Missing ids resolve to an empty string, not a crash.
    expect(render("{{getCamperValue '99' 'attributes.first_name'}}", vars)).toBe('');
  });

  it('eachsort / eachrsort order by a key path', () => {
    const vars = { users: [{ name: 'Zed' }, { name: 'Abby' }, { name: 'Bob' }] };
    expect(render("{{#eachsort users 'name'}}{{name}},{{/eachsort}}", vars)).toBe('Abby,Bob,Zed,');
    expect(render("{{#eachrsort users 'name'}}{{name}},{{/eachrsort}}", vars)).toBe('Zed,Bob,Abby,');
  });

  it('eachLookupSort orders by a value found in a lookup table', () => {
    const vars = {
      campers: [{ lodging: '2' }, { lodging: '1' }],
      lodgingLookup: { '1': { name: 'Abby' }, '2': { name: 'Zed' } },
    };
    const tpl = "{{#eachLookupSort campers 'lodging' 'lodgingLookup' 'name'}}{{lodging}},{{/eachLookupSort}}";
    expect(render(tpl, vars)).toBe('1,2,');
  });
});

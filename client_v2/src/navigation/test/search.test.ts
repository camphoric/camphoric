import { describe, expect, it } from 'vitest';

import { parseSearch, stringifySearch } from '../search';

describe('search params', () => {
  it('writes values plainly, leaving out empty ones', () => {
    expect(stringifySearch({ reportId: '71', q: 'Lark Camp', regpage: undefined, mq: '' })).toBe(
      '?reportId=71&q=Lark+Camp',
    );
    expect(stringifySearch({})).toBe('');
  });

  it('reads every value as a string, numbers too', () => {
    expect(parseSearch('?reportId=71&regTab=history&q=Lark+Camp')).toEqual({
      reportId: '71',
      regTab: 'history',
      q: 'Lark Camp',
    });
  });

  it('still reads links whose values were JSON-quoted', () => {
    expect(parseSearch('?reportId=%2271%22&userId=%22new%22')).toEqual({
      reportId: '71',
      userId: 'new',
    });
    // Quotes that aren't JSON are left alone.
    expect(parseSearch('?q=%22say%20%5C%22')).toEqual({ q: '"say \\"' });
  });

  it('round-trips what the admin keeps in the URL', () => {
    const search = {
      lodgingFilter: '3,4,12',
      mq: 'a&b=c',
      regsort: '[{"id":"camper","desc":true}]',
      templateId: 'new',
    };
    expect(parseSearch(stringifySearch(search))).toEqual(search);
  });
});

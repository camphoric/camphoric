import { describe, expect, it } from 'vitest';

import { onlyOverlayChanged } from '../overlay';

const at = (pathname: string, search = '') => ({ pathname, search });

describe('onlyOverlayChanged', () => {
  it('is true when only an overlay opens, closes or changes', () => {
    const page = '/admin/organization/3/event/4/reports';
    expect(
      onlyOverlayChanged(at(page, '?reportId=71'), at(page, '?reportId=71&overlay=users')),
    ).toBe(true);
    expect(
      onlyOverlayChanged(
        at(page, '?reportId=71&overlay=users&userId=new'),
        at(page, '?reportId=71&overlay=users&historyUserId=2'),
      ),
    ).toBe(true);
    expect(onlyOverlayChanged(at(page, '?overlay=users&userId=2'), at(page))).toBe(true);
  });

  it('is false when the page itself changes', () => {
    const page = '/admin/organization/3/event/4/reports';
    expect(onlyOverlayChanged(at(page, '?reportId=71'), at(page, '?reportId=57'))).toBe(false);
    expect(onlyOverlayChanged(at(page), at('/admin/organization/3/event/4/home'))).toBe(false);
    expect(
      onlyOverlayChanged(at(page, '?overlay=users'), at(page, '?overlay=users&reportId=1')),
    ).toBe(false);
  });
});

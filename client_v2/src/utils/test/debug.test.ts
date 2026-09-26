import { afterEach, describe, expect, it, vi } from 'vitest';

import { debug, isDebugEnabled } from '../debug';

describe('debug', () => {
  afterEach(() => {
    window.localStorage.removeItem('DEBUG');
    vi.restoreAllMocks();
  });

  it('stays silent unless the DEBUG flag is set', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    debug('quiet', 1);
    expect(log).not.toHaveBeenCalled();
    expect(isDebugEnabled()).toBe(false);
  });

  it('logs when the DEBUG flag is set', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    window.localStorage.setItem('DEBUG', '1');
    debug('loud', { a: 1 });
    expect(log).toHaveBeenCalledWith('loud', { a: 1 });
    expect(isDebugEnabled()).toBe(true);
  });

  it('treats an unavailable localStorage as off', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(isDebugEnabled()).toBe(false);
  });
});

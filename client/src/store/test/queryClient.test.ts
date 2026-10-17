import { notifications } from '@mantine/notifications';
import { ApiError } from 'utils/fetch';
import { describe, expect, it, vi } from 'vitest';

import { describeError, queryClient } from '../queryClient';

vi.mock('@mantine/notifications', () => ({ notifications: { show: vi.fn() } }));

const conflict = () =>
  new ApiError(412, 'Precondition Failed', {
    detail: 'Someone else changed this since you opened it.',
    code: 'version_conflict',
    current: { id: 1, version: 4 },
  });

describe('describeError', () => {
  it('uses the detail, with the first template problem', () => {
    expect(describeError(new ApiError(400, 'Bad Request', { detail: 'Nope.' }))).toBe('Nope.');
    expect(
      describeError(
        new ApiError(400, 'Bad Request', {
          detail: 'The template has problems.',
          diagnostics: [{ severity: 'error', message: "invitation has no field 'x'", line: 2 }],
        }),
      ),
    ).toBe("The template has problems. Line 2: invitation has no field 'x'");
  });

  it('lists field errors', () => {
    expect(
      describeError(
        new ApiError(400, 'Bad Request', {
          body: ['Line 2: unexpected end of template'],
        }),
      ),
    ).toBe('body: Line 2: unexpected end of template');
  });

  it('says a refusal is about permission', () => {
    const refused = new ApiError(403, 'Forbidden', {
      detail: 'You do not have permission to perform this action.',
    });
    expect(describeError(refused)).toBe("You don't have permission to do that.");
  });

  it('says a save was refused because someone else changed the record first', () => {
    expect(describeError(conflict())).toBe(
      'Someone else changed this since you opened it, so your change wasn’t saved.',
    );
  });

  it('falls back to the status', () => {
    expect(describeError(new ApiError(500, 'Server Error', null))).toBe('500 Server Error');
  });
});

describe('the shared failure toast (DR-10, DR-109)', () => {
  const fail = (meta?: Record<string, unknown>) =>
    queryClient
      .getMutationCache()
      .build(queryClient, { mutationFn: () => Promise.reject(conflict()), meta, retry: false })
      .execute(undefined)
      .catch(() => undefined);

  it('reports a conflict nobody handles', async () => {
    vi.mocked(notifications.show).mockClear();
    await fail();
    expect(notifications.show).toHaveBeenCalledTimes(1);
  });

  it('stays quiet when the screen shows the conflict itself', async () => {
    vi.mocked(notifications.show).mockClear();
    await fail({ handlesVersionConflict: true });
    expect(notifications.show).not.toHaveBeenCalled();
  });
});

import { ApiError } from 'utils/fetch';
import { describe, expect, it } from 'vitest';

import { describeError } from '../queryClient';

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

  it('falls back to the status', () => {
    expect(describeError(new ApiError(500, 'Server Error', null))).toBe('500 Server Error');
  });
});

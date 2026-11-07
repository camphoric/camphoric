/**
 * When a new personal access token expires (SPEC §6; #965). The person always
 * chooses: a number of days from now, a date and time of their own, or never —
 * there's no default. When the server caps a token's life
 * (`api_token_max_days`), "never" isn't offered, no choice of days goes past
 * the cap, and the cap itself is offered.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Kept short of the cap, so a browser clock a little ahead of the server's
 * doesn't make the longest choice one the server refuses.
 */
const CAP_MARGIN_MS = 10 * 60 * 1000;

/** The lengths offered, in days, before the server's cap trims them. */
const OFFERED_DAYS = [7, 30, 90];

/** A choice of expiry: that many days from now (`'30'`), a date and time, or never. */
export type ExpiryChoice = `${number}` | 'date' | 'never';

export interface ExpiryOption {
  value: ExpiryChoice;
  label: string;
}

const daysLabel = (days: number) => `In ${days} ${days === 1 ? 'day' : 'days'}`;

/** The choices to offer, given the server's cap (null: none). */
export function expiryOptions(maxDays: number | null): ExpiryOption[] {
  const days =
    maxDays === null
      ? OFFERED_DAYS
      : [...new Set([...OFFERED_DAYS.filter((offered) => offered < maxDays), maxDays])];
  return [
    ...days.map((count) => ({ value: `${count}` as ExpiryChoice, label: daysLabel(count) })),
    { value: 'date', label: 'On a date and time you choose' },
    ...(maxDays === null ? [{ value: 'never' as const, label: 'Never' }] : []),
  ];
}

/**
 * The latest a token may expire, given the server's cap (a few minutes short of
 * it; see `CAP_MARGIN_MS`); null when there's no cap.
 */
export function latestExpiry(maxDays: number | null, now: Date): Date | null {
  return maxDays === null ? null : new Date(now.getTime() + maxDays * DAY_MS - CAP_MARGIN_MS);
}

/**
 * What's wrong with a chosen date and time (an ISO instant), or null when it's
 * fine: it must be later than now, and no later than the cap allows.
 */
export function expiryProblem(iso: string, maxDays: number | null, now: Date): string | null {
  const chosen = new Date(iso);
  if (chosen <= now) return 'Choose a time that’s still to come.';
  const latest = latestExpiry(maxDays, now);
  if (latest && chosen > latest) {
    return `A token may last at most ${maxDays} ${maxDays === 1 ? 'day' : 'days'}.`;
  }
  return null;
}

/**
 * The `expires_at` to send for a choice: an ISO instant, or null for never.
 * `chosenIso` is the date and time picked, for `'date'`. A number of days that
 * reaches the cap stops at `latestExpiry`.
 */
export function expiresAtFor(
  choice: ExpiryChoice,
  chosenIso: string | null,
  maxDays: number | null,
  now: Date,
): string | null {
  if (choice === 'never') return null;
  if (choice === 'date') return chosenIso;
  const inDays = now.getTime() + Number(choice) * DAY_MS;
  const latest = latestExpiry(maxDays, now);
  return new Date(latest ? Math.min(inDays, latest.getTime()) : inDays).toISOString();
}

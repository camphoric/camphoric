import userEvent from '@testing-library/user-event';
import { Settings } from 'luxon';
import { renderWithProviders, screen } from 'test/utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ZonedDateTimePicker } from '../ZonedDateTimePicker';

function picker(value: string | null) {
  const onChange = vi.fn();
  renderWithProviders(
    <ZonedDateTimePicker
      label="Registration closes"
      value={value}
      timeZone="America/Los_Angeles"
      onChange={onChange}
      submitButtonProps={{ 'aria-label': 'Done' }}
      clearButtonProps={{ 'aria-label': 'Clear' }}
    />,
  );
  return { onChange, user: userEvent.setup() };
}

describe('ZonedDateTimePicker', () => {
  // An admin whose browser is in Tokyo, editing a camp in California.
  beforeEach(() => {
    Settings.defaultZone = 'Asia/Tokyo';
  });
  afterEach(() => {
    Settings.defaultZone = 'system';
  });

  it('shows the time at camp, and names the zone', () => {
    picker('2026-12-13T22:00:00Z');
    expect(screen.getByText('12/13/2026 2:00 PM')).toBeInTheDocument();
    expect(screen.getByText('Pacific Time')).toBeInTheDocument();
  });

  it('gives a picked time as an instant at camp', async () => {
    const { onChange, user } = picker('2026-12-13T22:00:00Z');
    await user.click(screen.getByText('12/13/2026 2:00 PM'));
    await user.click(
      await screen.findByRole('button', { name: '14 December 2026' }, { timeout: 5000 }),
    );
    await user.click(screen.getByLabelText('Done'));
    expect(onChange).toHaveBeenLastCalledWith('2026-12-14T22:00:00.000Z');
  });

  it('gives null when cleared', async () => {
    const { onChange, user } = picker('2026-12-13T22:00:00Z');
    await user.click(screen.getByLabelText('Clear'));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});

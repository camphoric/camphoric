import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen } from 'test/utils';
import { describe, expect, it, vi } from 'vitest';

import { EditLeaseNoticeView } from '../EditLeaseNotice';
import { ALEX_EDITING } from './leases';

function view(props: { isYou?: boolean; overlapping?: boolean } = {}) {
  const onTakeOver = vi.fn();
  renderWithProviders(
    <EditLeaseNoticeView
      label="registration"
      lease={ALEX_EDITING}
      isYou={props.isYou ?? false}
      overlapping={props.overlapping ?? false}
      onTakeOver={onTakeOver}
    />,
  );
  return { onTakeOver, user: userEvent.setup() };
}

describe('EditLeaseNoticeView', () => {
  it('says who is editing, and offers to edit anyway', async () => {
    const { onTakeOver, user } = view();
    expect(screen.getByText('Alex Registrar is editing this registration')).toBeInTheDocument();
    expect(screen.getByText(/It opens for editing here once they’re done/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Edit anyway' }));
    expect(onTakeOver).toHaveBeenCalled();
  });

  it('warns when this form has unsaved changes too', () => {
    view({ overlapping: true });
    expect(screen.getByText(/Your changes here aren’t saved yet/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Take it back' })).toBeInTheDocument();
  });

  it('knows the holder may be the same person in another tab', () => {
    view({ isYou: true });
    expect(
      screen.getByText('You are editing this registration in another tab'),
    ).toBeInTheDocument();
    expect(screen.getByText(/once you’re done there\./)).toBeInTheDocument();
  });
});

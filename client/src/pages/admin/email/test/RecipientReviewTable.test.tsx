import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { renderWithProviders, screen } from 'test/utils';
import { describe, expect, it } from 'vitest';

import { RecipientReviewTable } from '../RecipientReviewTable';
import { sampleAudience } from './emailFixtures';

const { recipients } = sampleAudience();

function setup(skipAlreadySent = true, initial = ['camper:3', 'camper:4']) {
  let latest = new Set(initial);
  function Harness() {
    const [selected, setSelected] = useState(latest);
    return (
      <RecipientReviewTable
        recipients={recipients}
        selected={selected}
        onSelectedChange={(next) => {
          latest = next;
          setSelected(next);
        }}
        skipAlreadySent={skipAlreadySent}
      />
    );
  }
  renderWithProviders(<Harness />);
  return { user: userEvent.setup(), selected: () => [...latest].sort() };
}

describe('RecipientReviewTable', () => {
  it('unchecks and checks one recipient', async () => {
    const { user, selected } = setup();
    await user.click(screen.getByRole('checkbox', { name: 'Send to Lee Park (camper #3)' }));
    expect(selected()).toEqual(['camper:4']);
    await user.click(screen.getByRole('checkbox', { name: 'Send to Lee Park (camper #3)' }));
    expect(selected()).toEqual(['camper:3', 'camper:4']);
  });

  it('selects none, or all, of the recipients a search shows', async () => {
    const { user, selected } = setup();
    await user.type(screen.getByRole('textbox', { name: 'Search recipients' }), 'sam@');
    expect(screen.queryByText('Lee Park (camper #3)')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Select none shown' }));
    expect(selected()).toEqual(['camper:3']);
    await user.clear(screen.getByRole('textbox', { name: 'Search recipients' }));
    await user.click(screen.getByRole('button', { name: 'Select none' }));
    expect(selected()).toEqual([]);
    await user.click(screen.getByRole('checkbox', { name: 'Select all shown' }));
    expect(selected()).toEqual(['camper:3', 'camper:4']);
  });

  it('marks who already got it, and whether they’re skipped', () => {
    setup(true);
    expect(screen.getByText('Already sent: skipped')).toBeInTheDocument();
  });

  it('says when a search finds no one', async () => {
    const { user } = setup(false);
    expect(screen.getByText('Already sent')).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Search recipients' }), 'nobody');
    expect(screen.getByText('No recipients match the search.')).toBeInTheDocument();
  });
});

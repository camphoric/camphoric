import userEvent from '@testing-library/user-event';
import type { BulkRecipientCriteria, BulkRecipientResolution } from 'api-types';
import { useState } from 'react';
import { renderWithProviders, screen } from 'test/utils';
import { describe, expect, it, vi } from 'vitest';

import { EMPTY_CRITERIA, RecipientSelector } from './RecipientSelector';

const resolution: BulkRecipientResolution = {
  recipients: [
    {
      email: 'pat@example.com',
      name: 'Pat',
      label: 'Registration #1 (pat@example.com)',
      registration: 1,
      camper: null,
    },
  ],
  skipped: [
    {
      label: 'Registration #2 (x)',
      reason: 'invalid',
      detail: '',
      email: 'x',
      registration: 2,
      camper: null,
    },
  ],
  diagnostics: [
    {
      severity: 'error',
      kind: 'syntax',
      message: 'unexpected end',
      field: 'recipient_filter',
      line: 1,
      column: null,
    },
  ],
};

function Harness({ onChange }: { onChange: (c: BulkRecipientCriteria) => void }) {
  const [criteria, setCriteria] = useState(EMPTY_CRITERIA);
  return (
    <RecipientSelector
      criteria={criteria}
      onChange={(next) => {
        setCriteria(next);
        onChange(next);
      }}
      resolution={resolution}
    />
  );
}

describe('RecipientSelector', () => {
  it('edits the criteria for registrations and shows expression errors', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<Harness onChange={onChange} />);

    const filter = screen.getByLabelText('Which ones (Jinja expression)');
    expect(filter).toHaveAttribute('aria-invalid', 'true');
    expect(filter).toHaveAccessibleDescription(expect.stringContaining('unexpected end'));
    await user.type(filter, 'x');
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ recipient_filter: 'x' }));
    expect(screen.getByLabelText('Address (Jinja expression)')).toHaveAttribute(
      'placeholder',
      'registration.registrant_email',
    );
  });

  it('switches to a typed list', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<Harness onChange={onChange} />);
    await user.click(screen.getByText('Listed addresses'));
    await user.type(screen.getByLabelText('Addresses'), 'a@example.com');
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ recipient_kind: 'manual', recipient_list: 'a@example.com' }),
    );
    expect(screen.queryByLabelText('Which ones (Jinja expression)')).not.toBeInTheDocument();
  });

  it('shows who it reaches and who it skips', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness onChange={vi.fn()} />);
    expect(screen.getByText('1 recipient, 1 skipped')).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'pat@example.com' })).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Skipped' }));
    expect(screen.getByText('Not a valid address')).toBeInTheDocument();
  });
});

import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen, within } from 'test/utils';
import { describe, expect, it, vi } from 'vitest';

import { EditConflictView, fieldLabel, formatValue } from '../EditConflict';
import { BASE, LABELS, MINE_APART, MINE_CLASH, THEIRS_APART, THEIRS_CLASH } from './conflicts';

function view(mine: typeof BASE, theirs: typeof BASE) {
  const onChoose = vi.fn();
  renderWithProviders(
    <EditConflictView
      label="registration"
      base={BASE}
      mine={mine}
      theirs={theirs}
      fieldLabels={LABELS}
      onChoose={onChoose}
    />,
  );
  return { onChoose, user: userEvent.setup() };
}

describe('EditConflictView', () => {
  it('lists each side’s changes when they don’t overlap', () => {
    view(MINE_APART, THEIRS_APART);
    expect(screen.queryByText('You both changed')).not.toBeInTheDocument();
    expect(screen.getByText('Registrant email: pat@example.org')).toBeInTheDocument();
    expect(screen.getByText('Diet: Vegan')).toBeInTheDocument();
    expect(screen.getByText('Saving yours keeps their changes too.')).toBeInTheDocument();
  });

  it('sets out what both changed, yours beside theirs', () => {
    view(MINE_CLASH, THEIRS_CLASH);
    const row = screen.getByRole('row', { name: /First name/ });
    expect(within(row).getByText('Pattie')).toBeInTheDocument();
    expect(within(row).getByText('Patricia')).toBeInTheDocument();
    expect(screen.getByText('Registration type: 2')).toBeInTheDocument();
    expect(screen.getByText('Diet: Vegan')).toBeInTheDocument();
  });

  it('answers with the choice', async () => {
    const { onChoose, user } = view(MINE_CLASH, THEIRS_CLASH);
    await user.click(screen.getByRole('button', { name: 'Save mine on top of theirs' }));
    expect(onChoose).toHaveBeenCalledWith('reapply');
    await user.click(screen.getByRole('button', { name: 'Discard mine' }));
    expect(onChoose).toHaveBeenCalledWith('discard');
  });
});

describe('fieldLabel and formatValue', () => {
  it('names a field by its path, its last segment, or itself', () => {
    expect(fieldLabel('attributes.first_name', LABELS)).toBe('First name');
    expect(fieldLabel('attributes.shirt_size')).toBe('Shirt size');
  });

  it('shows empty values and long ones briefly', () => {
    expect(formatValue(null)).toBe('(empty)');
    expect(formatValue(['Mon', 'Tue'])).toBe('["Mon","Tue"]');
    expect(formatValue('x'.repeat(100))).toHaveLength(80);
  });
});

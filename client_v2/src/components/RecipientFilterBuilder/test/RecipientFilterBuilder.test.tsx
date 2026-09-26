import userEvent from '@testing-library/user-event';
import type { EmailFilter } from 'api-types';
import { useState } from 'react';
import { renderWithProviders, screen, within } from 'test/utils';
import { describe, expect, it, vi } from 'vitest';

import {
  completeFilter,
  EMPTY_FILTER,
  RecipientFilterBuilder,
  ruleComplete,
  unfinishedRules,
} from '../RecipientFilterBuilder';
import { recipientFields } from './recipientFields';

function setup(initial: EmailFilter = EMPTY_FILTER) {
  const changes = vi.fn<(filter: EmailFilter) => void>();
  function Harness() {
    const [filter, setFilter] = useState(initial);
    return (
      <RecipientFilterBuilder
        value={filter}
        onChange={(next) => {
          changes(next);
          setFilter(next);
        }}
        fields={recipientFields}
        everyone="camper"
      />
    );
  }
  renderWithProviders(<Harness />);
  const last = () => changes.mock.calls.at(-1)?.[0];
  return { user: userEvent.setup(), changes, last };
}

async function pick(user: ReturnType<typeof userEvent.setup>, box: HTMLElement, option: string) {
  await user.click(box);
  await user.click(await screen.findByRole('option', { name: option, hidden: true }));
}

describe('RecipientFilterBuilder', () => {
  it('says everyone is included without conditions', () => {
    setup();
    expect(screen.getByText('No conditions: every camper is included.')).toBeInTheDocument();
  });

  it('adds a condition and starts it with the field type’s first operator', async () => {
    const { user, last } = setup();
    await user.click(screen.getByRole('button', { name: 'Add condition' }));
    const row = screen.getByRole('group', { name: 'Condition 1' });
    await pick(user, within(row).getByRole('textbox', { name: 'Field' }), 'Balance');
    expect(last()).toEqual({
      combinator: 'and',
      rules: [{ field: 'registration.balance', op: 'eq', value: null }],
    });
  });

  it('offers the operators of the field’s type', async () => {
    const { user } = setup({
      combinator: 'and',
      rules: [{ field: 'registration.created_at', op: 'before', value: '2026-01-01' }],
    });
    const box = screen.getByRole('textbox', { name: 'Operator' });
    await user.click(box);
    const listbox = document.getElementById(box.getAttribute('aria-controls')!)!;
    const options = within(listbox)
      .getAllByRole('option', { hidden: true })
      .map((o) => o.textContent);
    expect(options).toEqual(['is before', 'is after', 'is on', 'is set', 'isn’t set']);
  });

  it('takes a number for a number field', async () => {
    const { user, last } = setup({
      combinator: 'and',
      rules: [{ field: 'registration.balance', op: 'gt', value: null }],
    });
    await user.type(screen.getByRole('textbox', { name: 'Value' }), '25');
    expect(last()?.rules?.[0]).toEqual({ field: 'registration.balance', op: 'gt', value: 25 });
  });

  it('takes several choices for “is any of”', async () => {
    const { user, last } = setup({
      combinator: 'and',
      rules: [{ field: 'camper.attributes.meals', op: 'is', value: 'Vegan' }],
    });
    await pick(user, screen.getByRole('textbox', { name: 'Operator' }), 'is any of');
    // A single value doesn't carry over to a several-value operator.
    expect(last()?.rules?.[0]).toMatchObject({ op: 'any_of', value: null });
    await pick(user, screen.getByRole('textbox', { name: 'Value' }), 'Vegetarian');
    expect(last()?.rules?.[0].value).toEqual(['Vegetarian']);
  });

  it('has no value box for “is set” or a true/false field', () => {
    setup({
      combinator: 'and',
      rules: [
        { field: 'camper.lodging.name', op: 'is_set', value: null },
        { field: 'registration.completed', op: 'is_true', value: null },
      ],
    });
    expect(screen.queryByRole('textbox', { name: 'Value' })).not.toBeInTheDocument();
  });

  it('switches between all and any, and removes a condition', async () => {
    const { user, last } = setup({
      combinator: 'and',
      rules: [
        { field: 'camper.lodging.name', op: 'is_set', value: null },
        { field: 'registration.completed', op: 'is_true', value: null },
      ],
    });
    await user.click(screen.getByText('any'));
    expect(last()?.combinator).toBe('or');
    await user.click(screen.getByRole('button', { name: 'Remove condition 1' }));
    expect(last()?.rules).toEqual([
      { field: 'registration.completed', op: 'is_true', value: null },
    ]);
  });

  it('keeps a rule on a field the event no longer has, and says so', () => {
    setup({
      combinator: 'and',
      rules: [{ field: 'camper.attributes.gone', op: 'is', value: 'x' }],
    });
    expect(screen.getByText('This field isn’t in the event')).toBeInTheDocument();
  });
});

describe('filter helpers', () => {
  const filter: EmailFilter = {
    combinator: 'or',
    rules: [
      { field: 'registration.balance', op: 'gt', value: 0 },
      { field: 'registration.balance', op: 'gt', value: null },
      { field: 'registration.completed', op: 'is_true', value: null },
      { field: '', op: 'contains', value: null },
      { field: 'camper.attributes.meals', op: 'any_of', value: [] },
    ],
  };

  it('knows which rules are finished', () => {
    expect(filter.rules!.map((r) => ruleComplete(r, recipientFields))).toEqual([
      true,
      false,
      true,
      false,
      false,
    ]);
    expect(unfinishedRules(filter, recipientFields)).toBe(3);
  });

  it('keeps only the finished rules for a live count', () => {
    expect(completeFilter(filter, recipientFields)).toEqual({
      combinator: 'or',
      rules: [
        { field: 'registration.balance', op: 'gt', value: 0 },
        { field: 'registration.completed', op: 'is_true', value: null },
      ],
    });
  });
});

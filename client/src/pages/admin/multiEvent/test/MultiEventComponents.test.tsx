import userEvent from '@testing-library/user-event';
import { PermissionsProvider } from 'hooks/permissions';
import type { ReactElement } from 'react';
import { renderWithProviders, screen, within } from 'test/utils';
import { describe, expect, it, vi } from 'vitest';

import { EventInclusionList } from '../EventInclusionList';
import { EventStatsTable, retention } from '../EventStatsTable';
import { groupPeople } from '../people';
import { PersonRecord } from '../PersonRecord';
import { SuggestionList } from '../SuggestionList';
import {
  EVENTS,
  EVENTS_BY_ID,
  RECORDS,
  RECORDS_BY_ID,
  STATS_EVENTS,
  SUGGESTIONS,
} from './fixtures';

function asReporter(ui: ReactElement) {
  return renderWithProviders(<PermissionsProvider userRole="reporter">{ui}</PermissionsProvider>);
}

describe('EventInclusionList', () => {
  it('includes or leaves out an event at once', async () => {
    const onChange = vi.fn();
    renderWithProviders(<EventInclusionList events={EVENTS} onChange={onChange} />);
    const user = userEvent.setup();
    expect(screen.getByRole('switch', { name: 'Lark Camp 2025' })).toBeChecked();
    await user.click(screen.getByRole('switch', { name: 'Lark Camp 2022' }));
    expect(onChange).toHaveBeenCalledWith(5, { included: true });
  });

  it('saves a series name once it’s entered', async () => {
    const onChange = vi.fn();
    renderWithProviders(<EventInclusionList events={EVENTS} onChange={onChange} />);
    const user = userEvent.setup();
    const series = screen.getByRole('combobox', { name: 'Series of Lark Camp 2022' });
    await user.type(series, '  Lark   Camp {Enter}');
    await user.tab();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(5, { series: 'Lark Camp' });
  });

  it('lets a series name whose save failed be saved again', async () => {
    const onChange = vi.fn().mockRejectedValueOnce(new Error('refused'));
    renderWithProviders(<EventInclusionList events={EVENTS} onChange={onChange} />);
    const user = userEvent.setup();
    const series = screen.getByRole('combobox', { name: 'Series of Lark Camp 2022' });
    await user.type(series, 'Lark Camp{Enter}');
    await user.type(series, '{Enter}');
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('shows a Reporter the choices without letting them change them', () => {
    asReporter(<EventInclusionList events={EVENTS} onChange={vi.fn()} />);
    expect(screen.getByRole('switch', { name: 'Lark Camp 2025' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Series of Lark Camp 2025' })).toBeDisabled();
  });
});

describe('PersonRecord', () => {
  const ann = groupPeople(RECORDS, EVENTS).find((u) => u.key === 'person:7')!;

  it('lists a person’s records by event, oldest first, and unlinks one', async () => {
    const onUnlink = vi.fn();
    const onOpenCamper = vi.fn();
    renderWithProviders(
      <PersonRecord
        unit={ann}
        events={EVENTS_BY_ID}
        onOpenCamper={onOpenCamper}
        onUnlink={onUnlink}
      />,
    );
    const user = userEvent.setup();
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows.map((row) => within(row).getAllByRole('cell')[1].textContent)).toEqual([
      'Lark Camp 2023',
      'Lark Camp 2024',
      'Lark Camp 2025',
    ]);
    await user.click(screen.getByRole('button', { name: 'Lark Camp 2024' }));
    expect(onOpenCamper).toHaveBeenCalledWith(expect.objectContaining({ camper: 12 }));
    await user.click(within(rows[2]).getByRole('button', { name: 'Unlink' }));
    expect(onUnlink).toHaveBeenCalledWith([expect.objectContaining({ camper: 13 })]);
  });

  it('splits records off together as another person', async () => {
    const onUnlink = vi.fn();
    renderWithProviders(
      <PersonRecord unit={ann} events={EVENTS_BY_ID} onOpenCamper={vi.fn()} onUnlink={onUnlink} />,
    );
    const user = userEvent.setup();
    const split = screen.getByRole('button', { name: 'Split off as another person' });
    expect(split).toBeDisabled();
    await user.click(screen.getByRole('checkbox', { name: 'Choose the Lark Camp 2024 record' }));
    await user.click(screen.getByRole('checkbox', { name: 'Choose the Lark Camp 2025 record' }));
    await user.click(screen.getByRole('button', { name: 'Split off 2 as another person' }));
    expect(onUnlink).toHaveBeenCalledWith([
      expect.objectContaining({ camper: 12 }),
      expect.objectContaining({ camper: 13 }),
    ]);
  });

  it('offers no unlinking to a Reporter', () => {
    asReporter(
      <PersonRecord unit={ann} events={EVENTS_BY_ID} onOpenCamper={vi.fn()} onUnlink={vi.fn()} />,
    );
    expect(screen.queryByRole('button', { name: 'Unlink' })).not.toBeInTheDocument();
  });

  it('points out two records in one event', () => {
    const [twice] = groupPeople([...RECORDS.slice(0, 3), { ...RECORDS[0], camper: 99 }], EVENTS);
    renderWithProviders(<PersonRecord unit={twice} events={EVENTS_BY_ID} onOpenCamper={vi.fn()} />);
    expect(screen.getByText('More than one record in an event')).toBeInTheDocument();
  });
});

describe('SuggestionList', () => {
  function list(ui = renderWithProviders) {
    const onLink = vi.fn();
    const onDismiss = vi.fn();
    ui(
      <SuggestionList
        suggestions={SUGGESTIONS}
        records={RECORDS_BY_ID}
        events={EVENTS_BY_ID}
        onLink={onLink}
        onDismiss={onDismiss}
        onOpenCamper={vi.fn()}
      />,
    );
    return { onLink, onDismiss };
  }

  it('shows each suggestion’s strength, reasons and records', () => {
    list();
    expect(screen.getByText('Strong match')).toBeInTheDocument();
    expect(screen.getByText('A nickname and same last name')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lark Campout 2024' })).toBeInTheDocument();
  });

  it('links a suggestion, or dismisses it', async () => {
    const { onLink, onDismiss } = list();
    const user = userEvent.setup();
    const [first, second] = screen.getAllByRole('button', { name: 'Link as one person' });
    await user.click(first);
    expect(onLink).toHaveBeenCalledWith(SUGGESTIONS[0]);
    expect(second).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Not the same person' })[1]);
    expect(onDismiss).toHaveBeenCalledWith(SUGGESTIONS[1]);
  });

  it('lets a Reporter look but not act', () => {
    list(asReporter);
    expect(screen.queryByRole('button', { name: 'Link as one person' })).not.toBeInTheDocument();
  });
});

describe('EventStatsTable', () => {
  it('shows the events side by side with how many came back', () => {
    renderWithProviders(<EventStatsTable rows={STATS_EVENTS} />);
    expect(screen.getByText('1 of 2 (50%) from Lark Camp 2023')).toBeInTheDocument();
    expect(retention(STATS_EVENTS[0])).toBe('—');
    const nobodyBefore = { event: 1, name: 'Lark Camp 2023', people: 0, returned: 0 };
    expect(retention({ ...STATS_EVENTS[1], previous: nobodyBefore })).toBe('—');
  });
});

import type { ReactNode } from 'react';
import { renderWithProviders, screen } from 'test/utils';
import { describe, expect, it, vi } from 'vitest';

import { EventChooser } from '../EventChooser';

vi.mock('store/entities', () => ({
  eventHooks: {
    // In the API's order: no open date first, then newest open date first (SPEC §8.1)
    useList: () => ({
      data: [
        { id: 9, name: 'Lark Camp 2028', registration_start: null },
        { id: 7, name: 'Lark Camp 2027', registration_start: '2027-02-01T08:00:00Z' },
        { id: 5, name: 'A Workshop 2026', registration_start: '2026-02-01T08:00:00Z' },
      ],
      isLoading: false,
    }),
  },
}));
vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ organizationId: '1' }),
  // `params` isn't an attribute of the link.
  Link: ({
    to,
    params: _params,
    children,
    ...props
  }: {
    to: string;
    params: unknown;
    children: ReactNode;
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

const MULTI_EVENT = 'Multi-event reports';

describe('EventChooser', () => {
  it('lists the organization’s events in the order the API gives them', () => {
    renderWithProviders(<EventChooser />);
    const events = screen.getAllByRole('link').filter((link) => link.textContent !== MULTI_EVENT);
    expect(events.map((link) => link.textContent)).toEqual([
      'Lark Camp 2028',
      'Lark Camp 2027',
      'A Workshop 2026',
    ]);
  });

  it('leads to the organization’s multi-event reports (SPEC §8.12)', () => {
    renderWithProviders(<EventChooser />);
    expect(screen.getByRole('link', { name: MULTI_EVENT })).toHaveAttribute(
      'href',
      '/admin/organization/$organizationId/multi-event/events',
    );
  });
});

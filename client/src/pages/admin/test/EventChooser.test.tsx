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
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

describe('EventChooser', () => {
  it('lists the organization’s events in the order the API gives them', () => {
    renderWithProviders(<EventChooser />);
    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Lark Camp 2028',
      'Lark Camp 2027',
      'A Workshop 2026',
    ]);
  });
});

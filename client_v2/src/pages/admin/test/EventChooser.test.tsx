import type { ReactNode } from 'react';
import { renderWithProviders, screen } from 'test/utils';
import { describe, expect, it, vi } from 'vitest';

import { EventChooser } from '../EventChooser';

vi.mock('store/entities', () => ({
  eventHooks: {
    useList: () => ({ data: [{ id: 7, name: 'Lark Camp 2027' }], isLoading: false }),
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
  it('lists the organization’s events', () => {
    renderWithProviders(<EventChooser />);
    expect(screen.getByText('Lark Camp 2027')).toBeInTheDocument();
  });
});

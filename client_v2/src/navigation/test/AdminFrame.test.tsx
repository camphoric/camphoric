import type { ReactNode } from 'react';
import { renderWithProviders, screen } from 'test/utils';
import { describe, expect, it, vi } from 'vitest';

import { AdminFrame } from '../AdminFrame';

const { match } = vi.hoisted(() => ({ match: { current: undefined as object | undefined } }));

vi.mock('@tanstack/react-router', () => ({
  useMatch: () => match.current,
  Outlet: () => <p>Page</p>,
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('navigation/UserMenu', () => ({ UserMenu: () => <span>User menu</span> }));

const back = () => screen.queryByRole('link', { name: 'Back to organization selection' });

describe('AdminFrame', () => {
  it('puts the way back to organization selection left of the title on the event chooser', () => {
    match.current = { routeId: '/admin/frame/organization/$organizationId/event' };
    renderWithProviders(<AdminFrame />);
    const title = screen.getByRole('heading', { name: 'Camphoric Admin' });
    expect(back()).toHaveAttribute('href', '/admin/organization');
    // The arrow comes first in the header.
    expect(back()!.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('has no back arrow elsewhere', () => {
    match.current = undefined;
    renderWithProviders(<AdminFrame />);
    expect(back()).not.toBeInTheDocument();
    expect(screen.getByText('Page')).toBeInTheDocument();
  });
});

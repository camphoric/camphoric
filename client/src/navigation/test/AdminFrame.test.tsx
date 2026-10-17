import type { ReactNode } from 'react';
import { renderWithProviders, screen } from 'test/utils';
import { describe, expect, it, vi } from 'vitest';

import { AdminFrame } from '../AdminFrame';

interface VersionQuery {
  isPending: boolean;
  data?: { version: string | null };
}

const { match, version } = vi.hoisted(() => {
  const version: { current: VersionQuery } = { current: { isPending: true } };
  return { match: { current: undefined as object | undefined }, version };
});

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
vi.mock('store/version', async (importOriginal) => ({
  ...(await importOriginal<typeof import('store/version')>()),
  useServerVersion: () => version.current,
}));

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

  it("shows the server's version after the title", () => {
    match.current = undefined;
    version.current = { isPending: false, data: { version: '0.12.0' } };
    renderWithProviders(<AdminFrame />);
    const title = screen.getByRole('heading', { name: 'Camphoric Admin' });
    const shown = screen.getByText('v0.12.0');
    expect(title.compareDocumentPosition(shown) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('says the version is unknown when the server is not a release', () => {
    version.current = { isPending: false, data: { version: null } };
    renderWithProviders(<AdminFrame />);
    expect(screen.getByText('unknown version')).toBeInTheDocument();
  });

  it('shows no version while it loads', () => {
    version.current = { isPending: true };
    renderWithProviders(<AdminFrame />);
    expect(screen.queryByText(/version|^v\d/)).not.toBeInTheDocument();
  });
});

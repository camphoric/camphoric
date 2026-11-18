import { PermissionsProvider } from 'hooks/permissions';
import { renderWithProviders, screen } from 'test/utils';
import { describe, expect, it } from 'vitest';

import { DataExportSettings, eventDataExportUrl } from '../DataExportSettings';

describe('DataExportSettings', () => {
  it("lets an Admin download the event's data from the server", () => {
    renderWithProviders(
      <PermissionsProvider userRole="admin">
        <DataExportSettings eventId={7} />
      </PermissionsProvider>,
    );
    const link = screen.getByRole('link', { name: 'Download event data' });
    // Straight from the server, which names the file: nothing passes through the page.
    expect(link).toHaveAttribute('href', '/api/events/7/export/');
    expect(link).toHaveAttribute('download', '');
    expect(screen.getByText(/personal and payment details/)).toBeInTheDocument();
  });

  it.each(['registrar', 'reporter'] as const)('offers a %s no download', (role) => {
    renderWithProviders(
      <PermissionsProvider userRole={role}>
        <DataExportSettings eventId={7} />
      </PermissionsProvider>,
    );
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText("Only an Admin can download the event's data.")).toBeInTheDocument();
  });

  it('asks for the path with its trailing slash', () => {
    expect(eventDataExportUrl('12')).toBe('/api/events/12/export/');
  });
});

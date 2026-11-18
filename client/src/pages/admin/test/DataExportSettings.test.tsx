import { PermissionsProvider } from 'hooks/permissions';
import { renderWithProviders, screen } from 'test/utils';
import { describe, expect, it } from 'vitest';

import { DataExportSettings, eventDataExportUrl } from '../DataExportSettings';

describe('DataExportSettings', () => {
  it.each(['admin', 'registrar'] as const)("lets a %s download the event's data", (role) => {
    renderWithProviders(
      <PermissionsProvider userRole={role}>
        <DataExportSettings eventId={7} />
      </PermissionsProvider>,
    );
    const link = screen.getByRole('link', { name: 'Download event data' });
    // Straight from the server, which names the file: nothing passes through the page.
    expect(link).toHaveAttribute('href', '/api/events/7/export/');
    expect(link).toHaveAttribute('download', '');
    expect(screen.getByText(/personal and payment details/)).toBeInTheDocument();
  });

  it('offers a Reporter no download', () => {
    renderWithProviders(
      <PermissionsProvider userRole="reporter">
        <DataExportSettings eventId={7} />
      </PermissionsProvider>,
    );
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(
      screen.getByText("Only a Registrar or an Admin can download the event's data."),
    ).toBeInTheDocument();
  });

  it('asks for the path with its trailing slash', () => {
    expect(eventDataExportUrl('12')).toBe('/api/events/12/export/');
  });
});

/**
 * Downloading all of the event's data as one JSON file, for analysis with
 * one's own scripts (SPEC §8.8; §15, DR-169). Registrars and Admins only: the
 * file holds everyone's personal and payment details. It holds nothing about
 * users (who created what) and no change history. The server builds the file and
 * streams it straight to a download, with its name
 * (`<event name> data <YYYY-MM-DD>.json`), so none of it passes through the
 * page, and it records the download in the change history.
 */

import { Alert, Button, Stack, Text } from '@mantine/core';
import { IconDownload } from '@tabler/icons-react';
import { usePermissions } from 'hooks/permissions';

/** Where the event's data is downloaded from (the API requires the trailing slash). */
export function eventDataExportUrl(eventId: number | string): string {
  return `/api/events/${eventId}/export/`;
}

export function DataExportSettings({ eventId }: { eventId: number | string }) {
  const { canExportEventData } = usePermissions();

  if (!canExportEventData) {
    return <Text c="dimmed">Only a Registrar or an Admin can download the event&apos;s data.</Text>;
  }

  return (
    <Stack align="flex-start" maw={640}>
      <Text>
        Download all of this event&apos;s data as one JSON file, to analyse with your own scripts:
        its settings, registrations, campers, invoices, payments and email, each record with its id
        and the ids of the records it&apos;s linked to. Passwords, and the codes that open
        someone&apos;s invoice, invitation or registration or unsubscribe them, are left out. It
        can&apos;t be imported back.
      </Text>
      <Alert color="yellow" variant="light" title="Personal data">
        The file holds everyone&apos;s personal and payment details. Keep it somewhere safe, and
        delete it when you&apos;re done. Each download is recorded in your change history.
      </Alert>
      <Button
        component="a"
        href={eventDataExportUrl(eventId)}
        download
        leftSection={<IconDownload size={16} />}
      >
        Download event data
      </Button>
    </Stack>
  );
}

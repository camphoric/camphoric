/**
 * Stories for the event data download in Settings (SPEC §8.8; §15, DR-169): a
 * Registrar's, with the download (an Admin's is the same), and a Reporter's,
 * without it. Run `npm run storybook`.
 */

import type { Meta, StoryFn } from '@storybook/react-vite';
import type { Role } from 'api-types';
import { PermissionsProvider } from 'hooks/permissions';

import { DataExportSettings } from '../DataExportSettings';

function AsRole({ userRole }: { userRole: Role }) {
  return (
    <PermissionsProvider userRole={userRole}>
      <DataExportSettings eventId={1} />
    </PermissionsProvider>
  );
}

export default { title: 'Data Export Settings' } satisfies Meta;

export const AsRegistrar: StoryFn = () => <AsRole userRole="registrar" />;
export const AsReporter: StoryFn = () => <AsRole userRole="reporter" />;

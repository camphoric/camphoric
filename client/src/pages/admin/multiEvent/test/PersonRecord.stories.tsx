/**
 * Stories for one person's record across the included events (SPEC §8.12): a
 * linked person, a record linked to no one, a person with two records in one
 * event, and a Reporter's view. Run `npm run storybook`.
 */

import { Paper } from '@mantine/core';
import type { Meta, StoryFn } from '@storybook/react-vite';
import type { Role } from 'api-types';
import { PermissionsProvider } from 'hooks/permissions';
import { useState } from 'react';

import { groupPeople, type PersonUnit } from '../people';
import { PersonRecord } from '../PersonRecord';
import { EVENTS, EVENTS_BY_ID, RECORDS } from './fixtures';

const UNITS = new Map(groupPeople(RECORDS, EVENTS).map((u) => [u.key, u]));

function Frame({ unit, userRole = 'registrar' }: { unit: PersonUnit; userRole?: Role }) {
  const [last, setLast] = useState('');
  return (
    <PermissionsProvider userRole={userRole}>
      <Paper withBorder p="md" m="md" maw={820}>
        <PersonRecord
          unit={unit}
          events={EVENTS_BY_ID}
          onOpenCamper={(r) => setLast(`Open camper ${r.camper} in event ${r.event}`)}
          onUnlink={(rs) => setLast(`Unlink campers ${rs.map((r) => r.camper).join(', ')}`)}
        />
        {last && <p data-testid="last">{last}</p>}
      </Paper>
    </PermissionsProvider>
  );
}

export default { title: 'Person Record' } satisfies Meta;

export const Linked: StoryFn = () => <Frame unit={UNITS.get('person:7')!} />;
export const NotLinked: StoryFn = () => <Frame unit={UNITS.get('camper:31')!} />;
export const TwoInOneEvent: StoryFn = () => (
  <Frame unit={groupPeople([...RECORDS.slice(0, 3), { ...RECORDS[0], camper: 99 }], EVENTS)[0]} />
);
export const Reporter: StoryFn = () => <Frame unit={UNITS.get('person:7')!} userRole="reporter" />;

/**
 * Choose the days a camper is present (SPEC §8.5, §8.6): a checkbox for each
 * day of the event but the last, which is departure day — no one stays over
 * (§15, DR-65). The chosen days come back in day order, whatever order they
 * were ticked in.
 */

import { Checkbox, Stack, Text } from '@mantine/core';
import type { ReactNode } from 'react';

import { dayLabel, stayableDays } from './timelineUtils';

interface StayCheckboxesProps {
  /** Every day of the event, in order. */
  days: string[];
  /** The days chosen. */
  value: string[];
  onChange: (stay: string[]) => void;
  description?: ReactNode;
}

export function StayCheckboxes({ days, value, onChange, description }: StayCheckboxesProps) {
  const stayDays = stayableDays(days);
  const departureDay = days.length > 1 ? days[days.length - 1] : undefined;
  return (
    <div>
      <Checkbox.Group
        label="Days present"
        description={description}
        value={value}
        onChange={(chosen) => onChange(stayDays.filter((day) => chosen.includes(day)))}
      >
        <Stack gap={4} mt={4}>
          {stayDays.map((day) => (
            <Checkbox key={day} value={day} label={dayLabel(day)} />
          ))}
        </Stack>
      </Checkbox.Group>
      {departureDay && (
        <Text size="xs" c="dimmed" mt={4}>
          {dayLabel(departureDay)} is departure day; no one stays over.
        </Text>
      )}
    </div>
  );
}

/**
 * Choose an IANA time zone (e.g. `America/Los_Angeles`), such as an event's
 * (SPEC §8.3; §15, DR-97). Lists the zones the browser knows, searchable, each
 * with its everyday name.
 */

import { Select, type SelectProps } from '@mantine/core';
import { useMemo } from 'react';
import { timeZoneName } from 'utils/dates';

interface TimeZoneSelectProps extends Omit<SelectProps, 'data' | 'value' | 'onChange'> {
  value: string;
  onChange: (zone: string) => void;
}

export function TimeZoneSelect({ value, onChange, ...rest }: TimeZoneSelectProps) {
  const data = useMemo(() => {
    // The current zone stays choosable even if this browser doesn't list it.
    const zones = new Set([...Intl.supportedValuesOf('timeZone'), value]);
    return [...zones].sort().map((zone) => ({ value: zone, label: zoneLabel(zone) }));
  }, [value]);

  return (
    <Select
      searchable
      {...rest}
      data={data}
      value={value}
      allowDeselect={false}
      onChange={(zone) => {
        if (zone) onChange(zone);
      }}
    />
  );
}

/** "America/Los_Angeles (Pacific Time)", or just the id when it has no other name. */
function zoneLabel(zone: string): string {
  const name = timeZoneName(zone);
  return name === zone ? zone : `${zone} (${name})`;
}

/**
 * A date-and-time picker for an instant that belongs to a place, such as when an
 * event's registration closes (SPEC §8.3; §15, DR-97). The admin picks and reads
 * the clock time in `timeZone`, whatever zone their browser is in, and the zone
 * is named beside the picker. The value is an ISO instant: what the picker gives
 * is turned into one in `timeZone` (Mantine's own value has no offset, and the
 * server won't guess one), and clearing it gives `null`.
 */

import { DateTimePicker, type DateTimePickerProps } from '@mantine/dates';
import { isoToLocalDateTime, localDateTimeToIso, timeZoneName } from 'utils/dates';

interface ZonedDateTimePickerProps extends Omit<
  DateTimePickerProps,
  'value' | 'defaultValue' | 'onChange'
> {
  /** An ISO instant (with an offset or `Z`), or null for none. */
  value: string | null;
  /** The IANA zone the clock time is in, e.g. `America/Los_Angeles`. */
  timeZone: string;
  onChange: (value: string | null) => void;
}

export function ZonedDateTimePicker({
  value,
  timeZone,
  onChange,
  description,
  ...rest
}: ZonedDateTimePickerProps) {
  return (
    <DateTimePicker
      valueFormat="MM/DD/YYYY h:mm A"
      clearable
      {...rest}
      description={description ?? timeZoneName(timeZone)}
      value={value ? isoToLocalDateTime(value, timeZone) : null}
      onChange={(picked) => onChange(picked ? localDateTimeToIso(picked, timeZone) : null)}
    />
  );
}

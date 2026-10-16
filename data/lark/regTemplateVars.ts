import type { DurationLike } from 'luxon';
import { dates, lengthInDays } from './dates.ts';

const dt = (add: DurationLike) => {
  const d = dates.start.plus(add);

  // 'Sat Aug 5th',
  return d.toFormat('EEE MMM d');
};

const regTemplateVars = {
  first_half_camp_start_date_time: `${dt({days: 1})} at 3pm`,
  first_half_camp_end_date_time:   `${dt({days: 5})} at noon`,
  second_half_camp_start_date_time: `${dt({days: 5})} at noon`,
  second_half_camp_end_date_time: `${dt({days: lengthInDays})} at 9am`,

  full_camp_start_date_time: `${dt({days: 1})} at 3pm`,
  full_camp_end_date_time: `${dt({days: lengthInDays})} at 9am`,

	meals_due_date: 'June 20th',
};

export default regTemplateVars;

import moment from 'moment';
import { dates, lengthInDays } from './dates.js';

const dt = (add) => {
  const d = moment(dates.start);
  d.add(add);

  // 'Sat Aug 5th',
  return d.format('ddd MMM Do');
};

const regTemplateVars = {
  first_half_camp_start_date_time: `${dt({days: 1})} at 3pm`,
  first_half_camp_end_date_time:   `${dt({days: 5})} at noon`,
  second_half_camp_start_date_time: `${dt({days: 5})} at 2pm`,
  second_half_camp_end_date_time: `${dt({days: lengthInDays})} at 9am`,

  full_camp_start_date_time: `${dt({days: 1})} at 3pm`,
  full_camp_end_date_time: `${dt({days: lengthInDays})} at 9am`,
};

export default regTemplateVars;

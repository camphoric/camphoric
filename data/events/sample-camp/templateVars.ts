import { dates } from './dates.ts';

export const campDates = `${dates.start.toFormat('EEEE, MMMM d')} to ${dates.end.toFormat('EEEE, MMMM d')}`;
export const balanceDueDate = dates.start.minus({ days: 30 }).toFormat('MMMM d');

// Values the form's Handlebars text can use: descriptions, the pre-submit
// text and the validation messages
export default {
  camp_dates: campDates,
  balance_due_date: balanceDueDate,
};

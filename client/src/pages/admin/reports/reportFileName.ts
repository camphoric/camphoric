/**
 * The file name a downloaded report is saved as (SPEC §8.7):
 * `<event name>, <category>, <report title>.<format>`. A blank part (an
 * uncategorised report) is left out rather than leaving an empty segment, and
 * characters that common systems don't allow in file names are replaced.
 */

// `/ \ : * ? " < > |` and control characters.
// eslint-disable-next-line no-control-regex
const UNSAFE = /[/\\:*?"<>|\u0000-\u001f\u007f-\u009f]/g;

function safePart(text: string | undefined): string {
  return (text ?? '').replace(UNSAFE, '-').replace(/\s+/g, ' ').trim();
}

export function reportFileName(
  eventName: string | undefined,
  category: string | undefined,
  title: string,
  format: string,
): string {
  const name = [eventName, category, title].map(safePart).filter(Boolean).join(', ');
  return `${name || 'report'}.${format}`;
}

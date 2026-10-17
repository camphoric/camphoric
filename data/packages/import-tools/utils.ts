export function formatDate(arg: string | Date | undefined): string | undefined {
  let date: Date | undefined;
  if (typeof arg === 'string') {
    date = new Date(Date.parse(arg));
  } else if (arg instanceof Date) {
    date = arg;
  }

  if (!date) return undefined;

  const year = date.getFullYear();
  const month = (1 + date.getMonth()).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');

  if ([year, month, day].includes(NaN)) {
    return undefined;
  }

  return [year, month, day].join('-');
}

/**
 * An instant (a Date, or an ISO string with an offset) as an ISO timestamp in
 * UTC. The server refuses one without an offset rather than guess its zone.
 */
export function formatDateTime(arg: string | Date | undefined): string | undefined {
  const date = arg instanceof Date ? arg : new Date(Date.parse(arg ?? ''));
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

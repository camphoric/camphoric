/**
 * The command line and the steps of replace-live-reports.ts, which copies one
 * event's reports over another's on a live server.
 */

import type { FetchMethod } from '@camphoric/camphoric-event-import-tools/fetcher';

// A report, as the reports API lists it
export interface LiveReport {
  id: number;
  event: number;
  title: string;
  output: string;
  template: string;
  variables_schema: unknown;
  variables_source: string;
}

export interface ReplaceOptions {
  fromEventId: string;
  toEventId: string;
  // Without it, the script only says what it would do (a dry run)
  yes: boolean;
}

/** What a replacement does: the reports it copies, and those it then deletes. */
export interface ReplacementPlan {
  toCopy: LiveReport[];
  toDelete: LiveReport[];
}

// The part of CamphoricFetcher a replacement uses
export interface ReportFetcher {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fetch(method: FetchMethod, path: string, data?: unknown): Promise<any>;
}

const USAGE = 'usage: ./replace-live-reports.ts <fromEventId> <toEventId> [--yes]';

export function replaceOptions(args: string[]): ReplaceOptions {
  const unknown = args.filter(arg => arg.startsWith('-') && arg !== '--yes');
  if (unknown.length) {
    throw new Error(`unknown option ${unknown.join(' ')}; ${USAGE}`);
  }

  const eventIds = args.filter(arg => !arg.startsWith('-'));
  if (eventIds.length !== 2 || !eventIds.every(id => /^[1-9]\d*$/.test(id))) {
    throw new Error(`give the two event IDs; ${USAGE}`);
  }

  const [fromEventId, toEventId] = eventIds;
  if (fromEventId === toEventId) {
    throw new Error('the two event IDs are the same');
  }

  return { fromEventId, toEventId, yes: args.includes('--yes') };
}

/** The server to work on, which must be named: it's usually production. */
export function camphoricUrl(env: NodeJS.ProcessEnv = process.env): string {
  const url = env.CAMPHORIC_URL;
  if (!url) {
    throw new Error('set CAMPHORIC_URL to the server whose reports to replace');
  }

  return url;
}

export function planReplacement(
  reports: LiveReport[],
  { fromEventId, toEventId }: Pick<ReplaceOptions, 'fromEventId' | 'toEventId'>,
): ReplacementPlan {
  const toCopy = reports.filter(r => r.event.toString() === fromEventId);
  // With nothing to copy (a mistyped event ID, say), a replacement would only
  // delete the target's reports.
  if (!toCopy.length) {
    throw new Error(`event ${fromEventId} has no reports to copy`);
  }

  return {
    toCopy,
    toDelete: reports.filter(r => r.event.toString() === toEventId),
  };
}

export function describePlan(plan: ReplacementPlan, { fromEventId, toEventId }: ReplaceOptions): string[] {
  return [
    `copy ${plan.toCopy.length} report(s) from event ${fromEventId} to event ${toEventId}:`,
    ...plan.toCopy.map(r => `  ${r.id}: '${r.title}'`),
    `then delete event ${toEventId}'s ${plan.toDelete.length} existing report(s):`,
    ...plan.toDelete.map(r => `  ${r.id}: '${r.title}'`),
  ];
}

const reportNames = (reports: { id: number, title: string }[]): string => reports
  .map(r => `${r.id} '${r.title}'`)
  .join(', ');

/**
 * Copy the reports to the target event, and only once every copy is saved,
 * delete the target's old reports, so a failed copy never leaves the event
 * without them. Throws, naming what was and wasn't done, on any failure.
 */
export async function replaceReports(
  fetcher: ReportFetcher,
  plan: ReplacementPlan,
  toEventId: string,
  log: (message: string) => void = console.log,
): Promise<void> {
  const created: { id: number, title: string }[] = [];

  for (const report of plan.toCopy) {
    const {
      title,
      output,
      template,
      variables_schema,
      variables_source,
    } = report;

    try {
      const saved = await fetcher.fetch('POST', '/api/reports/', {
        title,
        output,
        template,
        variables_schema,
        // Without it, a copied legacy report would default to server variables.
        variables_source,
        event: toEventId,
      });
      created.push({ id: saved.id, title });
      log(`copied ${report.id} '${title}' to ${saved.id}`);
    } catch (e) {
      throw new Error(
        `failed to copy report ${report.id} '${title}', so nothing was deleted. `
        + (created.length
          ? `Delete the copies already made to clean up: ${reportNames(created)}`
          : 'No copies were made.'),
        { cause: e },
      );
    }
  }

  // Keep going past a failed delete: each old report deleted is one fewer to
  // clean up by hand.
  const notDeleted: { report: LiveReport, error: unknown }[] = [];
  for (const report of plan.toDelete) {
    try {
      await fetcher.fetch('DELETE', `/api/reports/${report.id}/`);
      log(`deleted ${report.id} '${report.title}'`);
    } catch (error) {
      notDeleted.push({ report, error });
    }
  }

  if (notDeleted.length) {
    throw new AggregateError(
      notDeleted.map(({ error }) => error),
      'copied every report, but failed to delete the old reports '
      + `${reportNames(notDeleted.map(({ report }) => report))}: delete them by hand`,
    );
  }
}

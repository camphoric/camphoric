/**
 * replace-live-reports.ts copies one event's reports over another's on a live
 * server: it does nothing without --yes, and copies before it deletes, so a
 * failed copy never leaves the event without its reports.
 */

import { describe, expect, test } from '@jest/globals';

import {
  camphoricUrl, describePlan, planReplacement, replaceOptions, replaceReports,
  type LiveReport, type ReportFetcher,
} from '../../replaceLiveReports.ts';

const report = (id: number, event: number, title: string): LiveReport => ({
  id,
  event,
  title,
  output: 'csv',
  template: `{{ ${title} }}`,
  variables_schema: {},
  variables_source: 'client',
});

const oldCamp = [report(1, 7, 'Roster'), report(2, 7, 'Rooms')];
const newCamp = [report(3, 8, 'Old roster')];
const options = { fromEventId: '7', toEventId: '8', yes: true };

// A stand-in for the server: records each request, failing those `failOn` names
function serverFailing(failOn: (method: string, path: string, data?: unknown) => boolean = () => false) {
  const requests: string[] = [];
  let nextId = 100;
  const fetcher: ReportFetcher = {
    async fetch(method, path, data) {
      const title = (data as { title?: string } | undefined)?.title;
      requests.push(title ? `${method} ${path} ${title}` : `${method} ${path}`);
      if (failOn(method, path, data)) throw new Error('server responded 400');
      return method === 'POST' ? { id: nextId++ } : undefined;
    },
  };
  return { fetcher, requests };
}

const quiet = () => {};

describe('replaceOptions', () => {
  test('takes the two event IDs, and is a dry run without --yes', () => {
    expect(replaceOptions(['7', '8'])).toEqual({ fromEventId: '7', toEventId: '8', yes: false });
  });

  test('takes --yes anywhere', () => {
    expect(replaceOptions(['--yes', '7', '8'])).toEqual(options);
  });

  test.each([
    [[]],
    [['7']],
    [['7', '8', '9']],
    [['7', 'harmony']],
  ])('refuses %j: it needs exactly two event IDs', (args) => {
    expect(() => replaceOptions(args)).toThrow('give the two event IDs');
  });

  test('refuses the same event twice', () => {
    expect(() => replaceOptions(['7', '7', '--yes'])).toThrow('the same');
  });

  test('refuses an option it doesn\'t know', () => {
    expect(() => replaceOptions(['7', '8', '--yse'])).toThrow('unknown option --yse');
  });
});

describe('camphoricUrl', () => {
  test('is CAMPHORIC_URL', () => {
    expect(camphoricUrl({ CAMPHORIC_URL: 'https://camp.example' })).toBe('https://camp.example');
  });

  // Not the importer's local default: this script is for a live server
  test('must be set', () => {
    expect(() => camphoricUrl({})).toThrow('set CAMPHORIC_URL');
  });
});

describe('planReplacement', () => {
  test('copies the source event\'s reports and deletes the target\'s', () => {
    const plan = planReplacement([...oldCamp, ...newCamp, report(4, 9, 'Other')], options);

    expect(plan.toCopy.map(r => r.id)).toEqual([1, 2]);
    expect(plan.toDelete.map(r => r.id)).toEqual([3]);
    expect(describePlan(plan, options)).toEqual([
      'copy 2 report(s) from event 7 to event 8:',
      '  1: \'Roster\'',
      '  2: \'Rooms\'',
      'then delete event 8\'s 1 existing report(s):',
      '  3: \'Old roster\'',
    ]);
  });

  // It would only delete the target's reports
  test('refuses a source event with no reports', () => {
    expect(() => planReplacement(newCamp, options)).toThrow('event 7 has no reports to copy');
  });
});

describe('replaceReports', () => {
  const plan = planReplacement([...oldCamp, ...newCamp], options);

  test('copies every report to the target event before deleting the old ones', async () => {
    const { fetcher, requests } = serverFailing();

    await replaceReports(fetcher, plan, '8', quiet);

    expect(requests).toEqual([
      'POST /api/reports/ Roster',
      'POST /api/reports/ Rooms',
      'DELETE /api/reports/3/',
    ]);
  });

  test('copies every field the report needs, to the target event', async () => {
    const posted: unknown[] = [];
    const fetcher: ReportFetcher = {
      async fetch(method, path, data) {
        if (method === 'POST') posted.push(data);
        return { id: 100 };
      },
    };

    await replaceReports(fetcher, { toCopy: [oldCamp[0]], toDelete: [] }, '8', quiet);

    expect(posted).toEqual([{
      title: 'Roster',
      output: 'csv',
      template: '{{ Roster }}',
      variables_schema: {},
      variables_source: 'client',
      event: '8',
    }]);
  });

  test('deletes nothing when a copy fails, and names the copies to clean up', async () => {
    const { fetcher, requests } = serverFailing(
      (method, path, data) => method === 'POST' && (data as { title: string }).title === 'Rooms',
    );

    const replacing = replaceReports(fetcher, plan, '8', quiet);

    await expect(replacing).rejects.toThrow(
      'failed to copy report 2 \'Rooms\', so nothing was deleted. '
      + 'Delete the copies already made to clean up: 100 \'Roster\'',
    );
    // and keeps the server's error
    await expect(replacing).rejects.toHaveProperty('cause.message', 'server responded 400');
    expect(requests.filter(r => r.startsWith('DELETE'))).toEqual([]);
  });

  test('says when no copy was made', async () => {
    const { fetcher } = serverFailing(method => method === 'POST');

    await expect(replaceReports(fetcher, plan, '8', quiet)).rejects.toThrow('No copies were made.');
  });

  test('deletes what it can, then fails naming the old reports left', async () => {
    const twoOld = { toCopy: [oldCamp[0]], toDelete: [report(3, 8, 'Old roster'), report(5, 8, 'Old rooms')] };
    const { fetcher, requests } = serverFailing((method, path) => path === '/api/reports/3/');

    await expect(replaceReports(fetcher, twoOld, '8', quiet)).rejects.toThrow(
      'failed to delete the old reports 3 \'Old roster\': delete them by hand',
    );
    expect(requests).toContain('DELETE /api/reports/5/');
  });
});

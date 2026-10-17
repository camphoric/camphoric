/**
 * requestBatch: requests started ahead of the Promise.all that collects them.
 */

import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@jest/globals';

import { requestBatch } from '../CamphoricEventCreator.ts';

const pause = () => new Promise(resolve => setTimeout(resolve, 20));

test('a request failing during a pause stops the batch, and fails Promise.all', async () => {
  const requests = requestBatch();
  const started = [requests.start(Promise.reject(new Error('rejected (409)')))];
  await pause();

  expect(requests.failed).toBe(true);
  await expect(Promise.all(started)).rejects.toThrow('rejected (409)');
});

test('requests that succeed leave the batch going', async () => {
  const requests = requestBatch();
  const started = [requests.start(Promise.resolve(1)), requests.start(Promise.resolve(2))];
  await pause();

  expect(requests.failed).toBe(false);
  await expect(Promise.all(started)).resolves.toEqual([1, 2]);
});

// Node ends the process on an unhandled rejection, which Jest would hide, so
// this runs in a process of its own: a request that fails during a pause,
// started through the batch (or, to show the check bites, not).
function failDuringPause(throughTheBatch: boolean) {
  const tsx = createRequire(import.meta.url).resolve('tsx/cli');
  const creator = fileURLToPath(new URL('../CamphoricEventCreator.ts', import.meta.url));
  const script = `
    import { requestBatch } from ${JSON.stringify(creator)};
    (async () => {
      const requests = requestBatch();
      const request = Promise.reject(new Error('rejected (409)'));
      const started = [${throughTheBatch ? 'requests.start(request)' : 'request'}];
      await new Promise(resolve => setTimeout(resolve, 20));
      await Promise.all(started).catch(() => console.log('handled'));
    })();`;
  return spawnSync(process.execPath, [tsx, '--conditions=camphoric-source', '-e', script], { encoding: 'utf8' });
}

test('a request failing during a pause is handled, not an unhandled rejection', () => {
  expect(failDuringPause(true)).toMatchObject({ status: 0, stdout: 'handled\n' });
  expect(failDuringPause(false)).toMatchObject({ status: 1, stdout: '' });
});

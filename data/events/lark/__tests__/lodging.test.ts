import { beforeAll, describe, expect, test } from '@jest/globals';
import type { Lodgings } from 'camphoric-event-import-spec';

import lark from '../index.ts';

// Lark's Camp 2 cabin list is generated: the two-bed cabins take two campers
// and the numbers that don't exist are skipped.
describe('lodging', () => {
  let lodgings: Lodgings;

  beforeAll(() => {
    lodgings = lark.data.lodgings!;
  });

  test.each(['03', '08', '11', '13', '19', '24', '26', '31'])('Camp 2 cabin %s has two beds', (n) => {
    expect(lodgings[`camp2_cabin_${n}`]?.capacity).toBe(2);
  });

  test('other Camp 2 cabins have four beds', () => {
    expect(lodgings.camp2_cabin_01?.capacity).toBe(4);
  });

  test.each(['32', '33'])('Camp 2 cabin %s is not created', (n) => {
    expect(lodgings[`camp2_cabin_${n}`]).toBeUndefined();
  });
});

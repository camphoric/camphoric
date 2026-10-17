import { describe } from '@jest/globals';
import { describeEventModule } from 'camphoric-event-import-spec/conformance';

describe('camphoric-event-familyweek', () => {
  describeEventModule(() => import('../index.ts'));
});

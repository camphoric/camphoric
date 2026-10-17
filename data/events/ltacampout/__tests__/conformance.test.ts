import { describe } from '@jest/globals';
import { describeEventModule } from 'camphoric-event-import-spec/conformance';

describe('camphoric-event-ltacampout', () => {
  describeEventModule(() => import('../index.ts'));
});

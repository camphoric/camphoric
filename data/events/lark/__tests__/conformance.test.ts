import { describe } from '@jest/globals';
import { describeEventModule } from 'camphoric-event-import-spec/conformance';

describe('camphoric-event-lark', () => {
  describeEventModule(() => import('../index.ts'));
});

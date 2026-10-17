import { describe } from '@jest/globals';
import { describeEventModule } from '@camphoric/camphoric-event-import-spec/conformance';

describe('@camphoric/camphoric-event-harmony', () => {
  describeEventModule(() => import('../index.ts'));
});

import { describe } from '@jest/globals';
import { describeEventModule } from '@camphoric/camphoric-event-import-spec/conformance';

describe('@camphoric/camphoric-event-ltacampout', () => {
  describeEventModule(() => import('../index.ts'));
});

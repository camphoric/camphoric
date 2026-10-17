import { describe } from '@jest/globals';
import { describeEventModule } from '@camphoric/camphoric-event-import-spec/conformance';

describe('@camphoric/camphoric-event-lark', () => {
  describeEventModule(() => import('../index.ts'));
});

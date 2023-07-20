import { describe, it, expect } from 'vitest'
import * as utils from './utils';

describe('JsonSchemaForm utils', () => {
  describe('adminUISchemea', () => {
    const sampleUISchema = {
      meals: {
        meal_plan: {
          'ui:placeholder': 'Choose an option',
          'ui:enumDisabled': [
            'All Meals',
            'Just Dinners',
            'All Meals - 1st half',
            'All Meals - 2nd half'
          ],
        },
      },
    };
    it('should remove all enumDisabled keys', () => {
      const result = utils.adminUISchemea(sampleUISchema);
      expect(result).toMatchSnapshot();
    });
  });
});

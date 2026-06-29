import { renderWithProviders, screen } from 'test/utils';
import { describe, expect, it, vi } from 'vitest';

import { KeyValueEdit } from './KeyValueEdit';

describe('KeyValueEdit', () => {
  it('renders existing key/value pairs', () => {
    renderWithProviders(<KeyValueEdit value={{ adult: 100 }} valueType="integer" onChange={vi.fn()} />);
    // rjsf renders the property key as an editable text input.
    expect(screen.getByDisplayValue('adult')).toBeInTheDocument();
    expect(screen.getByDisplayValue('100')).toBeInTheDocument();
  });
});

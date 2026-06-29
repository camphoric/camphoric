import { MantineProvider } from '@mantine/core';
import type { RJSFSchema, UiSchema } from '@rjsf/utils';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { JsonSchemaForm } from 'components/form';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

// No VITE_GOOGLE_MAPS_API_KEY in tests -> the plain-input fallback is exercised.
function renderForm(node: ReactNode) {
  return render(<MantineProvider>{node}</MantineProvider>);
}

const schema: RJSFSchema = {
  type: 'object',
  properties: {
    address: {
      type: 'object',
      title: 'Mailing address',
      properties: {
        street_address: { type: 'string', title: 'Street' },
        city: { type: 'string', title: 'City' },
        state_or_province: { type: 'string', title: 'State' },
        zip_code: { type: 'string', title: 'ZIP' },
        country: {
          type: 'string',
          title: 'Country',
          enum: ['United States', 'Canada'],
          default: 'United States',
        },
      },
    },
  },
};
const uiSchema: UiSchema = { address: { 'ui:field': 'Address' } };

describe('Address field (plain inputs)', () => {
  it('renders the composite sub-fields and country select', () => {
    renderForm(<JsonSchemaForm schema={schema} uiSchema={uiSchema} />);
    expect(screen.getByLabelText('Street')).toBeInTheDocument();
    expect(screen.getByLabelText('City')).toBeInTheDocument();
    expect(screen.getByLabelText('State')).toBeInTheDocument();
    expect(screen.getByLabelText('ZIP')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Country' })).toBeInTheDocument();
  });

  it('writes edits to the scoped address object', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderForm(<JsonSchemaForm schema={schema} uiSchema={uiSchema} onChange={onChange} />);

    await user.type(screen.getByLabelText('City'), 'Boston');

    const last = onChange.mock.calls.at(-1)?.[0] as { address?: { city?: string } };
    expect(last.address?.city).toBe('Boston');
  });

  it('records the selected country', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderForm(<JsonSchemaForm schema={schema} uiSchema={uiSchema} onChange={onChange} />);

    await user.click(screen.getByRole('textbox', { name: 'Country' }));
    await user.click(screen.getByText('Canada'));

    const last = onChange.mock.calls.at(-1)?.[0] as { address?: { country?: string } };
    expect(last.address?.country).toBe('Canada');
  });
});

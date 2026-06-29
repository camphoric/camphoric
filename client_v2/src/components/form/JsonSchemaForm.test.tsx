import { MantineProvider } from '@mantine/core';
import type { RJSFSchema } from '@rjsf/utils';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { JsonSchemaForm } from './JsonSchemaForm';

function renderInProvider(ui: ReactNode) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

describe('JsonSchemaForm', () => {
  it('renders a data-driven field from the schema', () => {
    const schema: RJSFSchema = {
      type: 'object',
      properties: { name: { type: 'string', title: 'Full name' } },
    };
    renderInProvider(<JsonSchemaForm schema={schema} />);
    expect(screen.getByLabelText('Full name')).toBeInTheDocument();
  });

  it('renders a description as templated markdown against templateData', () => {
    const schema: RJSFSchema = {
      type: 'object',
      description: 'Hello {{who}}',
      properties: { name: { type: 'string', title: 'Name' } },
    };
    renderInProvider(<JsonSchemaForm schema={schema} templateData={{ who: 'World' }} />);
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('reports validation errors on submit instead of submitting', async () => {
    const user = userEvent.setup();
    const onError = vi.fn();
    const onSubmit = vi.fn();
    const schema: RJSFSchema = {
      type: 'object',
      properties: { name: { type: 'string', title: 'Name', minLength: 5 } },
    };
    renderInProvider(<JsonSchemaForm schema={schema} onError={onError} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText('Name'), 'ab');
    await user.click(screen.getByRole('button'));

    expect(onError).toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('forwards form data changes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const schema: RJSFSchema = {
      type: 'object',
      properties: { name: { type: 'string', title: 'Full name' } },
    };
    renderInProvider(<JsonSchemaForm schema={schema} onChange={onChange} />);

    await user.type(screen.getByLabelText('Full name'), 'A');

    expect(onChange).toHaveBeenCalled();
  });
});

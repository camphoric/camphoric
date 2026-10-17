import { Button, MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FormActions } from '../FormActions';

function view(dirty?: boolean) {
  render(
    <MantineProvider>
      <FormActions dirty={dirty}>
        <Button>Save</Button>
      </FormActions>
    </MantineProvider>,
  );
}

describe('FormActions', () => {
  it('holds the form’s actions', () => {
    view();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument();
  });

  it('says when the form has unsaved changes', () => {
    view(true);
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
  });
});

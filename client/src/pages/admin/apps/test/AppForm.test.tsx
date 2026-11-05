import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen } from 'test/utils';
import { ApiError } from 'utils/fetch';
import { describe, expect, it, vi } from 'vitest';

import { AppForm, redirectUris } from '../AppForm';
import { sampleApp } from './appFixtures';

describe('redirectUris', () => {
  it('takes one per line, trimmed, leaving out blank lines', () => {
    expect(redirectUris(' https://a.example/cb \n\n https://b.example/cb\n')).toEqual([
      'https://a.example/cb',
      'https://b.example/cb',
    ]);
  });
});

describe('AppForm', () => {
  it('registers an app with its name and redirect URIs', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderWithProviders(<AppForm onSubmit={onSubmit} onCancel={vi.fn()} />);
    const register = screen.getByRole('button', { name: 'Register app' });
    expect(register).toBeDisabled();
    await user.type(screen.getByRole('textbox', { name: /Name/ }), ' Sync ');
    await user.type(
      screen.getByRole('textbox', { name: /Redirect URIs/ }),
      'https://sync.example.org/cb{Enter}https://sync.example.org/other',
    );
    await user.click(register);
    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Sync',
      redirect_uris: ['https://sync.example.org/cb', 'https://sync.example.org/other'],
    });
  });

  it('starts from the app being edited, and shows the server’s refusal under its field', () => {
    renderWithProviders(
      <AppForm
        app={sampleApp()}
        error={new ApiError(400, 'Bad Request', { redirect_uris: ['Not allowed.'] })}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByRole('textbox', { name: /Name/ })).toHaveValue('Lark admin tool');
    expect(screen.getByRole('textbox', { name: /Redirect URIs/ })).toHaveValue(
      'https://admin.larkcamp.org/oauth/callback',
    );
    expect(screen.getByText('Not allowed.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });
});

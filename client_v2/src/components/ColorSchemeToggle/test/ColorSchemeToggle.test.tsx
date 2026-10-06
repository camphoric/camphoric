import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { ColorSchemeToggle } from '../ColorSchemeToggle';

const STORAGE_KEY = 'mantine-color-scheme-value';

function view() {
  render(
    <MantineProvider defaultColorScheme="auto">
      <ColorSchemeToggle />
    </MantineProvider>,
  );
  return userEvent.setup();
}

const scheme = () => document.documentElement.getAttribute('data-mantine-color-scheme');

describe('ColorSchemeToggle', () => {
  afterEach(() => localStorage.clear());

  it('follows the system until a choice is made', () => {
    view();
    expect(screen.getByRole('button', { name: 'Light or dark mode: System' })).toBeInTheDocument();
    // The test setup's matchMedia reports no dark preference.
    expect(scheme()).toBe('light');
  });

  it('sets and remembers the chosen scheme', async () => {
    const user = view();
    await user.click(screen.getByRole('button', { name: /Light or dark mode/ }));
    await user.click(await screen.findByRole('menuitem', { name: 'Dark' }));

    expect(scheme()).toBe('dark');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('dark');
    expect(screen.getByRole('button', { name: 'Light or dark mode: Dark' })).toBeInTheDocument();
  });

  it('goes back to following the system', async () => {
    localStorage.setItem(STORAGE_KEY, 'dark');
    const user = view();
    expect(scheme()).toBe('dark');

    await user.click(screen.getByRole('button', { name: 'Light or dark mode: Dark' }));
    await user.click(await screen.findByRole('menuitem', { name: 'System' }));

    expect(scheme()).toBe('light');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('auto');
  });
});

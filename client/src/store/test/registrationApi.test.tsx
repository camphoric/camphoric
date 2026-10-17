import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import userEvent from '@testing-library/user-event';
import { useEventId } from 'hooks/useEventId';
import { useGoToStep } from 'hooks/useGoToStep';
import { parseSearch, stringifySearch } from 'navigation/search';
import { renderWithProviders, screen, waitFor } from 'test/utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useRegistrationConfig } from '../registrationApi';

const apiFetch = vi.hoisted(() => vi.fn());
vi.mock('utils/fetch', async (importOriginal) => ({
  ...(await importOriginal<typeof import('utils/fetch')>()),
  apiFetch,
}));

function Step() {
  const { data: config } = useRegistrationConfig(useEventId());
  const goToStep = useGoToStep();
  if (!config) return null;
  return (
    <button type="button" onClick={() => goToStep('payment')}>
      Continue
    </button>
  );
}

/** The register layout and its steps, opened at `initialEntry`. */
function renderInRouter(initialEntry: string) {
  // The router restores scroll on each navigation; jsdom can't scroll.
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  const root = createRootRoute();
  const layout = createRoute({ getParentRoute: () => root, path: '/events/$eventId/register' });
  const steps = ['registration', 'payment'].map((path) =>
    createRoute({ getParentRoute: () => layout, path, component: Step }),
  );
  const router = createRouter({
    routeTree: root.addChildren([layout.addChildren(steps)]),
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
    parseSearch,
    stringifySearch,
  });
  const client = new QueryClient();
  renderWithProviders(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router, client };
}

beforeEach(() => {
  apiFetch.mockReset();
  apiFetch.mockResolvedValue({});
});

describe('useRegistrationConfig', () => {
  it.each([
    // As the server's invitation links spell it: `@` left as is.
    ['?email=pat%2Bcamp@example.com&code=XYZ', '?email=pat%2Bcamp%40example.com&code=XYZ'],
    // A JSON-quoted value, as the router's old serializer wrote one, is read unquoted (DR-83).
    ['?email=pat%40example.com&code=%22123%22', '?email=pat%40example.com&code=123'],
  ])(
    'asks for the config once, by the same query, across a step change from %s',
    async (query, sent) => {
      const user = userEvent.setup();
      const { router, client } = renderInRouter(`/events/7/register/registration${query}`);

      await user.click(await screen.findByRole('button', { name: 'Continue' }));
      await waitFor(() =>
        expect(router.state.location.pathname).toBe('/events/7/register/payment'),
      );
      await screen.findByRole('button', { name: 'Continue' });

      expect(apiFetch).toHaveBeenCalledOnce();
      expect(apiFetch).toHaveBeenCalledWith(`/api/events/7/register${sent}`, expect.anything());
      expect(client.getQueryCache().findAll({ queryKey: ['RegisterConfig'] })).toHaveLength(1);
    },
  );

  it('asks with no query string when the page has none', async () => {
    renderInRouter('/events/7/register/registration');

    await screen.findByRole('button', { name: 'Continue' });
    expect(apiFetch).toHaveBeenCalledWith('/api/events/7/register', expect.anything());
  });
});

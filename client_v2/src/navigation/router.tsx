/**
 * Application routing (SPEC §4) using TanStack Router, code-first. Two top-level
 * branches — public registration and admin (behind the auth guard). Admin
 * selection state lives in typed, validated search params (DR-2). A trailing-
 * slash normalizer redirects any `…/` URL to the non-slash form. Admin selection
 * (registration/camper/report) and the registrations sub-tab are URL-addressable
 * search params.
 */

import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Outlet,
  redirect,
} from '@tanstack/react-router';
import { ErrorBoundary } from 'components/ErrorBoundary';
import { FullScreenLoading } from 'components/Loading';
import { Splash } from 'pages/Splash';

// Feature screens are lazy-loaded so the registration entry bundle stays lean and
// the whole admin surface (with its admin-only deps — Monaco, TanStack Table) is
// code-split behind `/admin` (SPEC §11, DR-19, DR-8). The splash + bootstrap +
// router shell are the only eager UI.
const AdminShell = lazyRouteComponent(() => import('navigation/AdminShell'), 'AdminShell');
const EventAdminContainer = lazyRouteComponent(
  () => import('navigation/EventAdminContainer'),
  'EventAdminContainer',
);
const OrganizationChooser = lazyRouteComponent(
  () => import('pages/admin/OrganizationChooser'),
  'OrganizationChooser',
);
const EventChooser = lazyRouteComponent(() => import('pages/admin/EventChooser'), 'EventChooser');
const EventAdminHome = lazyRouteComponent(() => import('pages/admin/EventAdminHome'), 'EventAdminHome');
const EventAdminSettings = lazyRouteComponent(
  () => import('pages/admin/EventAdminSettings'),
  'EventAdminSettings',
);
const EventAdminRegistrations = lazyRouteComponent(
  () => import('pages/admin/registrations'),
  'EventAdminRegistrations',
);
const EventAdminCampers = lazyRouteComponent(() => import('pages/admin/campers'), 'EventAdminCampers');
const EventAdminLodging = lazyRouteComponent(() => import('pages/admin/lodging'), 'EventAdminLodging');
const EventAdminReports = lazyRouteComponent(() => import('pages/admin/reports'), 'EventAdminReports');

const RegisterContainer = lazyRouteComponent(() => import('pages/register'), 'RegisterContainer');
const RegistrationStep = lazyRouteComponent(() => import('pages/register'), 'RegistrationStep');
const PaymentStep = lazyRouteComponent(() => import('pages/register'), 'PaymentStep');
const ConfirmationStep = lazyRouteComponent(() => import('pages/register'), 'ConfirmationStep');

// --- Admin search-param contract (SPEC §4, §8.2) -------------------------------

export interface AdminSearch {
  registrationId?: string;
  camperId?: string;
  reportId?: string;
  registrationsTab?: string;
  // Per-table state (sort/filter/page) is namespaced by a table prefix, e.g.
  // `regq`, `regsort`, `regpage` (DR-2, DR-19) — carried through as strings.
  [tableParam: string]: string | undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

function validateAdminSearch(search: Record<string, unknown>): AdminSearch {
  const out: AdminSearch = {};
  // Preserve every non-empty string search param (selection ids + table state).
  for (const [key, value] of Object.entries(search)) {
    const str = asString(value);
    if (str !== undefined) out[key] = str;
  }
  return out;
}

// --- Root ----------------------------------------------------------------------

const rootRoute = createRootRoute({
  component: () => (
    <ErrorBoundary>
      <Outlet />
    </ErrorBoundary>
  ),
});

// --- Public / registration -----------------------------------------------------

const splashRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: Splash,
});

// The registration flow is a layout (the container loads config + gates) with
// the three steps as children.
const registerLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/events/$eventId/register',
  component: RegisterContainer,
});

// Bare `…/register` redirects to step 1, preserving the query string (which may
// carry an invitation code).
const registerIndexRoute = createRoute({
  getParentRoute: () => registerLayoutRoute,
  path: '/',
  beforeLoad: ({ params, search }) => {
    // `throw redirect(...)` is the TanStack Router idiom; the thrown value is a
    // Redirect control object, not an Error.
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw redirect({
      to: '/events/$eventId/register/registration',
      params,
      search,
    });
  },
});

const registrationStepRoute = createRoute({
  getParentRoute: () => registerLayoutRoute,
  path: 'registration',
  component: RegistrationStep,
});

const paymentStepRoute = createRoute({
  getParentRoute: () => registerLayoutRoute,
  path: 'payment',
  component: PaymentStep,
});

const confirmationStepRoute = createRoute({
  getParentRoute: () => registerLayoutRoute,
  path: 'finished',
  component: ConfirmationStep,
});

// --- Admin (behind the auth guard) ---------------------------------------------

const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin',
  component: AdminShell,
});

const organizationChooserIndexRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/',
  component: OrganizationChooser,
});

const organizationChooserRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: 'organization',
  component: OrganizationChooser,
});

const eventChooserRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: 'organization/$organizationId/event',
  component: EventChooser,
});

const eventAdminRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: 'organization/$organizationId/event/$eventId',
  validateSearch: validateAdminSearch,
  component: EventAdminContainer,
});

// Unmatched/bare event-admin subpaths fall back to home (SPEC §4, §8.2).
const eventAdminIndexRoute = createRoute({
  getParentRoute: () => eventAdminRoute,
  path: '/',
  beforeLoad: ({ params }) => {
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw redirect({
      to: '/admin/organization/$organizationId/event/$eventId/home',
      params,
    });
  },
});

// Section routes are declared with literal `path` strings (not via a helper) so
// TanStack Router can infer each route's full path into the typed route tree.
const homeRoute = createRoute({
  getParentRoute: () => eventAdminRoute,
  path: 'home',
  component: EventAdminHome,
});
const registrationsRoute = createRoute({
  getParentRoute: () => eventAdminRoute,
  path: 'registrations',
  component: EventAdminRegistrations,
});
const campersRoute = createRoute({
  getParentRoute: () => eventAdminRoute,
  path: 'campers',
  component: EventAdminCampers,
});
const lodgingRoute = createRoute({
  getParentRoute: () => eventAdminRoute,
  path: 'lodging',
  component: EventAdminLodging,
});
const reportsRoute = createRoute({
  getParentRoute: () => eventAdminRoute,
  path: 'reports',
  component: EventAdminReports,
});
const settingsRoute = createRoute({
  getParentRoute: () => eventAdminRoute,
  path: 'settings',
  component: EventAdminSettings,
});

const eventAdminCatchAllRoute = createRoute({
  getParentRoute: () => eventAdminRoute,
  path: '$',
  beforeLoad: ({ params }) => {
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw redirect({
      to: '/admin/organization/$organizationId/event/$eventId/home',
      params: { organizationId: params.organizationId, eventId: params.eventId },
    });
  },
});

// --- Assemble ------------------------------------------------------------------

const routeTree = rootRoute.addChildren([
  splashRoute,
  registerLayoutRoute.addChildren([
    registerIndexRoute,
    registrationStepRoute,
    paymentStepRoute,
    confirmationStepRoute,
  ]),
  adminRoute.addChildren([
    organizationChooserIndexRoute,
    organizationChooserRoute,
    eventChooserRoute,
    eventAdminRoute.addChildren([
      eventAdminIndexRoute,
      homeRoute,
      registrationsRoute,
      campersRoute,
      lodgingRoute,
      reportsRoute,
      settingsRoute,
      eventAdminCatchAllRoute,
    ]),
  ]),
]);

export const router = createRouter({
  routeTree,
  trailingSlash: 'never',
  defaultPreload: 'intent',
  // Shown while a lazy route chunk loads (and `intent` preloading on hover keeps
  // this brief in practice).
  defaultPendingComponent: () => <FullScreenLoading />,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

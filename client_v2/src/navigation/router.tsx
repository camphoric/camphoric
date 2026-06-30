/**
 * Application routing (SPEC §4) using TanStack Router, code-first. Two top-level
 * branches — public registration and admin (behind the auth guard). Admin
 * selection state lives in typed, validated search params (DR-2). A trailing-
 * slash normalizer redirects any `…/` URL to the non-slash form.
 *
 * Phase 1: the route tree, guard, redirects, and search-param contract are real;
 * the feature screens are placeholders until their phases.
 */

import { createRootRoute, createRoute, createRouter, Outlet, redirect } from '@tanstack/react-router';
import { ErrorBoundary } from 'components/ErrorBoundary';
import { AuthGuard } from 'navigation/AuthGuard';
import { EventAdminContainer } from 'navigation/EventAdminContainer';
import { EventAdminHome } from 'pages/admin/EventAdminHome';
import { EventAdminSettings } from 'pages/admin/EventAdminSettings';
import { EventChooser } from 'pages/admin/EventChooser';
import { OrganizationChooser } from 'pages/admin/OrganizationChooser';
import { Placeholder } from 'pages/Placeholder';
import {
  ConfirmationStep,
  PaymentStep,
  RegisterContainer,
  RegistrationStep,
} from 'pages/register';
import { Splash } from 'pages/Splash';

// --- Admin search-param contract (SPEC §4, §8.2) -------------------------------

export interface AdminSearch {
  registrationId?: string;
  camperId?: string;
  reportId?: string;
  registrationsTab?: string;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

function validateAdminSearch(search: Record<string, unknown>): AdminSearch {
  return {
    registrationId: asString(search.registrationId),
    camperId: asString(search.camperId),
    reportId: asString(search.reportId),
    registrationsTab: asString(search.registrationsTab),
  };
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
  component: () => (
    <AuthGuard>
      <Outlet />
    </AuthGuard>
  ),
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
  component: () => <Placeholder title="Registrations" phase="Phase 6 (§8.4)" />,
});
const campersRoute = createRoute({
  getParentRoute: () => eventAdminRoute,
  path: 'campers',
  component: () => <Placeholder title="Campers" phase="Phase 6 (§8.5)" />,
});
const lodgingRoute = createRoute({
  getParentRoute: () => eventAdminRoute,
  path: 'lodging',
  component: () => <Placeholder title="Lodging" phase="Phase 7 (§8.6)" />,
});
const reportsRoute = createRoute({
  getParentRoute: () => eventAdminRoute,
  path: 'reports',
  component: () => <Placeholder title="Reports" phase="Phase 5 (§8.7)" />,
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
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

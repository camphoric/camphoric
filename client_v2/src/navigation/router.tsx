/**
 * Application routing (SPEC §4) using TanStack Router, code-first. Two top-level
 * branches — public registration and admin (behind the auth guard). Admin
 * selection state lives in typed, validated search params (DR-2). A trailing-
 * slash normalizer redirects any `…/` URL to the non-slash form. Admin selection
 * (registration/camper/report) and the open tab or view within a section or
 * record editor are URL-addressable search params.
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
const AdminFrame = lazyRouteComponent(() => import('navigation/AdminFrame'), 'AdminFrame');
const UsersPage = lazyRouteComponent(() => import('pages/admin/users/UsersPage'), 'UsersPage');
const SetPasswordPage = lazyRouteComponent(
  () => import('pages/account/SetPasswordPage'),
  'SetPasswordPage',
);
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
const EventAdminEmail = lazyRouteComponent(() => import('pages/admin/email'), 'EventAdminEmail');
const EventAdminTemplateHelp = lazyRouteComponent(
  () => import('pages/admin/templateHelp'),
  'EventAdminTemplateHelp',
);

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
  // The open section of the registration / camper editors, the Lodging view
  // and the lodging it's narrowed to (comma-separated node ids), and the
  // Settings tab.
  regTab?: string;
  camperTab?: string;
  lodgingView?: string;
  lodgingFilter?: string;
  settingsTab?: string;
  // Email (SPEC §8.9): the tab, the template being edited, the open message,
  // and the history's filters.
  emailTab?: string;
  templateId?: string;
  messageId?: string;
  mstatus?: string;
  mkind?: string;
  mq?: string;
  mpage?: string;
  mbatch?: string;
  // Template Help (SPEC §4, §9.3).
  context?: string;
  helpTab?: string;
  topic?: string;
  q?: string;
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

// The site-level pages (the choosers) share a frame with the user menu (SPEC §8.1).
const adminFrameRoute = createRoute({
  getParentRoute: () => adminRoute,
  id: 'frame',
  component: AdminFrame,
});

const organizationChooserIndexRoute = createRoute({
  getParentRoute: () => adminFrameRoute,
  path: '/',
  component: OrganizationChooser,
});

const organizationChooserRoute = createRoute({
  getParentRoute: () => adminFrameRoute,
  path: 'organization',
  component: OrganizationChooser,
});

const eventChooserRoute = createRoute({
  getParentRoute: () => adminFrameRoute,
  path: 'organization/$organizationId/event',
  component: EventChooser,
});

// User management, for Admins only (SPEC §8.10). `?userId` is the user being
// edited: an id, or `new`.
const usersRoute = createRoute({
  getParentRoute: () => adminFrameRoute,
  path: 'users',
  validateSearch: (search: Record<string, unknown>): { userId?: string } => ({
    userId: typeof search.userId === 'string' && search.userId ? search.userId : undefined,
  }),
  component: UsersPage,
});

// --- Account (public: reached before signing in) --------------------------------

// A set-password link from an email (SPEC §6, DR-52).
const setPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/account/set-password/$uid/$token',
  component: SetPasswordPage,
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
const emailRoute = createRoute({
  getParentRoute: () => eventAdminRoute,
  path: 'email',
  component: EventAdminEmail,
});
const templateHelpRoute = createRoute({
  getParentRoute: () => eventAdminRoute,
  path: 'template-help',
  component: EventAdminTemplateHelp,
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
  setPasswordRoute,
  registerLayoutRoute.addChildren([
    registerIndexRoute,
    registrationStepRoute,
    paymentStepRoute,
    confirmationStepRoute,
  ]),
  adminRoute.addChildren([
    adminFrameRoute.addChildren([
      organizationChooserIndexRoute,
      organizationChooserRoute,
      eventChooserRoute,
      usersRoute,
    ]),
    eventAdminRoute.addChildren([
      eventAdminIndexRoute,
      homeRoute,
      registrationsRoute,
      campersRoute,
      lodgingRoute,
      reportsRoute,
      emailRoute,
      templateHelpRoute,
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

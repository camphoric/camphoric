import React from 'react';

type ContextValue<P> = {
  value: P[],
  get: () => Promise<void>,
}

type ApiHook<P> = React.Context<ContextValue<P>>;

/**
 * Contexts for Persistent Global State
 *
 */
export const AuthContext = React.createContext({
  set: (value: string) => {},
  value: '',
});

export const EventsContext = React.createContext({
  get: async () => Promise.resolve(),
  value: [] as Array<ApiEvent>,
});

export const OrganizationsContext = React.createContext({
  get: async () => Promise.resolve(),
  value: [] as Array<ApiOrganization>,
});

export const RegistrationsContext = React.createContext({
  get: async () => Promise.resolve(),
  value: [] as Array<ApiRegistration>,
});

export const CampersContext = React.createContext({
  get: async () => Promise.resolve(),
  value: [] as Array<ApiCamper>,
});


/**
 * useAuthToken hook
 *
 * This hook is not created via a factory, because it's value type is different
 * than all others.
 */
export function useAuthToken() {
  const authToken = React.useContext(AuthContext);

  return authToken;
}

/**
 * Context hooks for api calls
 *
 * Because all api endpoints return an array of some type of value, we have
 * created factory functions that abstract their creation.
 */
function apiContextHookFactory<P>(hook: ApiHook<P>): () => ContextValue<P> {
  return () => {
    const ctx = React.useContext(hook);

    if (!ctx.value || !ctx.value.length) ctx.get();

    return ctx;
  }
}

export const useEvents = apiContextHookFactory<ApiEvent>(EventsContext);
export const useOrganizations = apiContextHookFactory<ApiOrganization>(OrganizationsContext);
export const useRegistrations = apiContextHookFactory<ApiRegistration>(RegistrationsContext);
export const useCampers = apiContextHookFactory<ApiCamper>(CampersContext);

type CtxId = string | number;
type ContextFilteredFunc<P> = (id?: CtxId) => {
  get: () => Promise<any>,
  value?: P,
}

/**
 * Context hooks for getting a singular value from an api call
 *
 * Because all api endpoints return an array of some type of value, we have
 * created factory functions that abstract the filtering of those values.
 */
function apiContextHookFilterFactory<P extends { id: CtxId }>(hook: ApiHook<P>): ContextFilteredFunc<P> {
  return (ctxId?: CtxId) => {
    const ctx = React.useContext(hook);

    if (!ctx.value || !ctx.value.length) ctx.get();

    const ctxIdStr = ctxId && ctxId.toString();

    return {
      get: ctx.get,
      value: ctx.value.find(e => e.id.toString() === ctxIdStr),
    };
  }
}

export const useEvent = apiContextHookFilterFactory<ApiEvent>(EventsContext);
export const useRegistration = apiContextHookFilterFactory<ApiRegistration>(RegistrationsContext);
export const useCamper = apiContextHookFilterFactory<ApiCamper>(CampersContext);

interface AugmentedCamper extends ApiCamper {
  searchStr: string;
  searchStrJson: string;
  label: string;
}

interface AugmentedRegistration extends ApiRegistration {
  searchStr: string;
  searchStrJson: string;
  campers: Array<AugmentedCamper>;
}

type CombinedEventInfo = {
  [id: string]: AugmentedRegistration,
}

export function useCombinedEventInfo(eventId: CtxId): CombinedEventInfo {
  const { value: registrations } = useRegistrations();
  const { value: campers } = useCampers();

  if (!registrations || !campers) return {};

  const eventIdStr = eventId.toString();

  return registrations
    .filter(r => r.event.toString() === eventIdStr)
    .map(r => {
      const augmentedReg = {
        ...r,
        campers: campers
          .filter(c => c.registration.toString() === r.id.toString())
          .map(
            c => ({
              ...c,
              // look for any 'name' type attributes and concat as label
              label: Object.keys(c.attributes)
                .filter(a => a.toLowerCase().includes('name'))
                .map(k => c.attributes[k])
                .join(', '),
              searchStrJson: JSON.stringify(c),
              searchStr: createSearchStr(c),
            }),
          ),
        searchStr: '',
      };

      return {
        ...augmentedReg,
        searchStr: createSearchStr({
          ...augmentedReg,
          campers: augmentedReg.campers.map(c => c.searchStr).join(),
        }),
        searchStrJson: JSON.stringify(r),
      };
    })
    .reduce(
      (acc, r) => ({
        ...acc,
        [r.id]: r,
      }),
      {},
    );
}

// This is used for creating search strings on the above values, which are used
// in the EventAdmin pages for searching objects.
function createSearchStr(obj: Object): string {
  if (!obj) return '';
  return Object.values(obj)
    .reduce(
      (acc, v) => `${acc}${
        (typeof v === 'object' && !Array.isArray(v))
          ? createSearchStr(v)
          : JSON.stringify(v)
      }`,
      ''
    ).replaceAll(/"+/g, ' ').toLowerCase();
}

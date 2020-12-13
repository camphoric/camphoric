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

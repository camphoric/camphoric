import React from 'react';
import memoize from 'lodash/memoize';
import { useLocation } from 'react-router-dom';
// const memoize = (func: Function) => func;

/**
 * useUser hook
 *
 * This hook is not created via a factory, because it's value type is different
 * than all others.
 */
export type UserInfo = {
  email: string,
  loggedIn: boolean,
}

export const unauthenticatedUser = {
  email: 'none',
  loggedIn: false,
};

export const UserContext = React.createContext({
  set: (value: UserInfo) => {},
  value: unauthenticatedUser as UserInfo,
});

export function useUser() {
  const user = React.useContext(UserContext);

  return user;
}

export interface MinimumApiObject {
  id: number,
}

type ContextValueStatus = 'undef' | 'fetching' | 'setting' | 'done';
export type ContextValue<P extends MinimumApiObject>= {
  value: P[],
  get: () => void,
  set: (value: P) => void,
  status: ContextValueStatus,
};

type ApiHook<P extends MinimumApiObject> = React.Context<ContextValue<P>>;

function contextFactory<P extends MinimumApiObject>(): React.Context<ContextValue<P>> {
  return React.createContext({
    value: [] as Array<P>,
    get: () => {},
    set: (value) => {},
    status: 'undef' as ContextValueStatus,
  });
}

/**
 * Contexts for Persistent Global State
 *
 */
export const EventsContext = contextFactory<ApiEvent>();
export const OrganizationsContext = contextFactory<ApiOrganization>();
export const RegistrationsContext = contextFactory<ApiRegistration>();
export const CampersContext = contextFactory<ApiCamper>();

/**
 * Context hooks for api calls
 *
 * Because all api endpoints return an array of some type of value, we have
 * created factory functions that abstract their creation.
 */

function apiContextHookFactory<P extends MinimumApiObject>(hook: ApiHook<P>): () => ContextValue<P> {
  return () => {
    const ctx = React.useContext(hook);

    if (ctx.status === 'undef') ctx.get();

    return ctx;
  }
}

export const useEvents = apiContextHookFactory<ApiEvent>(EventsContext);
export const useOrganizations = apiContextHookFactory<ApiOrganization>(OrganizationsContext);
export const useRegistrations = apiContextHookFactory<ApiRegistration>(RegistrationsContext);
export const useCampers = apiContextHookFactory<ApiCamper>(CampersContext);

type CtxId = string | number;
type ContextFilteredFunc<P extends MinimumApiObject> = (id?: CtxId) => {
  get: () => void,
  set: (value: P) => void,
  value: P | undefined,
  status: ContextValueStatus,
}

/**
 * Context hooks for getting a singular value from an api call
 *
 * Because all api endpoints return an array of some type of value, we have
 * created factory functions that abstract the filtering of those values.
 */
function apiContextHookFilterFactory<P extends MinimumApiObject>(hook: ApiHook<P>): ContextFilteredFunc<P> {
  return (ctxId?: CtxId) => {
    const ctx = React.useContext(hook);

    if (ctx.status === 'undef') ctx.get();

    const ctxIdStr = ctxId && ctxId.toString();

    return {
      get: ctx.get,
      set: ctx.set,
      value: ctx.value.find(e => e.id.toString() === ctxIdStr),
      status: ctx.status,
    };
  }
}

export const useEvent = apiContextHookFilterFactory<ApiEvent>(EventsContext);
export const useRegistration = apiContextHookFilterFactory<ApiRegistration>(RegistrationsContext);
export const useCamper = apiContextHookFilterFactory<ApiCamper>(CampersContext);

const createAugmentedRegistrations = memoize(
  (registrations: Array<ApiRegistration>, campers: Array<ApiCamper>, eventId: CtxId): RegistrationLookup => {
    const eventIdStr = eventId.toString();

    return registrations
      .filter(r => r.event.toString() === eventIdStr)
      .map(r => ({
        ...r,
        campers: campers.filter(
          c => c.registration.toString() === r.id.toString()
        ),
      }))
      .reduce(
        (acc, r) => ({
          ...acc,
          [r.id]: r,
        }),
        {},
      )
  }
);

export function useRegistrationLookup(eventId: CtxId): RegistrationLookup {
  const { value: registrations } = useRegistrations();
  const { value: campers } = useCampers();

  if (!registrations || !campers) return {};
  if (!registrations.length || !campers.length) return {};

  const result = createAugmentedRegistrations(registrations, campers, eventId);

  return result;
}

// A custom hook that builds on useLocation to parse
// the query string for you.
export function useQuery(type: undefined): URLSearchParams;
export function useQuery(type: string): string;
export function useQuery(name?: string) {
  const params = new URLSearchParams(useLocation().search);

  if (name) return params.get(name);

  return params;
}

/**
 * Factory producing a consistent CRUD hook set per admin entity over the DRF
 * REST API (SPEC §5). Every entity behaves identically: list/by-id reads and
 * create/update/delete mutations, with query-key invalidation.
 *
 * Trailing slashes are REQUIRED by the backend router — the paths here always
 * include them.
 *
 * Some mutations affect derived data on other entities and must invalidate
 * multiple namespaces (e.g. a Camper/Payment/CustomCharge change also changes a
 * Registration's totals). Pass those extra namespaces via `alsoInvalidate`.
 *
 * An update or delete given the `version` it was made from sends it as
 * `If-Match`; the server refuses it (412) when someone else changed the record
 * first (SPEC §5, DR-109), and the entity is refetched. A screen that resolves
 * such conflicts itself (hooks/useEditableRecord) passes `handlesVersionConflict`
 * so the shared error toast stays out of the way.
 *
 * The second type parameter names the filters the entity's list takes (the
 * server's filterset for it, camphoric/filters.py), so a filter the server
 * doesn't have fails type-checking instead of a 400 at run time (SPEC §5, DR-136).
 */

import {
  type QueryKey,
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import type { Scalar } from 'api-types';
import { apiFetch, ifMatch, versionConflict } from 'utils/fetch';

type ListValue = Scalar | boolean | undefined;
/** A list's query: values for some of its filters `F` (none, for a list with no filters). */
export type ListParams<F extends string> = [F] extends [never]
  ? Record<string, never>
  : Partial<Record<F, ListValue>>;

export interface EntityHooksConfig {
  /** Logical entity name; also the query-key namespace, e.g. "Registration". */
  name: string;
  /** REST path segment (without slashes). Defaults to `name.toLowerCase() + "s"`. */
  path?: string;
  /** Extra entity namespaces to invalidate on every mutation (derived data). */
  alsoInvalidate?: string[];
}

export interface MutationOptions {
  /** The caller shows the conflict itself; no "Request failed" toast for a 412. */
  handlesVersionConflict?: boolean;
}

export interface EntityHooks<T extends { id: Scalar }, F extends string = never> {
  name: string;
  /** Other entities its changes change too (refetched with it). */
  alsoInvalidate: string[];
  listKey: (params?: ListParams<F>) => QueryKey;
  detailKey: (id: Scalar) => QueryKey;
  useList: (params?: ListParams<F>, enabled?: boolean) => UseQueryResult<T[]>;
  useById: (id: Scalar | null | undefined) => UseQueryResult<T>;
  useCreate: () => ReturnType<typeof useMutation<T, Error, CreateBody<T>>>;
  useUpdate: (options?: MutationOptions) => ReturnType<typeof useMutation<T, Error, UpdateBody<T>>>;
  useDelete: (options?: MutationOptions) => ReturnType<typeof useMutation<void, Error, DeleteBody>>;
}

export type CreateBody<T> = Omit<T, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'version'>;
/** The fields to change; `version`, when given, is the one they were edited from. */
export type UpdateBody<T extends { id: Scalar }> = Partial<T> &
  Pick<T, 'id'> & { version?: number };
export interface DeleteBody {
  id: Scalar;
  /** The version the user saw; the delete is refused if it has moved on. */
  version?: number;
}

export function toQuery(params: Record<string, ListValue>): string {
  // Sort keys so the query string (and thus the cache key) is stable.
  const entries = Object.entries(params)
    .filter(([, value]) => value !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => [key, String(value)] as [string, string]);
  if (entries.length === 0) return '';
  return `?${new URLSearchParams(entries).toString()}`;
}

export function createEntityHooks<T extends { id: Scalar }, F extends string = never>(
  config: EntityHooksConfig,
): EntityHooks<T, F> {
  const { name, alsoInvalidate = [] } = config;
  const path = config.path ?? `${name.toLowerCase()}s`;
  const base = `/api/${path}/`;

  // `base` is part of the key so it fully reflects what the query fetches; the
  // key stays prefixed by `name` so name-level invalidation still matches.
  const listKey = (params?: ListParams<F>): QueryKey => [name, 'list', base, toQuery(params ?? {})];
  const detailKey = (id: Scalar): QueryKey => [name, 'detail', base, id];

  function useInvalidate() {
    const client = useQueryClient();
    return () => {
      // Any change is in someone's history, and a delete may be in a deleted list
      // (store/deletes).
      [name, ...alsoInvalidate, 'History', 'Deleted'].forEach((entity) => {
        void client.invalidateQueries({ queryKey: [entity] });
      });
    };
  }

  // Someone else's change got there first: show it.
  function useRefetchOnConflict() {
    const client = useQueryClient();
    return (error: Error) => {
      if (versionConflict(error)) void client.invalidateQueries({ queryKey: [name] });
    };
  }

  const metaFor = (options?: MutationOptions) =>
    options?.handlesVersionConflict ? { handlesVersionConflict: true } : undefined;

  // The query keys are inlined here (rather than via listKey/detailKey) so the
  // query/exhaustive-deps lint can see that `base` and the params are present;
  // the helper builders return the identical shape for cache invalidation.
  const useList: EntityHooks<T, F>['useList'] = (params, enabled = true) => {
    const query = toQuery(params ?? {});
    return useQuery({
      queryKey: [name, 'list', base, query],
      queryFn: ({ signal }) => apiFetch<T[]>(`${base}${query}`, { signal }),
      enabled,
    });
  };

  const useById: EntityHooks<T, F>['useById'] = (id) =>
    useQuery({
      queryKey: [name, 'detail', base, id],
      queryFn: ({ signal }) => apiFetch<T>(`${base}${id}/`, { signal }),
      enabled: id !== null && id !== undefined,
    });

  const useCreate: EntityHooks<T, F>['useCreate'] = () => {
    const invalidate = useInvalidate();
    return useMutation({
      mutationFn: (body: CreateBody<T>) => apiFetch<T>(base, { method: 'POST', body }),
      onSuccess: invalidate,
    });
  };

  const useUpdate: EntityHooks<T, F>['useUpdate'] = (options) => {
    const invalidate = useInvalidate();
    const onError = useRefetchOnConflict();
    return useMutation({
      mutationFn: ({ id, version, ...patch }: UpdateBody<T>) =>
        apiFetch<T>(`${base}${id}/`, { method: 'PATCH', body: patch, headers: ifMatch(version) }),
      onSuccess: invalidate,
      onError,
      meta: metaFor(options),
    });
  };

  const useDelete: EntityHooks<T, F>['useDelete'] = (options) => {
    const invalidate = useInvalidate();
    const onError = useRefetchOnConflict();
    return useMutation({
      mutationFn: ({ id, version }: DeleteBody) =>
        apiFetch<void>(`${base}${id}/`, { method: 'DELETE', headers: ifMatch(version) }),
      onSuccess: invalidate,
      onError,
      meta: metaFor(options),
    });
  };

  return {
    name,
    alsoInvalidate,
    listKey,
    detailKey,
    useList,
    useById,
    useCreate,
    useUpdate,
    useDelete,
  };
}

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
 */

import {
  type QueryKey,
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import type { Scalar } from 'api-types';
import { apiFetch } from 'utils/fetch';

export type ListParams = Record<string, Scalar | boolean | undefined>;

export interface EntityHooksConfig {
  /** Logical entity name; also the query-key namespace, e.g. "Registration". */
  name: string;
  /** REST path segment (without slashes). Defaults to `name.toLowerCase() + "s"`. */
  path?: string;
  /** Extra entity namespaces to invalidate on every mutation (derived data). */
  alsoInvalidate?: string[];
}

export interface EntityHooks<T extends { id: Scalar }> {
  name: string;
  listKey: (params?: ListParams) => QueryKey;
  detailKey: (id: Scalar) => QueryKey;
  useList: (params?: ListParams, enabled?: boolean) => UseQueryResult<T[]>;
  useById: (id: Scalar | null | undefined) => UseQueryResult<T>;
  useCreate: () => ReturnType<typeof useMutation<T, Error, CreateBody<T>>>;
  useUpdate: () => ReturnType<typeof useMutation<T, Error, UpdateBody<T>>>;
  useDelete: () => ReturnType<typeof useMutation<void, Error, { id: Scalar }>>;
}

export type CreateBody<T> = Omit<T, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>;
export type UpdateBody<T extends { id: Scalar }> = Partial<T> & Pick<T, 'id'>;

function toQuery(params: ListParams): string {
  // Sort keys so the query string (and thus the cache key) is stable.
  const entries = Object.entries(params)
    .filter(([, value]) => value !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => [key, String(value)] as [string, string]);
  if (entries.length === 0) return '';
  return `?${new URLSearchParams(entries).toString()}`;
}

export function createEntityHooks<T extends { id: Scalar }>(
  config: EntityHooksConfig,
): EntityHooks<T> {
  const { name, alsoInvalidate = [] } = config;
  const path = config.path ?? `${name.toLowerCase()}s`;
  const base = `/api/${path}/`;

  // `base` is part of the key so it fully reflects what the query fetches; the
  // key stays prefixed by `name` so name-level invalidation still matches.
  const listKey = (params: ListParams = {}): QueryKey => [name, 'list', base, toQuery(params)];
  const detailKey = (id: Scalar): QueryKey => [name, 'detail', base, id];

  function useInvalidate() {
    const client = useQueryClient();
    return () => {
      [name, ...alsoInvalidate].forEach((entity) => {
        void client.invalidateQueries({ queryKey: [entity] });
      });
    };
  }

  // The query keys are inlined here (rather than via listKey/detailKey) so the
  // query/exhaustive-deps lint can see that `base` and the params are present;
  // the helper builders return the identical shape for cache invalidation.
  const useList: EntityHooks<T>['useList'] = (params = {}, enabled = true) =>
    useQuery({
      queryKey: [name, 'list', base, toQuery(params)],
      queryFn: ({ signal }) => apiFetch<T[]>(`${base}${toQuery(params)}`, { signal }),
      enabled,
    });

  const useById: EntityHooks<T>['useById'] = (id) =>
    useQuery({
      queryKey: [name, 'detail', base, id],
      queryFn: ({ signal }) => apiFetch<T>(`${base}${id}/`, { signal }),
      enabled: id !== null && id !== undefined,
    });

  const useCreate: EntityHooks<T>['useCreate'] = () => {
    const invalidate = useInvalidate();
    return useMutation({
      mutationFn: (body: CreateBody<T>) => apiFetch<T>(base, { method: 'POST', body }),
      onSuccess: invalidate,
    });
  };

  const useUpdate: EntityHooks<T>['useUpdate'] = () => {
    const invalidate = useInvalidate();
    return useMutation({
      mutationFn: ({ id, ...patch }: UpdateBody<T>) =>
        apiFetch<T>(`${base}${id}/`, { method: 'PATCH', body: patch }),
      onSuccess: invalidate,
    });
  };

  const useDelete: EntityHooks<T>['useDelete'] = () => {
    const invalidate = useInvalidate();
    return useMutation({
      mutationFn: ({ id }: { id: Scalar }) => apiFetch<void>(`${base}${id}/`, { method: 'DELETE' }),
      onSuccess: invalidate,
    });
  };

  return { name, listKey, detailKey, useList, useById, useCreate, useUpdate, useDelete };
}

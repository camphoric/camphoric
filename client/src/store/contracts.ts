/**
 * Each organization's contract (SPEC §5, §6; §15 DR-145): the latest version to
 * agree to before reaching the organization, agreeing to it, the versions you've
 * agreed to, the public privacy policy, and — for Admins — drafting, publishing
 * and seeing who has agreed.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AgreeToContractRequest,
  ApiContract,
  ApiContractAgreement,
  ApiContractSection,
  ApiMyContractAgreement,
  ApiOrganizationContract,
  ApiPrivacyPolicy,
  ApiUser,
} from 'api-types';
import { ApiError, apiFetch } from 'utils/fetch';

import { createEntityHooks } from './createEntityHooks';

/** The code of the 403 the server answers until the user agrees with the organization. */
export const CONTRACT_AGREEMENT_REQUIRED = 'contract_agreement_required';

// Mirrors hooks/auth WHOAMI_KEY (importing it here would pull hooks into the store).
const WHOAMI = ['WhoAmI'];

/** The organization a 403 says the user has yet to agree with, or null for any other error. */
export function contractAgreementRequired(error: unknown): number | null {
  if (!(error instanceof ApiError) || error.status !== 403) return null;
  const body = error.body as { code?: unknown; organization?: unknown } | null;
  if (body?.code !== CONTRACT_AGREEMENT_REQUIRED) return null;
  return typeof body.organization === 'number' ? body.organization : null;
}

const organizationContractKey = (organizationId: number) => [
  'OrganizationContract',
  organizationId,
];

/** The organization's latest version, and whether you've agreed to it. */
export function useOrganizationContract(organizationId: number) {
  return useQuery({
    queryKey: organizationContractKey(organizationId),
    queryFn: ({ signal }) =>
      apiFetch<ApiOrganizationContract>(`/api/organizations/${organizationId}/contract`, {
        signal,
      }),
    // What's shown must be what's agreed to: always the latest.
    staleTime: 0,
  });
}

/**
 * Agree to the version shown. The answer is the new whoami, which no longer has
 * the organization pending, so the gate opens at once. A 409 means the version
 * changed since it was shown; the latest is fetched to read again.
 */
export function useAgreeToContract(organizationId: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: AgreeToContractRequest) =>
      apiFetch<ApiUser>(`/api/organizations/${organizationId}/contract/agree`, {
        method: 'POST',
        body,
      }),
    meta: { suppressErrorNotification: true },
    onSuccess: (user) => {
      client.setQueryData(WHOAMI, user);
      void client.invalidateQueries({ queryKey: ['MyContractAgreements'] });
      return client.invalidateQueries({ queryKey: organizationContractKey(organizationId) });
    },
    onError: () => client.invalidateQueries({ queryKey: organizationContractKey(organizationId) }),
  });
}

/** The versions you've agreed to, newest first, to reread. */
export function useMyContractAgreements(enabled = true) {
  return useQuery({
    queryKey: ['MyContractAgreements'],
    queryFn: ({ signal }) => apiFetch<ApiMyContractAgreement[]>('/api/user/agreements', { signal }),
    enabled,
  });
}

/** The organization's public privacy policy; null when it has none. */
export function usePrivacyPolicy(organizationId: number) {
  return useQuery({
    queryKey: ['PrivacyPolicy', organizationId],
    queryFn: async ({ signal }) => {
      try {
        return await apiFetch<ApiPrivacyPolicy>(
          `/api/organizations/${organizationId}/privacy-policy`,
          { signal },
        );
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    },
  });
}

// --- Managing versions (Admins) ---------------------------------------------------

export const contractHooks = createEntityHooks<ApiContract, 'organization'>({ name: 'Contract' });

function useInvalidateContracts() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: [contractHooks.name] });
}

/** Start the organization's draft, from its latest version's sections. */
export function useStartContractDraft() {
  const invalidate = useInvalidateContracts();
  return useMutation({
    mutationFn: (organization: number) =>
      apiFetch<ApiContract>('/api/contracts/', { method: 'POST', body: { organization } }),
    onSuccess: invalidate,
  });
}

/** Save the draft's sections, as a whole list in order (errors are shown inline). */
export function useSaveContractDraft() {
  const invalidate = useInvalidateContracts();
  return useMutation({
    mutationFn: ({
      id,
      version,
      sections,
    }: {
      id: number;
      version: number;
      sections: ApiContractSection[];
    }) =>
      apiFetch<ApiContract>(`/api/contracts/${id}/`, {
        method: 'PATCH',
        body: { sections },
        headers: { 'If-Match': `"${version}"` },
      }),
    meta: { suppressErrorNotification: true },
    onSuccess: invalidate,
  });
}

/**
 * Publish the draft as the next version: everyone, the publisher included,
 * must then agree to it before reaching the organization again.
 */
export function usePublishContract() {
  const client = useQueryClient();
  const invalidate = useInvalidateContracts();
  return useMutation({
    mutationFn: (id: number) =>
      apiFetch<ApiContract>(`/api/contracts/${id}/publish/`, { method: 'POST' }),
    meta: { suppressErrorNotification: true },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: WHOAMI });
      return invalidate();
    },
  });
}

/** Who has agreed to a version. */
export function useContractAgreements(contractId: number | null) {
  return useQuery({
    queryKey: [contractHooks.name, 'agreements', contractId],
    queryFn: ({ signal }) =>
      apiFetch<ApiContractAgreement[]>(`/api/contracts/${contractId}/agreements/`, { signal }),
    enabled: contractId !== null,
  });
}

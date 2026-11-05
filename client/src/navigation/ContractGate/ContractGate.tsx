/**
 * The contract gate (SPEC §4, §6; §15 DR-145). Past an organization in the admin
 * (`/admin/organization/:organizationId/…`), someone who has yet to agree to that
 * organization's latest contract version is asked to first; the server refuses
 * the organization's data until they do. Agreeing goes on to the URL asked for;
 * declining signs them out. The choosers above it stay open.
 *
 * Who must agree with what comes from whoami (`pending_contract_organizations`),
 * which session monitoring re-checks and a 403 `contract_agreement_required`
 * refreshes. When a new version is published while the organization's admin is
 * showing, the terms open over it, as signing in again does (DR-127): the admin
 * stays mounted, out of reach, so agreeing carries on with any unsaved edits.
 */

import { useParams } from '@tanstack/react-router';
import { useCurrentUser } from 'hooks/auth';
import { type ReactNode, useState } from 'react';

import { ContractPrompt } from './ContractPrompt';

/** The organization the current admin URL is past, or null. */
function useRouteOrganizationId(): number | null {
  const params: { organizationId?: string } = useParams({ strict: false });
  const id = Number(params.organizationId);
  return params.organizationId && Number.isInteger(id) ? id : null;
}

export function ContractGate({ children }: { children: ReactNode }) {
  const organizationId = useRouteOrganizationId();
  const { data: user } = useCurrentUser();
  const pending = user?.pending_contract_organizations ?? [];
  const needsAgreement = organizationId !== null && pending.includes(organizationId);

  // The organization whose admin has been shown here, so a version published
  // while it's showing is agreed to over it rather than in its place.
  const [shownFor, setShownFor] = useState<number | null>(null);
  if (organizationId !== null && !needsAgreement && shownFor !== organizationId) {
    setShownFor(organizationId);
  }

  if (!needsAgreement) return <>{children}</>;
  if (shownFor === organizationId) {
    return (
      <>
        {children}
        <ContractPrompt organizationId={organizationId} over />
      </>
    );
  }
  return <ContractPrompt organizationId={organizationId} />;
}

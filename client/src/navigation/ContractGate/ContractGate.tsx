/**
 * The contract gate (SPEC §4, §6; §15 DR-145, DR-151). Someone signed in who has
 * yet to agree to organizations' latest contract versions is asked for each in
 * turn — in the order whoami lists them, with how far along they are — before
 * anything of the admin shows; the server refuses those organizations' data
 * until they do. Agreeing to the last goes on to the URL asked for; declining
 * signs them out.
 *
 * Who must agree with what comes from whoami (`pending_contract_organizations`).
 * Publishing a version ends everyone's sign-ins but the publisher's (DR-151), so
 * it's usually met on signing in again. When it's met with the admin already
 * showing — the publisher, or someone signing back in over the admin they had
 * (DR-127), or a 403 `contract_agreement_required` re-checking whoami — the
 * terms open over it: the admin stays mounted, out of reach, so agreeing
 * carries on with any unsaved edits.
 */

import { isAuthenticated, useCurrentUser } from 'hooks/auth';
import { type ReactNode, useState } from 'react';

import { ContractPrompt } from './ContractPrompt';

export function ContractGate({ children }: { children: ReactNode }) {
  const { data: user } = useCurrentUser();
  const pending = user?.pending_contract_organizations ?? [];
  const next = pending.length > 0 ? pending[0] : null;

  // Once the admin has shown, terms open over it rather than in its place.
  const signedIn = isAuthenticated(user);
  const [adminShown, setAdminShown] = useState(false);
  if (next === null && signedIn && !adminShown) setAdminShown(true);

  // Every organization asked about since nothing was last pending, for "2 of 3".
  const [asked, setAsked] = useState<number[]>([]);
  const newlyPending = pending.filter((id) => !asked.includes(id));
  if (newlyPending.length > 0) setAsked([...asked, ...newlyPending]);
  if (next === null && asked.length > 0) setAsked([]);

  // Signed out before ever getting past the terms (the guard asks them to sign
  // in again): the admin stays out until they're back and have agreed.
  if (!adminShown && !signedIn) return null;
  if (next === null) return <>{children}</>;
  const total = Math.max(asked.length, pending.length);
  const progress = { position: total - pending.length + 1, total };
  if (adminShown) {
    return (
      <>
        {children}
        <ContractPrompt key={next} organizationId={next} progress={progress} over />
      </>
    );
  }
  return <ContractPrompt key={next} organizationId={next} progress={progress} />;
}

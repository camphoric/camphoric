/**
 * The organization's latest terms, to agree to or decline (SPEC §6; §15 DR-145,
 * DR-151): a page of its own in place of the admin, or, `over` an admin already
 * showing, a prompt nothing underneath can be reached past (DR-127).
 */

import {
  Alert,
  Button,
  Card,
  Center,
  getDefaultZIndex,
  Group,
  Loader,
  Modal,
  Stack,
} from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { ASSENT_TEXT, ContractAgreementForm, type ContractProgress } from 'components/Contract';
import { useLogout, WHOAMI_KEY } from 'hooks/auth';
import { useOnlyReachable } from 'navigation/useOnlyReachable';
import { type ReactNode, useEffect } from 'react';
import { useAgreeToContract, useOrganizationContract } from 'store/contracts';
import { apiErrorMessage } from 'utils/fetch';

interface ContractPromptProps {
  organizationId: number;
  /** Where these terms come among those to agree to now. */
  progress?: ContractProgress;
  /** Open over the admin, which stays as it is underneath. */
  over?: boolean;
}

export function ContractPrompt({ organizationId, progress, over = false }: ContractPromptProps) {
  const client = useQueryClient();
  const contract = useOrganizationContract(organizationId);
  const agree = useAgreeToContract(organizationId);
  const logout = useLogout();
  const alreadyAgreed = contract.data?.agreed ?? false;

  // Agreed meanwhile (in another tab): who's signed in says so once refreshed.
  useEffect(() => {
    if (alreadyAgreed) void client.invalidateQueries({ queryKey: WHOAMI_KEY });
  }, [alreadyAgreed, client]);

  const submit = () => {
    if (!contract.data) return;
    const { id, content_sha256 } = contract.data.contract;
    agree.mutate(
      { contract_id: id, content_sha256, assent_text: ASSENT_TEXT },
      {
        // Fetch again what the organization refused while they hadn't agreed.
        onSuccess: () => {
          void client.invalidateQueries({ predicate: (q) => q.queryKey[0] !== WHOAMI_KEY[0] });
        },
      },
    );
  };

  let body: ReactNode;
  if (contract.isPending) {
    body = (
      <Center p="xl">
        <Loader aria-label="Loading the terms" />
      </Center>
    );
  } else if (contract.isError) {
    body = (
      <Stack>
        <Alert color="red" title="The terms couldn’t be loaded">
          {apiErrorMessage(contract.error)}
        </Alert>
        <Group justify="flex-end">
          <Button variant="default" onClick={() => logout.mutate()} loading={logout.isPending}>
            Sign out
          </Button>
          <Button onClick={() => void contract.refetch()}>Try again</Button>
        </Group>
      </Stack>
    );
  } else {
    body = (
      <ContractAgreementForm
        contract={contract.data.contract}
        progress={progress}
        error={agree.isError ? apiErrorMessage(agree.error) : null}
        agreeing={agree.isPending}
        declining={logout.isPending}
        onAgree={submit}
        onDecline={() => logout.mutate()}
        textHeight={over ? '50vh' : '60vh'}
      />
    );
  }

  if (over) return <PromptOverAdmin>{body}</PromptOverAdmin>;
  return (
    <Center mih="100vh" p="md">
      <Card withBorder padding="lg" w={760} maw="100%">
        {body}
      </Card>
    </Center>
  );
}

function PromptOverAdmin({ children }: { children: ReactNode }) {
  const root = useOnlyReachable();
  return (
    <Modal
      opened
      onClose={() => undefined}
      withCloseButton={false}
      closeOnEscape={false}
      closeOnClickOutside={false}
      centered
      size="xl"
      portalProps={{ target: root }}
      // Above any dialog or menu left open in the admin.
      zIndex={getDefaultZIndex('popover')}
      overlayProps={{ blur: 3 }}
      aria-label="Agree to the organization’s terms"
    >
      {children}
    </Modal>
  );
}

/**
 * An organization's terms, for Admins (SPEC §8.1; §15 DR-145): its draft, to
 * edit and publish, and its published versions, to read and see who has agreed
 * to each. Publishing a version asks everyone to agree again. Managing them,
 * like anything of the organization's, needs its latest version agreed to.
 */

import { Accordion, Alert, Badge, Button, Group, Modal, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconPlus } from '@tabler/icons-react';
import { Link } from '@tanstack/react-router';
import type { ApiContract, ApiOrganization } from 'api-types';
import { ContractText, formatEffectiveDate } from 'components/Contract';
import { InlineLoading } from 'components/Loading';
import {
  contractAgreementRequired,
  contractHooks,
  usePublishContract,
  useSaveContractDraft,
  useStartContractDraft,
} from 'store/contracts';
import { apiErrorMessage } from 'utils/fetch';

import { ContractAgreements } from './ContractAgreementsTable';
import { ContractDraftEditor } from './ContractDraftEditor';

interface ContractsModalProps {
  organization: ApiOrganization | null;
  onClose: () => void;
}

export function ContractsModal({ organization, onClose }: ContractsModalProps) {
  return (
    <Modal
      opened={organization !== null}
      onClose={onClose}
      title={organization ? `${organization.name} terms` : ''}
      size="xl"
    >
      {organization && <OrganizationContracts organization={organization} />}
    </Modal>
  );
}

function OrganizationContracts({ organization }: { organization: ApiOrganization }) {
  const versions = contractHooks.useList({ organization: organization.id });
  const start = useStartContractDraft();
  const save = useSaveContractDraft();
  const publish = usePublishContract();
  const remove = contractHooks.useDelete();

  if (versions.isPending) return <InlineLoading />;
  if (versions.isError) {
    if (contractAgreementRequired(versions.error) !== null) {
      return (
        <Alert color="yellow" title="Agree to its terms first">
          You haven’t agreed to {organization.name}’s latest terms yet.{' '}
          <Link
            to="/admin/organization/$organizationId/event"
            params={{ organizationId: String(organization.id) }}
          >
            Open {organization.name}
          </Link>{' '}
          to read and agree to them, then come back here to change them.
        </Alert>
      );
    }
    return <Alert color="red">{apiErrorMessage(versions.error)}</Alert>;
  }

  const draft = versions.data.find((version) => version.published_at === null);
  const published = versions.data
    .filter((version) => version.published_at !== null)
    .sort((a, b) => (b.number ?? 0) - (a.number ?? 0));
  const nextNumber = (published[0]?.number ?? 0) + 1;
  const draftError = save.isError
    ? apiErrorMessage(save.error)
    : publish.isError
      ? apiErrorMessage(publish.error)
      : null;

  return (
    <Stack>
      <Text size="sm">
        Everyone who signs in must agree to {organization.name}’s latest version before they can
        reach it. Its privacy policy is also public, linked from registration.
      </Text>
      {draft ? (
        <ContractDraftEditor
          key={draft.id}
          organizationName={organization.name}
          saved={draft.sections}
          nextNumber={nextNumber}
          saving={save.isPending}
          publishing={publish.isPending}
          deleting={remove.isPending}
          error={draftError}
          onSave={(sections) => save.mutate({ id: draft.id, version: draft.version, sections })}
          onPublish={() =>
            publish.mutate(
              { id: draft.id, version: draft.version },
              {
                onSuccess: (contract) =>
                  notifications.show({
                    color: 'green',
                    message: `Published version ${contract.number}. Everyone else has been signed out, and will be asked to agree to it.`,
                  }),
              },
            )
          }
          onDelete={() => remove.mutate({ id: draft.id, version: draft.version })}
        />
      ) : (
        <Group>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => start.mutate(organization.id)}
            loading={start.isPending}
          >
            {published.length ? 'Start a new version' : 'Write the first version'}
          </Button>
          {published.length > 0 && (
            <Text size="sm" c="dimmed">
              It starts as a copy of version {published[0].number}.
            </Text>
          )}
        </Group>
      )}
      {published.length > 0 && <PublishedVersions versions={published} />}
    </Stack>
  );
}

function PublishedVersions({ versions }: { versions: ApiContract[] }) {
  return (
    <Stack gap="xs">
      <Text fw={500}>Published versions</Text>
      <Accordion variant="separated">
        {versions.map((version, index) => (
          <Accordion.Item key={version.id} value={String(version.id)}>
            <Accordion.Control>
              <Group gap="xs">
                <Text>Version {version.number}</Text>
                {index === 0 && (
                  <Badge size="sm" variant="light">
                    Latest
                  </Badge>
                )}
                <Text size="sm" c="dimmed">
                  effective {formatEffectiveDate(version.published_at!)}
                  {version.published_by_name ? `, by ${version.published_by_name}` : ''} ·{' '}
                  {version.agreement_count} agreed
                </Text>
              </Group>
            </Accordion.Control>
            <Accordion.Panel>
              <Stack>
                <ContractText sections={version.sections} />
                <Text fw={500}>Who has agreed</Text>
                <ContractAgreements contractId={version.id} />
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>
    </Stack>
  );
}

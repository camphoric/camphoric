import React from 'react';
import api, {
  useEvent,
  useRegistrationLookup,
  useRegistrationTypeLookup,
  useInvitationLookup,
} from 'hooks/api';
import Spinner from 'components/Spinner';
import { formatDateTimeForViewing } from 'utils/time';
import {
  Badge,
  Table,
  Button,
  Overlay,
  Popover,
} from 'react-bootstrap';
import { Link, useRouteMatch } from 'react-router-dom';
import ConfirmDialog from 'components/Modal/ConfirmDialog';

const formatDate = formatDateTimeForViewing('MM/DD h:ssa');

function InvitationReport() {
  const eventApi = useEvent();
  const { url } = useRouteMatch();
  const deleteModal  = React.useRef<ConfirmDialog>(null);
  const [selectedInvitation, setSelectedInvitation] = React.useState<ApiInvitation>();
  const [popoverTarget, setPopoverTarget] = React.useState<HTMLElement>();

  const invitationLookup = useInvitationLookup();
  const registrationTypeLookup = useRegistrationTypeLookup();

  const [sendInvitation] = api.useSendInvitationMutation();
  const [deleteInvitation] = api.useDeleteInvitationMutation();
  const registrationLookup = useRegistrationLookup();

  if (eventApi.isFetching || eventApi.isLoading || !eventApi.data) return <Spinner />;
  if (!invitationLookup) return <Spinner />;
  if (!registrationTypeLookup) return <Spinner />;
  if (!registrationLookup) return <Spinner />;

  const sent = (i: ApiInvitation) => {
    if (i.sent_time) {
      return formatDate(i.sent_time)
    }

    return getStatus(i);
  };


  return (
    <>
      <Table striped bordered hover>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Type</th>
            <th>Sent</th>
            <th>Registration</th>
          </tr>
        </thead>
        <tbody>
          {
            Object.values(invitationLookup)
              .sort((a, b) => compareDates(b.created_at, a.created_at))
              .map(
                i => {
                  return (
                    <tr key={i.id}>

                      <td>{i.recipient_name}</td>
                      <td>{i.recipient_email}</td>
                      <td>{i.registration_type && registrationTypeLookup[i.registration_type].label}</td>
                      <td>{i.sent_time ? 'Yes' : '-'}</td>
                      <td>
                        {
                          i.registration && registrationLookup[i.registration] ?
                          <Link to={`${url}?registrationId=${i.registration}&registrationsTab=reg_edit`}>
                            View/Edit
                          </Link>
                          : <Badge variant="danger">None</Badge>
                        }
                      </td>
                      <td>
                        <Button
                          variant="secondary"
                          onClick={(e) => {
                            setSelectedInvitation(i);
                            // @ts-ignore
                            setPopoverTarget(e.target);
                          }}
                        >
                          ⚙
                        </Button>
                      </td>
                    </tr>
                  )
                }
              )
          }
        </tbody>
      </Table>
      {
        popoverTarget && selectedInvitation && (
          <Overlay
            target={popoverTarget}
            rootClose
            show
            placement="left"
            onHide={() => setPopoverTarget(undefined)}
          >
            <Popover id={`invitation-info-${selectedInvitation.id}`}>
              <Popover.Title as="h3">Invitation for {selectedInvitation.recipient_name}</Popover.Title>
              <Popover.Content>
                <div>Sent { sent(selectedInvitation) }</div>
                <hr />
                <Button onClick={() => {
                  sendInvitation(selectedInvitation.id);
                  setPopoverTarget(undefined);
                }}>Resend Invitation</Button>
                <hr />
                <Button variant="danger" onClick={() => {
                  deleteModal.current?.show();
                  setPopoverTarget(undefined);
                }}>
                  Delete Invitation
                </Button>
              </Popover.Content>
            </Popover>
          </Overlay>
        )
      }
      <ConfirmDialog
        ref={deleteModal}
        title={`Delete invitation for "${selectedInvitation && selectedInvitation.recipient_name}"?`}
        onConfirm={() => {
          selectedInvitation && deleteInvitation(selectedInvitation)
          setSelectedInvitation(undefined);
        }}
      />
    </>
  );
}

function getStatus(invitation: ApiInvitation) {
  if (invitation.registration) return 'redeemed';
  if (!invitation.sent_time) return 'unsent';
  if (!invitation.sent_time) return 'unsent';

  // if invitation.expiration_time ...
  return 'sent';
}

function compareDates(a: string | null, b: string | null) {
  const dateA = new Date(a || '').getMilliseconds();
  const dateB = new Date(b || '').getMilliseconds();

  return dateA - dateB;
}

export default InvitationReport;

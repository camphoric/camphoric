import React from 'react';
import api from 'store/api';
import { useEvent, useRegistrationLookup } from 'hooks/api';
import Spinner from 'components/Spinner';
import { formatDateTimeForViewing } from 'utils/time';
import { Button } from 'react-bootstrap';
import { Link, useRouteMatch } from 'react-router-dom';

function InvitationReport() {
  const eventApi = useEvent();
  const { url } = useRouteMatch();

  const invitationsApi = api.useGetInvitationsQuery();
  const registrationTypesApi = api.useGetRegistrationTypesQuery();
  const [sendInvitation] = api.useSendInvitationMutation();
  const registrationLookup = useRegistrationLookup();

  if (eventApi.isFetching || eventApi.isLoading || !eventApi.data) return <Spinner />;
  if (invitationsApi.isFetching || invitationsApi.isLoading || !invitationsApi.data) return <Spinner />;
  if (registrationTypesApi.isFetching || registrationTypesApi.isLoading || !registrationTypesApi.data) return <Spinner />;

  const eventId = eventApi.data.id;
  const regTypeIds = registrationTypesApi.data
    .filter(r => r.event === eventId)
    .map(r => r.id);

  const regTypeLookup = registrationTypesApi.data
    .filter(r => r.event === eventId)
    .reduce(
      (acc, t) => ({
        ...acc,
        [t.id]: t.label,
      }),
      {} as { [a: string]: string },
    );

  const formatDate = formatDateTimeForViewing('MM/DD h:ssa');
  const sent = (i: ApiInvitation) => {
    if (i.sent_time) {
      return formatDate(i.sent_time)
    }

    return getStatus(i);
  };

  return (
    <table>
      <thead>
        <tr>
          <th>Email</th>
          <th>Name</th>
          <th>Type</th>
          <th>Sent</th>
          <th>Resend</th>
          <th>Registration</th>
        </tr>
      </thead>
      <tbody>
        {
          invitationsApi.data
            .filter(i => i.registration_type && regTypeIds.includes(i.registration_type))
            .sort((a, b) => compareDates(b.created_at, a.created_at))
            .map(
              i => (
                <tr key={i.id}>
                  <td>{i.recipient_email}</td>
                  <td>{i.recipient_name}</td>
                  <td>{i.registration_type && regTypeLookup[i.registration_type]}</td>
                  <td>{sent(i)}</td>
                  <td>
                    <Button onClick={() => sendInvitation(i.id)}>📧</Button>
                  </td>
                  <td>
                    {
                      i.registration && registrationLookup[i.registration] ?
                      <Link to={`${url}?registrationId=${i.registration}&registrationsTab=reg_edit`}>
                        View/Edit
                      </Link>
                      : 'NOT REGISTERED'
                    }
                  </td>
                </tr>
              )
            )
        }
      </tbody>
    </table>
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

import React from 'react';
import api from 'store/api';
import { useEvent } from 'hooks/api';
import Spinner from 'components/Spinner';

function InvitationReport() {
  const eventApi = useEvent();

  const invitationsApi = api.useGetInvitationsQuery();
  const registrationTypesApi = api.useGetRegistrationTypesQuery();

  if (eventApi.isFetching || eventApi.isLoading || !eventApi.data) return <Spinner />;
  if (invitationsApi.isFetching || invitationsApi.isLoading || !invitationsApi.data) return <Spinner />;
  if (registrationTypesApi.isFetching || registrationTypesApi.isLoading || !registrationTypesApi.data) return <Spinner />;

  const eventId = eventApi.data.id;
  const regTypeIds = registrationTypesApi.data
    .filter(r => r.event === eventId)
    .map(r => r.id);

  return (
    <table>
      <thead>
        <tr>
          <th>Email</th>
          <th>Name</th>
          <th>Type</th>
          <th>Sent</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {
          invitationsApi.data.filter(i => regTypeIds.includes(i.id)).map(
            i => (
              <tr key={i.id}>
                <td>{i.recipient_email}</td>
                <td>{i.recipient_name}</td>
                <td>{i.registration_type}</td>
                <td>{i.sent_time}</td>
                <td>{getStatus(i)}</td>
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

export default InvitationReport;

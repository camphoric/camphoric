import React from 'react';

interface Props {
  invitations: Array<ApiInvitation>,
}

function InvitationReport({ invitations }: Props) {

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
          invitations.map(
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

import React from 'react';
import { Alert } from 'react-bootstrap';
import api from 'store/register/api';
import Spinner from 'components/Spinner';

function InvitationInfo() {
  const registrationApi = api.useGetRegistrationQuery();

  if (
    registrationApi.isFetching ||
    registrationApi.isLoading ||
    !registrationApi.data
  ) return <Spinner />;


  const { invitation, invitationError, registrationType } = registrationApi.data;

  return (
    <React.Fragment>
      {
        !!invitation &&
        <Alert variant="success">
          <p>
            { `Welcome, ${invitation.recipient_name || invitation.recipient_email}!` }
          </p>
          <p>
            {
              !!registrationType &&
              `Special registration: ${registrationType.label}`
            }
          </p>
        </Alert>
      }
      {
        !!invitationError &&
        <Alert variant="warning">
          { invitationError }
        </Alert>
      }
    </React.Fragment>
  );
}

export default InvitationInfo;

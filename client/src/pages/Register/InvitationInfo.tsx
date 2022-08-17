import React from 'react';
import { Alert } from 'react-bootstrap';

import { type FormDataState } from './index';

interface Props {
  config: FormDataState['config'];
}

function InvitationInfo(props: Props) {
  const { invitation, invitationError, registrationType } = props.config;

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

import React from 'react';
import {
  Container,
  Row,
  Col,
} from 'react-bootstrap';
import { apiFetch } from 'utils/fetch';
import Spinner from 'components/Spinner';

import ControlColumn from './ControlColumn';
import InvitationReport from './InvitationReport';
import { InvitePostValues } from './InviteModal';
import { RegTypePostValues } from './RegTypeModal';

function SpecialRegTab({ event, ...props }: EventAdminPageProps) {
  const [registrationTypes, setRegistrationTypes] = React.useState<ApiRegistrationType[] | null>(null);
  const [invitations, setInvitations] = React.useState<ApiInvitation[] | null>(null);
  const [fetching, setFetching] = React.useState<boolean>(true);

  const getValues = async () => {
    setFetching(true);
    try {
      const [regTypeResponse, invitationResponse] = await Promise.all([
        apiFetch('/api/registrationtypes/'),
        apiFetch('/api/invitations/'),
      ]);

      setRegistrationTypes(await regTypeResponse.json());
      setInvitations(await invitationResponse.json());
    } catch (error) {
      console.error('error', error);
    } finally {
      setFetching(false);
    }
  };

  const newInvitation = async (values: InvitePostValues) => {
    setFetching(true);
    try {
      await apiFetch('/api/invitations/', 'POST', {
        event: event.id,
        ...values
      });
    } catch (error) {
      console.error('error /api/invitations/ POST', error);
    } finally {
      await getValues();
      setFetching(false);
    }
  }

  const newRegType = async (values: RegTypePostValues) => {
    setFetching(true);
    const method = values.id ? 'PUT' : 'POST';
    let url = '/api/registrationtypes/';

    try {
      if (values.id) {
        url = `${url}${values.id}/`;
      }

      await apiFetch(url, method, {
        event: event.id,
        ...values
      });
    } catch (error) {
      console.error(`error ${url} ${method}`, error);
    } finally {
      await getValues();
      setFetching(false);
    }
  }

  const deleteRegType = async (id: string | number) => {
    setFetching(true);
    try {
      await apiFetch(`/api/registrationtypes/${id}`, 'DELETE');
    } catch (error) {
      console.error('error /api/registrationtypes/ POST', error);
    } finally {
      await getValues();
      setFetching(false);
    }
  }

  React.useEffect(() => {
    getValues();
  }, [event.id]);

  if (fetching || !registrationTypes || !invitations) return <Spinner />;

  // console.log(registrationTypes, invitations);

  return (
    <Container className="special-registration">
      <Row>
        <Col md={3}>
          <ControlColumn
            registrationTypes={registrationTypes}
            newInvitation={newInvitation}
            newRegType={newRegType}
            deleteRegType={deleteRegType}
          />
        </Col>
        <Col md={9}>
          <InvitationReport invitations={invitations} />
        </Col>
      </Row>
    </Container>
  );
}

export default SpecialRegTab;

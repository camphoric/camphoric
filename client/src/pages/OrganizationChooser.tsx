import React from 'react';
import { Link, useLocation } from 'react-router-dom';

import { Container, Row, Col } from 'react-bootstrap';

import Spinner from 'components/Spinner';
import api from 'store/api';

function OrganizationChooser() {
  const organizationsApi = api.useGetOrganizationsQuery();

  if (organizationsApi.isFetching || organizationsApi.isLoading) return <Spinner />;

  const organizations = organizationsApi.data || [];

  return (
    <Container><Row className="justify-content-md-center"><Col>
      <ul>
        {
          organizations.map(
            (org) => (
              <li key={org.id}>
                <Link to={`/admin/organization/${org.id}/event`}>{org.name}</Link>
              </li>
            )
          )
        }
      </ul>
    </Col></Row></Container>
  );
};

export default OrganizationChooser;

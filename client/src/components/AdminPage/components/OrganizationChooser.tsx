import React from 'react';
import { Link, useLocation } from 'react-router-dom';

import { Container, Row, Col } from 'react-bootstrap';

import { useOrganizations } from '../hooks';
import Spinner from '../../Spinner';

function OrganizationChooser() {
  const { pathname } = useLocation();
  const organizations = useOrganizations();

  if (organizations.status !== 'done') return <Spinner />;

  return (
    <Container><Row className="justify-content-md-center"><Col>
      <ul>
        {
          organizations.value.map(
            (org) => (
              <li key={org.id}>
                <Link to={`${pathname}/${org.id}/event`}>{org.name}</Link>
              </li>
            )
          )
        }
      </ul>
    </Col></Row></Container>
  );
};

export default OrganizationChooser;

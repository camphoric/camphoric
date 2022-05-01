import React from 'react';
import { Navbar, Nav } from 'react-bootstrap';

import { Link, useRouteMatch, useLocation } from 'react-router-dom';
import {
  useOrganization,
  useEvent,
  useUrlParams,
} from 'store/hooks';

import { RouteList } from '../RouterConfig';

interface Props {
  routes: RouteList;
}

function ExportedNavBar (props: Props) {
  const organizationApi = useOrganization();
  const eventApi = useEvent();
  const { organizationId, eventId } = useUrlParams();

  const { url } = useRouteMatch();
  const { pathname } = useLocation();

  const selected = pathname.split('/').pop();

  const subtitle = organizationApi.data?.name ?
    `(${organizationApi.data?.name})` : ''

  const homeUrl = `/admin/organization/${organizationId}/event/${eventId}/home`

  return(
    <Navbar bg="light" expand="lg">
      <Navbar.Brand as={Link} to={homeUrl}>
        {eventApi.data?.name}
        <div className="navbar-subtitle">{subtitle}</div>
      </Navbar.Brand>
      <Navbar.Toggle aria-controls="basic-navbar-nav" />
      <Navbar.Collapse id="basic-navbar-nav">
        <Nav className="mr-auto">
          {
            props.routes.map(
              ([route, title]) => (
                <Nav.Link
                  className={route === selected ? 'selected' : ''}
                  key={route}
                  as={Link}
                  to={`${url}/${route}`}
                >
                  {title}
                </Nav.Link>
              )
            )
          }
        </Nav>
      </Navbar.Collapse>
    </Navbar>
  );
}

export default ExportedNavBar;

import React from 'react';
import { Link } from 'react-router-dom';

import { Navbar, Nav } from 'react-bootstrap';

import { RouteList } from '../EventAdmin';
import { useOrganizations } from '../hooks';

interface Props {
  routes: RouteList;
  event: ApiEvent;
  homeUrl: string;
  url: string;
}

function ExportedNavBar (props: Props) {
  const organization =
    useOrganizations().value.find(o => o.id === props.event.organization)
    || { name: '' };

  return(
    <Navbar bg="light" expand="lg">
      <Navbar.Brand as={Link} to={props.homeUrl}>
        {props.event.name}
        <div className="navbar-subtitle">({organization.name})</div>
      </Navbar.Brand>
      <Navbar.Toggle aria-controls="basic-navbar-nav" />
      <Navbar.Collapse id="basic-navbar-nav">
        <Nav className="mr-auto">
          {
            props.routes.map(
              ([route, title]) => (
                <Nav.Link key={route} as={Link} to={`${props.url}/${route}`}>{title}</Nav.Link>
              )
            )
          }
        </Nav>
      </Navbar.Collapse>
    </Navbar>
  );
}

export default ExportedNavBar;

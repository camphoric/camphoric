import React from 'react';
import { Link } from 'react-router-dom';
import { Container, Row, Col } from 'react-bootstrap';

function Splash(props: {}) {
  return (
    <Container><Row className="justify-content-md-center"><Col>
      <h1>Camphoric!</h1>
      <p><Link to="/events/1/register">Registration Page (event 1)</Link></p>
      <p><Link to="/admin">Admin Page</Link></p>
    </Col></Row></Container>
  );
}

export default Splash;

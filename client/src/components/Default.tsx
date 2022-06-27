import React from 'react';
import { Link } from 'react-router-dom';
import { Container, Row, Col } from 'react-bootstrap';
import Spinner from 'components/Spinner';

type EventListItem = {
  name: string,
  open: boolean,
  url: string,
};

function Splash(props: {}) {
  const [eventList, setEventList] = React.useState<Array<EventListItem> | void>();

  React.useEffect(() => {
    fetch('/api/eventlist')
      .then(r => r.json())
      .then(setEventList);
  }, []);

  if (!eventList) return <Spinner />;

  return (
    <Container><Row className="justify-content-md-center"><Col>
      <h1>Camphoric!</h1>
      {
        eventList.map((event: EventListItem) => (
          <p key={event.url}>
            <Link to={event.url}>{event.name} {!event.open ? "(closed)" : ""}</Link>
          </p>
        ))
      }
      <p><Link to="/admin">Admin Page</Link></p>
    </Col></Row></Container>
  );
}

export default Splash;

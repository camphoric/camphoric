import React from 'react';
import { Link, useRouteMatch } from 'react-router-dom';
import { Card } from 'react-bootstrap';
import Fuse from 'fuse.js';

interface Props {
  result: Fuse.FuseResult<AugmentedRegistration>;
  selected: boolean;
  resultLabel: string;
}

const label = (c: ApiCamper) => `${c.attributes.first_name} ${c.attributes.last_name}`

function RegistrationSearchResult({ result, ...props }: Props) {
  const { url } = useRouteMatch();
  const registration = result.item;

  return (
    <Card
      className={props.selected ? 'selected' : ''}
      as={Link}
      to={`${url}?registrationId=${registration.id}`}
    >
      <Card.Header>{props.resultLabel}</Card.Header>
      <Card.Body>
        <Card.Text>
          {
            !!registration.registrationType && (
              <div><em>{registration.registrationType.label}</em></div>
            )
          }
          { registration.campers.slice(1).map(c => label(c)).join('; ') }
        </Card.Text>
      </Card.Body>
    </Card>
  );
}

export default RegistrationSearchResult;

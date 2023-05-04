import React from 'react';
import { Link, useRouteMatch } from 'react-router-dom';
import { Card } from 'react-bootstrap';
import Fuse from 'fuse.js';

interface Props {
  result: Fuse.FuseResult<ApiCamper>;
  selected: boolean;
}

const label = (c: ApiCamper) => `${c.attributes.first_name} ${c.attributes.last_name}`

function CamperSearchResult({ result, ...props }: Props) {
  const { url } = useRouteMatch();
  const camper = result.item;

  return (
    <Card
      className={props.selected ? 'selected' : ''}
      as={Link}
      to={`${url}?camperId=${camper.id}`}
    >
      <Card.Header>{ label(camper) }</Card.Header>
    </Card>
  );
}

export default CamperSearchResult;

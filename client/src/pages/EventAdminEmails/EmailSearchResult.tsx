import React from 'react';
import { Link, useRouteMatch } from 'react-router-dom';
import { Card } from 'react-bootstrap';

interface Props {
  result: ApiReport;
  selected: boolean;
}

function ReportSearchResult({ result, ...props }: Props) {
  const { url } = useRouteMatch();

  return (
    <Card
      className={props.selected ? 'selected' : ''}
      as={Link}
      to={`${url}?reportId=${result.id}`}
    >
      <Card.Header>{ result.title }</Card.Header>
    </Card>
  );
}

export default ReportSearchResult;

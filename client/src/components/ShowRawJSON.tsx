import React from 'react';
import {
  Button,
  Collapse,
} from 'react-bootstrap';

interface Props {
  show?: boolean,
  json?: Object,
  label?: string,
}

export default function ShowRawJSON({ show, json, label }: Props) {
  const [showRawJson, setShowRawJson] = React.useState(show);

  if (import.meta.env.NODE_ENV === 'production') return null;

  return (
    <div className="event-admin-show-raw">
      <Button
        variant="outline-primary"
        size="sm"
        onClick={() => setShowRawJson(!showRawJson)}
        aria-expanded={showRawJson}
      >
        { showRawJson ? 'Hide' : 'Show' } Raw JSON { label ? `for ${label}` : '' }
      </Button>
      <Collapse in={showRawJson}>
        <pre className="event-admin-raw-json">{JSON.stringify(json, null, 2)}</pre>
      </Collapse>
    </div>
  );
}

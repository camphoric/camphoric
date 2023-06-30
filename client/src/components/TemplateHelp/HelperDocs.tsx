import React from 'react';
import {
  Row, Col,
  Card
} from 'react-bootstrap';

import helpers from 'components/Template/handlebarsHelpers';

function HelperDocs() {
  return (
    <div>
      There are special helper functions when using handlebars templates called
      "helpers"
      . <a href="https://handlebarsjs.com/guide/builtin-helpers.html">
        Handlebars has a few built-in helpers detailed in their docs
      </a>, and in addition to that, we have added some of our own here:
      {
        Object.entries(helpers).sort().map(
          ([key, [help, fn]]) => {
            const [
              exampleCode,
              exampleCodeResult,
              description,
            ] = help.trim().split(/\r?\n/);

            return (
              <Card key={key}>
                <Card.Body>
                  <Card.Title>{key}</Card.Title>
                  <Card.Text>
                    <div className="helper-description">{description}</div>
                    <Row>
                      <Col>
                        Example template:
                        <div className="helper-example-code sample">{exampleCode}</div>
                      </Col>
                      <Col>
                        Results:
                        <div className="helper-example-code result">{exampleCodeResult}</div>
                      </Col>
                    </Row>
                  </Card.Text>
                </Card.Body>
              </Card>
            );
          },
        )
      }
    </div>
  );
}

export default HelperDocs;

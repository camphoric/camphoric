import React from 'react';
import { FieldProps } from '@rjsf/core';
import uniq from 'lodash/uniq';
import { getAllStrings } from 'utils/display';

function LodgingRequestedErrors (props: FieldProps) {
  if (!Object.values(props.errorSchema).length) {
    return null;
  }

  const errorMessages = uniq(getAllStrings(props.errorSchema));
  
  return (
    <small className="m-0 text-danger">
      {
        errorMessages.map((e: string) => (
          <div key={e} className="field-description">
            <div className="md-template">
              <p>{e}</p>
            </div>
          </div>
        ))
      }
    </small>
  );
}

export default LodgingRequestedErrors;

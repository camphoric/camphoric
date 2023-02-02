import React from 'react';
// import { FieldProps } from '@rjsf/core';
import uniq from 'lodash/uniq';

type Props = {
  errors: Array<string>,
}

function AddressFieldErrors ({ errors }: Props) {
  if (!errors.length) {
    return null;
  }

  return (
    <small className="m-0 text-danger">
      {
        uniq(errors).map((e: string) => (
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

export default AddressFieldErrors;

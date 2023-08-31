import React from 'react';

import debug from 'utils/debug';
import { Spinner } from 'react-bootstrap';
import { useRegFormData } from 'store/register/store';

function PriceTicker() {
  const regFormData = useRegFormData();

  return (
    <div className="PriceTicker">
      {
        !!regFormData.updating && (
          <Spinner style={{ position: 'absolute', color: 'rgba(0, 0, 0, 0.4)' }} animation="border" role="status" />
          )
      }
      <div>Total: ${(regFormData.totals.total || 0).toFixed(2)}</div>
    </div>
  );
}

export default PriceTicker;

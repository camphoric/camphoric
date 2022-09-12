import React from 'react';

import {
  Button,
} from 'react-bootstrap';
import Spinner from 'components/Spinner';
import {
  formatDateTimeForViewing,
} from 'utils/time';
import getFromPath from 'lodash/get';

import api from 'hooks/api';

import AddPaymentFormModal from './AddPaymentFormModal';

interface Props {
  event: ApiEvent;
  registration: AugmentedRegistration;
}


function PaymentTab(props: Props) {
  const paymentApi = api.useGetPaymentsQuery();
  const [showAddPayment, setShowAddPayment] = React.useState(false);

  if (paymentApi.isLoading || !paymentApi.data) return <Spinner />;

  const payments = paymentApi.data.filter(
    p => p.registration === props.registration.id
  );

  const showAddPaymentModal = () => setShowAddPayment(true);

  const paymentSchema = getFromPath(props, 'event.payment_schema.properties', { properties: {} });
  const keys = Object.keys(paymentSchema.properties).sort();

  return (
    <div>
      <p>
        <div>
          Payment Type at Registration: {
            props.registration.payment_type || 'None'
          }
        </div>
        <div>Total Owed: ${props.registration.total_owed}</div>
        <div>Total Payments: ${props.registration.total_payments}</div>
        <div>Balance Due: ${props.registration.total_balance}</div>
      </p>
      {
        payments.length <= 0 ? (
          <p>
            No payments at this time
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>type</th>
                <th>paid</th>
                <th>amount</th>
                {
                  keys.map((k) => (
                    <th>{paymentSchema[k].title}</th>
                  ))
                }
              </tr>
            </thead>
            <tbody>
              {
                payments.map(p => (
                  <tr>
                    <td>{p.payment_type}</td>
                    <td>{formatDateTimeForViewing(p.paid_on)}</td>
                    <td>${p.amount}</td>
                    {
                      keys.map((k) => (
                        <td>{p.attributes && p.attributes[k]}</td>
                      ))
                    }
                  </tr>
                ))
              }
            </tbody>
          </table>
        )
      }
      <p className="button-container">
        <Button onClick={showAddPaymentModal}>Add Payment</Button>
      </p>
      <AddPaymentFormModal
        event={props.event}
        registration={props.registration}
        show={showAddPayment}
        onClose={() => setShowAddPayment(false)}
        onSave={() => setShowAddPayment(false)}
      />
    </div>
  );
}

export default PaymentTab;


import React from 'react';

import {
  Button,
} from 'react-bootstrap';
import Spinner from 'components/Spinner';
import {
  formatDateTimeForViewing,
} from 'utils/time';
import debug from 'utils/debug';
import getFromPath from 'lodash/get';

import { usePaymentsLookup } from 'hooks/api';
import { moneyFmt } from 'utils/display';

import AddPaymentFormModal from './AddPaymentFormModal';

interface Props {
  event: ApiEvent;
  registration: AugmentedRegistration;
}

type RegistrationFeeEntry = {
  exp: object,
  var: string,
  lable: string,
};

function PaymentTab(props: Props) {
  const allPayments = usePaymentsLookup();
  const [showAddPayment, setShowAddPayment] = React.useState(false);

  if (!allPayments) return <Spinner />;

  const { registration, event } = props;

  const payments = Object.values(allPayments).filter(
    p => p.registration === registration.id
  );

  const showAddPaymentModal = () => setShowAddPayment(true);

  const paymentSchema = getFromPath(props, 'event.payment_schema.properties', { properties: {} });
  const keys = Object.keys(paymentSchema.properties).sort();

  const formatDate = formatDateTimeForViewing();

  const registrationFees = registration.server_pricing_results;
  const registrationFeeLabel = (k: string) => {
    const r = event.registration_pricing_logic.find((kv: RegistrationFeeEntry) => kv.var === k);
    const c = event.camper_pricing_logic.find((kv: RegistrationFeeEntry) => kv.var === k);

    return r?.label || c?.label || k;
  };

  debug('EventAdminRegistrations-PaymentTab', {
    allPayments,
    payments,
    paymentSchema,
    registration,
    registrationFeeLabel,
    event,
  });

  return (
    <div>
      <div>
        <div>
          Payment Type at Registration: {
            props.registration.payment_type || 'None'
          }
        </div>
        {
          Object.keys(registrationFees).filter(k => !['total', 'campers'].includes(k)).map(
            (k) => (<div key={k}>
              {registrationFeeLabel(k)}: ${moneyFmt(registrationFees[k])}
            </div>)
          )
        }
        <hr />
        <div>Total Owed: ${moneyFmt(props.registration.total_owed)}</div>
        <div>Total Payments: ${moneyFmt(props.registration.total_payments)}</div>
        <div>Balance Due: ${moneyFmt(props.registration.total_balance)}</div>
      </div>
      <hr />
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
                    <td>{formatDate(p.paid_on)}</td>
                    <td>${moneyFmt(p.amount)}</td>
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


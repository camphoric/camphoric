import React from 'react';

import {
  Button,
} from 'react-bootstrap';
import Spinner from 'components/Spinner';
import Modal from 'components/Modal';
import JsonSchemaForm from 'components/JsonSchemaForm';
import Input, { Money, Select } from 'components/Input';
import { formatDateTimeForApi, formatDateTimeForViewing } from 'utils/time';
import getFromPath from 'lodash/get';

import api from 'hooks/api';

interface Props {
  event: ApiEvent;
  registration: AugmentedRegistration;
}

function PaymentTab(props: Props) {
  const paymentApi = api.useGetPaymentsQuery();
  const [createPayment, createPaymentResult] = api.useCreatePaymentMutation();
  const modalRef = React.useRef<Modal>(null);
  const [paymentAttributes, setPaymentAttributes] = React.useState({});
  const [paymentAmount, setPaymentAmount] = React.useState(0);
  const [paymentDate, setPaymentDate] = React.useState('');
  const [paymentType, setPaymentType] = React.useState('Check');

  if (paymentApi.isLoading || !paymentApi.data) return <Spinner />;
  if (createPaymentResult.isLoading) return <Spinner />;

  const payments = paymentApi.data.filter(
    p => p.registration === props.registration.id
  );

  const handleChange = (setter: Function) => (changeEvent: React.ChangeEvent<HTMLInputElement>) => {
    let { value } = changeEvent.target;

    if (!value) return;

    setter(value);
  };

  const showAddPaymentModal = () => modalRef.current && modalRef.current.show();
  const handleSaveNewPayment = () => {
    const dateValue = formatDateTimeForApi(paymentDate) || null;
    const data = {
      registration: props.registration.id,
      payment_type: paymentType,
      paid_on: dateValue,
      attributes: paymentAttributes,
      deposit: null,
      amount: Number(paymentAmount) || 0,
    };

    try {
      createPayment(data);
    } catch (e) {
      console.error(e);
    }

    setPaymentAttributes({});
    setPaymentAmount(0);
    setPaymentDate('');
  };

  // # from payments
  // paid_on = models.DateTimeField(null=True)
  // attributes = models.JSONField(null=True)
  // amount = models.DecimalField(max_digits=7, decimal_places=2, default=Decimal('0.00'))

  const paymentSchema = getFromPath(props, 'event.payment_schema.properties', { properties: {} });
  const keys = Object.keys(paymentSchema).sort();

  return (
    <div>
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
      <p>
        <Button onClick={showAddPaymentModal}>Add Payment</Button>
      </p>
      <Modal
        ref={modalRef}
        title="Add Payment"
        saveButtonLabel="Add new payment"
        handleSave={handleSaveNewPayment}
      >
        <div>
            <Select
              label="Type"
              options={[
                'Check',
                'PayPal',
              ].map(v => ({ label: v, value: v }))}
              onChange={handleChange(setPaymentType)}
            />
            <Input
              label="Paid date"
              onChange={handleChange(setPaymentDate)}
              type="date"
              defaultValue={paymentDate}
            />
            <Money
              label="Amount"
              onChange={handleChange(setPaymentAmount)}
              defaultValue={paymentAmount}
            />
            <JsonSchemaForm
              schema={paymentSchema}
              onChange={(f) => setPaymentAttributes(f.formData)}
              onSubmit={handleSaveNewPayment}
              onError={() => console.log("errors")}
              formData={paymentAttributes}
              templateData={{}}
            >
              <span />
            </JsonSchemaForm>
        </div>
      </Modal>
    </div>
  );
}

export default PaymentTab;


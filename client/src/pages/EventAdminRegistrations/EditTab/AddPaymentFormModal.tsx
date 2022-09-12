import React from 'react';

import Spinner from 'components/Spinner';
import Modal from 'components/Modal';
import JsonSchemaForm from 'components/JsonSchemaForm';
import Input, { Money, Select } from 'components/Input';
import {
  formatDateTimeForApi,
  formatDateTimeForForm,
} from 'utils/time';
import getFromPath from 'lodash/get';

import api from 'hooks/api';

interface Props {
  event: ApiEvent;
  registration: AugmentedRegistration;
  show: boolean;
  onClose: () => any;
  onSave: () => any;
}


const defaultDate = () => formatDateTimeForForm(new Date().toISOString()) as string;

function AddPaymentForm(props: Props) {
  const paymentApi = api.useGetPaymentsQuery();
  const [createPayment, createPaymentResult] = api.useCreatePaymentMutation();
  const [paymentAttributes, setPaymentAttributes] = React.useState({});
  const [paymentAmount, setPaymentAmount] = React.useState(0);
  const [paymentDate, setPaymentDate] = React.useState(defaultDate());
  const [paymentType, setPaymentType] = React.useState('Check');

  if (paymentApi.isLoading || !paymentApi.data) return <Spinner />;
  if (createPaymentResult.isLoading) return <Spinner />;

  const handleChange = (setter: Function) => (changeEvent: React.ChangeEvent<HTMLInputElement>) => {
    let { value } = changeEvent.target;

    if (!value) return;

    setter(value);
  };

  const handleSaveNewPayment = () => {
    const dateValue = formatDateTimeForApi(paymentDate || defaultDate()) as string;
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
    setPaymentDate(defaultDate());

    props.onSave();
  };

  const paymentSchema = getFromPath(props, 'event.payment_schema.properties', { properties: {} });

  return (
    <Modal
      show={props.show}
      onClose={props.onClose}
      title="Add Payment"
      saveButtonLabel="Add new payment"
      onSave={handleSaveNewPayment}
    >
      <div>
          <Select
            label="Type"
            options={[
              'Check',
              'PayPal',
              'Card',
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
  );
}

export default AddPaymentForm;



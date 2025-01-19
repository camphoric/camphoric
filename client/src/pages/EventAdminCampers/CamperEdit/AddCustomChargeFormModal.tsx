import React from 'react';

import Spinner from 'components/Spinner';
import Modal from 'components/Modal';
import Input, { Money, Select } from 'components/Input';

import api from 'hooks/api';

interface Props {
  event: ApiEvent;
  camper: ApiCamper;
  show: boolean;
  onClose: () => any;
  onSave: () => any;
}


function AddCustomChargeForm(props: Props) {
  const customChargeTypeApi = api.useGetCustomChargeTypesQuery();
  const [createCustomCharge, createCustomChargeResult] = api.useCreateCustomChargeMutation();

  const [customChargeAmount, setCustomChargeAmount] = React.useState(0);
  const [customChargeType, setCustomChargeType] = React.useState(0);
  const [customChargeNotes, setCustomChargeNotes] = React.useState('');

  if (customChargeTypeApi.isLoading || !customChargeTypeApi.data) return <Spinner />;
  if (createCustomChargeResult.isLoading) return <Spinner />;

  const customChargeTypes = customChargeTypeApi.data;

  if (!customChargeTypes.length) return (<div>No custom charge types defined</div>);

  const handleChange = (setter: Function) => (changeEvent: React.ChangeEvent<HTMLInputElement>) => {
    let { value } = changeEvent.target;

    if (!value) return;

    setter(value);
  };

  const handleSaveNewCustomCharge = () => {
    const data = {
      camper: props.camper.id,
      custom_charge_type: customChargeType || customChargeTypes[0]?.id || 0,
      amount: Number(customChargeAmount) || 0,
      notes: customChargeNotes,
    };

    try {
      createCustomCharge(data);
    } catch (e) {
      console.error(e);
    }

    setCustomChargeType(0);
    setCustomChargeAmount(0);
    setCustomChargeNotes('');

    props.onSave();
  };

  return (
    <Modal
      show={props.show}
      onClose={props.onClose}
      title="Add Custom Charge"
      saveButtonLabel="Add new custom charge"
      onSave={handleSaveNewCustomCharge}
    >
      <div>
          <Select
            label="Type"
            options={customChargeTypes.map(v => ({ label: v.label, value: v.id }))}
            onChange={handleChange(setCustomChargeType)}
            defaultValue={customChargeTypes[0]?.id}
          />
          <Money
            label="Amount"
            onChange={handleChange(setCustomChargeAmount)}
            defaultValue={customChargeAmount}
          />
          <Input
            label="Notes"
            onChange={handleChange(setCustomChargeNotes)}
            defaultValue={customChargeNotes}
          />
      </div>
    </Modal>
  );
}

export default AddCustomChargeForm;



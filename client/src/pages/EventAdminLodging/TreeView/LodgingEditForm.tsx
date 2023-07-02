import React from 'react';
import Input, {
  TextArea,
  Select,
} from 'components/Input';
import Modal from 'components/Modal';
import Spinner from 'components/Spinner';
import api, { useEvent } from 'hooks/api';
import debug from 'utils/debug';
import { sortStringCompare } from 'utils/sort';

interface Props {
  show: boolean;
  setShow: (a: boolean) => void;
  lodging?: AugmentedLodging;
  lodgingLookup: { [a: string] : AugmentedLodging };
}

function LodgingEditForm({ lodging, show, setShow, lodgingLookup }: Props) {
  const [updateLodging] = api.useUpdateLodgingMutation();
  const [createLodging] = api.useCreateLodgingMutation();

  const [loading, setLoading] = React.useState<boolean>(false);
  const [showErrors, setShowErrors] = React.useState<boolean>(false);
  const [formData, setFormData] = React.useState<Partial<ApiLodging>>({});
  const { data: event } = useEvent();

  if (!event) return <Spinner />;

  const changeValue = (key: keyof AugmentedLodging) => (changeEvent: React.ChangeEvent<HTMLInputElement>) => {
    let value;

    if (key === 'visible') {
      value = changeEvent.target.value === 'Yes' ? true : false;
    } else {
      value = changeEvent.target.value;

      if (!value.length) value = null;
    }

    const newData = {
      ...formData,
      [key]: value,
    };

    setFormData(newData);
  };

  const onClose = () => {
    setShow(false);
    setLoading(false);
    setShowErrors(false);

    setFormData({});
  };

  const parentOptions = Object.values(lodgingLookup).sort(
    (a, b) => sortStringCompare(a.fullPath, b.fullPath)
  ).map(
    (l) => ({
      label: l.fullPath || 'root',
      value: l.id,
    })
  );

  const onSave = async () => {
    setShowErrors(true);
    setLoading(true);

    if (lodging) {
      await updateLodging({
        id: lodging.id,
        ...formData,
      });
    } else {
      // check
      if (!formData.name) {

      }
      const data = {
        event: event.id,
        parent: formData.parent || parentOptions[0].value,
        name: formData.name,
        children_title: formData.children_title || '',
        capacity: formData.capacity || 0,
        reserved: formData.reserved || 0,
        visible: formData.visible || false,
        notes: formData.notes || '',
      } as ApiLodging;

      await createLodging(data);
    }

    onClose();
  }

  return (
    <Modal
      title={`${lodging ? 'Edit' : 'Create'} Lodging`}
      saveButtonLabel={lodging ? 'Save' : 'Create'}
      onSave={onSave}
      onClose={onClose}
      show={show}
      loading={loading}
    >
      <Select
        label="Parent Lodging"
        onChange={changeValue('parent')}
        defaultValue={lodging?.parent || parentOptions[0].value}
        isInvalid={showErrors && !lodging?.parent}
        options={parentOptions}
        inline
      />
      {
        !!lodging && (
          <div>editing lodging #{lodging.id}</div>
        )
      }
      <Input
        label="Name"
        onChange={changeValue('name')}
        defaultValue={lodging?.name}
        isInvalid={showErrors && !lodging?.name}
      />
      <Input
        label="Title for children"
        onChange={changeValue('children_title')}
        defaultValue={lodging?.children_title}
        isInvalid={showErrors && !lodging?.children_title}
      />
      <div>Calculated capacity: {lodging?.capacity} - set Capacity to 0 to use this number</div>
      {
        (!!lodging?.isLeaf || !lodging) && (
          <Input
            label="Capacity"
            onChange={changeValue('capacity')}
            defaultValue={lodging?.originalCapacity}
            isInvalid={showErrors && !lodging?.originalCapacity}
          />
        )
      }
      <Input
        label="Reserved"
        onChange={changeValue('reserved')}
        defaultValue={lodging?.reserved}
        isInvalid={showErrors && !lodging?.reserved}
      />
      <Select
        label="Visible"
        onChange={changeValue('visible')}
        defaultValue={lodging?.visible ? 'Yes' : 'No'}
        isInvalid={showErrors && !lodging?.visible}
        options={[
          { value: 'Yes', label: 'Yes' },
          { value: 'No', label: 'No' },
        ]}
        inline
      />
      <TextArea
        label="Notes"
        onChange={changeValue('notes')}
        defaultValue={lodging?.notes}
        isInvalid={showErrors && !lodging?.notes}
      />
    </Modal>
  );


}

export default LodgingEditForm;


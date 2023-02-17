import React from 'react';
import Input, { TextArea } from 'components/Input';
import Modal from 'components/Modal';
import api from 'store/api';
import debug from 'utils/debug';

type Props = {
  show: boolean,
  setShow: (a: boolean) => void,
  regType: ApiRegistrationType | undefined,
}

const requiredFields = [
  'name',
  'label',
  'invitation_email_subject',
  'invitation_email_template',
] as const;

function InviteForm({ regType, show, setShow }: Props) {
  const [createRegistrationType] = api.useCreateRegistrationTypeMutation();
  const [updateRegistrationType] = api.useUpdateRegistrationTypeMutation();

  const [showErrors, setShowErrors] = React.useState<boolean>(false);
  const [formData, setFormData] = React.useState<Partial<ApiRegistrationType>>(regType || {});

  const changeValue = (key: keyof ApiRegistrationType) => (changeEvent: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = changeEvent.target;

    setFormData({
      ...formData,
      [key]: value,
    });
  };

  const onSave = async () => {
    setShowErrors(true);

    if (requiredFields.filter(k => !formData[k]).length) return;

    if (regType) {
      await updateRegistrationType({
        ...regType,
        ...formData,
      });
    } else {
      await createRegistrationType(formData as ApiRegistrationType);
    }

    setShow(false);
  }

  debug('RegType form values', formData);

  return (
    <Modal
      title={`${regType ? 'Edit' : 'Create'} special registration type`}
      saveButtonLabel={regType ? 'Save' : 'Create'}
      onSave={onSave}
      onClose={() => setShow(false)}
      show={show}
    >
      <Input
        label="Machine Name"
        onChange={changeValue('name')}
        defaultValue={regType?.name}
        isInvalid={showErrors && !regType?.name}
      />
      <Input
        label="Label"
        onChange={changeValue('label')}
        defaultValue={regType?.label}
        isInvalid={showErrors && !regType?.label}
      />
      <Input
        label="Email Subject"
        onChange={changeValue('invitation_email_subject')}
        defaultValue={regType?.invitation_email_subject}
        isInvalid={showErrors && !regType?.invitation_email_subject}
      />
      <TextArea
        label="Email Template"
        onChange={changeValue('invitation_email_template')}
        defaultValue={regType?.invitation_email_template}
        isInvalid={showErrors && !regType?.invitation_email_template}
      />
    </Modal>
  );


}

export default InviteForm;


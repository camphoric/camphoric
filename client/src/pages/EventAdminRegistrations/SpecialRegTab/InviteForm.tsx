import React from 'react';
import Input, { Select } from 'components/Input';
import Modal from 'components/Modal';
import api from 'store/api';
import debug from 'utils/debug';

type Props = {
  show: boolean,
  setShow: (a: boolean) => void,
  registrationTypes: Array<ApiRegistrationType>,
}

function InviteForm({ registrationTypes, show, setShow }: Props) {
  const [createInvitation] = api.useCreateInvitationMutation();
  const [sendInvitation] = api.useSendInvitationMutation();

  const [showErrors, setShowErrors] = React.useState<boolean>(false);
  const [formData, setFormData] = React.useState<Partial<ApiInvitation>>({});
  const [loading, setLoading] = React.useState<boolean>(false);

  const changeValue = (key: keyof ApiInvitation) => (changeEvent: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = changeEvent.target;

    debug('changeValue', key, value);

    setFormData({
      ...formData,
      [key]: value,
    });
  };

  const regTypesOptions = registrationTypes.map(
    (rt: ApiRegistrationType) => ({
      label: rt.label,
      value: rt.id,
    })
  );

  const onClose = () => {
    setShow(false);
    setLoading(false);
    setShowErrors(false);

    setFormData({});
  };

  const onSave = async () => {
    setShowErrors(true);
    setLoading(true);

    if (!formData.recipient_name || !formData.recipient_email) return;

    const invitationData = {
      ...formData,
      registration_type: formData.registration_type || regTypesOptions[0].value.toString(),
    } as ApiInvitation;

    debug('onSave', invitationData);

    const invitation = await createInvitation(invitationData);

    if ('data' in invitation) {
      debug('onSave response', invitation);
      await sendInvitation(invitation.data.id);
    }

    onClose();
  }

  debug('InviteForm form values', formData);

  return (
    <Modal
      title="Create special registration invite"
      saveButtonLabel="Send invite"
      onSave={onSave}
      onClose={onClose}
      show={show}
      loading={loading}
    >
      <Select
        label="Registration type"
        options={regTypesOptions}
        onChange={changeValue('registration_type')}
      />
      <Input
        label="Name"
        onChange={changeValue('recipient_name')}
        isInvalid={showErrors && !formData.recipient_name}
      />
      <Input
        label="Email"
        onChange={changeValue('recipient_email')}
        isInvalid={showErrors && !formData.recipient_email}
      />
    </Modal>
  );


}

export default InviteForm;

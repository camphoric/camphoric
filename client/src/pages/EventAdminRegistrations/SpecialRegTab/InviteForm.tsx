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
  const [inviteFormData, setInviteFormData] = React.useState<Partial<ApiInvitation>>({});

  const changeValue = (key: keyof ApiInvitation) => (changeEvent: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = changeEvent.target;

    setInviteFormData({
      ...inviteFormData,
      [key]: value,
    });
  };

  const onSave = async () => {
    setShowErrors(true);

    if (!inviteFormData.recipient_name || !inviteFormData.recipient_email) return;

    const invitation = await createInvitation(inviteFormData as ApiInvitation);

    if ('data' in invitation) {
      debug('onSave', invitation);
      await sendInvitation(invitation.data.id);
    }

    setShow(false);
  }

  const regTypesOptions = registrationTypes.map(
    (rt: ApiRegistrationType) => ({
      label: rt.label,
      value: rt.id,
    })
  );

  debug('InviteForm form values', inviteFormData);

  return (
    <Modal
      title="Create special registration invite"
      saveButtonLabel="Send invite"
      onSave={onSave}
      onClose={() => setShow(false)}
      show={show}
    >
      <Select
        label="Registration type"
        options={regTypesOptions}
        onChange={changeValue('registration_type')}
        defaultValue={regTypesOptions[0].value}
      />
      <Input
        label="Name"
        onChange={changeValue('recipient_name')}
        isInvalid={showErrors && !inviteFormData.recipient_name}
      />
      <Input
        label="Email"
        onChange={changeValue('recipient_email')}
        isInvalid={showErrors && !inviteFormData.recipient_email}
      />
    </Modal>
  );


}

export default InviteForm;

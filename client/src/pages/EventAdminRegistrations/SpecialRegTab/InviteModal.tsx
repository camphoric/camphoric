import React from 'react';
import Input, { Select } from 'components/Input';
import Modal from 'components/Modal';

export interface InvitePostValues {
  registration_type?: number;
  recipient_name?: string;
  recipient_email?: string;
}

export interface Props {
  registrationTypes: Array<ApiRegistrationType>,
  onSave: (s: InvitePostValues) => void;
}

class InviteModal extends React.Component<Props, InvitePostValues> {
  state: InvitePostValues = {
    registration_type: this.props.registrationTypes[0].id
  }

  private modalRef = React.createRef<Modal>()

  show = () => this.modalRef.current && this.modalRef.current.show()

  changeValue = (key: keyof InvitePostValues) => (changeEvent: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = changeEvent.target;

    this.setState({ [key]: value });
  };

  render() {
    // console.log('form state', this.state);
    return (
      <Modal
        ref={this.modalRef}
        title="Create special registration invite"
        saveButtonLabel="Send invite"
        onSave={() => this.props.onSave(this.state)}
      >
        <Select
          label="Registration type"
          options={
            this.props.registrationTypes.map((rt) => ({
              label: rt.label,
              value: rt.id,
            }))
          }
          onChange={this.changeValue('registration_type')}
        />
        <Input
          label="Name"
          onChange={this.changeValue('recipient_name')}
        />
        <Input
          label="Email"
          onChange={this.changeValue('recipient_email')}
        />
      </Modal>
    );

  }
}

export default InviteModal;

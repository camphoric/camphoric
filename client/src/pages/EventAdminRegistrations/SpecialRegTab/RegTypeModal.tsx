import React from 'react';
import Input, { TextArea } from 'components/Input';
import Modal from 'components/Modal';

export interface RegTypePostValues {
  id?: string | number;
  name?: string,
  label?: string,
  invitation_email_subject?: string,
  invitation_email_template?: string,
}

export interface Props {
  registration_type: ApiRegistrationType,
  onSave: (s: RegTypePostValues) => void;
}

class RegTypeModal extends React.Component<Props, RegTypePostValues> {
  static defaultProps = {
    registration_type: {}
  }

  private blankState: RegTypePostValues = {
    id: undefined,
    name: undefined,
    label: undefined,
    invitation_email_subject: undefined,
    invitation_email_template: undefined,
  }

  state: RegTypePostValues = {
    id: this.props.registration_type.id,
    name: this.props.registration_type.name,
    label: this.props.registration_type.label,
    invitation_email_subject: this.props.registration_type.invitation_email_template,
    invitation_email_template: this.props.registration_type.invitation_email_template,
  }

  private modalRef = React.createRef<Modal>()

  show = (values?: RegTypePostValues) => {
    if (this.modalRef.current) {
      this.setState(values || this.blankState);
      this.modalRef.current.show()
    }
  }

  changeValue = (key: keyof RegTypePostValues) => (changeEvent: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = changeEvent.target;

    this.setState({ [key]: value });
  }

  render() {
    // console.log('form state', this.state);
    return (
      <Modal
        ref={this.modalRef}
        title={`${this.state.id ? 'Edit' : 'Create'} special registration type`}
        saveButtonLabel={this.state.id ? 'Save' : 'Create'}
        onSave={() => this.props.onSave(this.state)}
      >
        <Input
          label="Machine Name"
          onChange={this.changeValue('name')}
          defaultValue={this.state.name}
        />
        <Input
          label="Label"
          onChange={this.changeValue('label')}
          defaultValue={this.state.label}
        />
        <Input
          label="Email Subject"
          onChange={this.changeValue('invitation_email_subject')}
          defaultValue={this.state.invitation_email_subject}
        />
        <TextArea
          label="Email Template"
          onChange={this.changeValue('invitation_email_template')}
          defaultValue={this.state.invitation_email_template}
        />
      </Modal>
    );

  }
}

export default RegTypeModal;

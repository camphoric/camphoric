import React from 'react';
import Modal from './Modal';

interface Props {
  title: string,
  onConfirm: () => any;
  saveButtonLabel?: string,
  message?: string;
  onShow?: () => any;
}

class ConfirmDialog extends React.Component<Props> {
  private modalRef = React.createRef<Modal>()

  close = () => this.modalRef?.current?.close();
  show = () => this.modalRef?.current?.show();
  save = () => this.modalRef?.current?.save();

  render() {
    return (
      <Modal
        ref={this.modalRef}
        title={this.props.title}
        saveButtonLabel={this.props.saveButtonLabel || 'Yes'}
        onSave={this.props.onConfirm}
      >{this.props.message || 'This action cannot be undone'}</Modal>
    );
  }
}

export default ConfirmDialog;

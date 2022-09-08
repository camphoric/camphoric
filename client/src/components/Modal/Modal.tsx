import React from 'react';
import {
  Button,
  Modal as BootstrapModal,
} from 'react-bootstrap';

interface State {
  showModal: boolean
}

interface Props {
  title: string,
  saveButtonLabel?: string,
  onClose?: () => any;
  onShow?: () => any;
  onSave?: () => any;
}

class Modal extends React.Component<Props, State> {
  state: State = {
    showModal: false,
  }

  close = () => {
    this.setState({ showModal: false });
    this.props.onClose &&
      this.props.onClose();
  }

  show = () => {
    this.setState({ showModal: true });
    this.props.onShow &&
      this.props.onShow();
  }

  save = () => {
    this.setState({ showModal: false });
    this.props.onSave &&
      this.props.onSave();
  }

  render() {
    return (
      <BootstrapModal size="xl" show={this.state.showModal} onHide={this.close}>
        <BootstrapModal.Header closeButton>
          <BootstrapModal.Title>{ this.props.title }</BootstrapModal.Title>
        </BootstrapModal.Header>
        <BootstrapModal.Body>
          {this.props.children}
        </BootstrapModal.Body>
        <BootstrapModal.Footer>
          <Button variant="secondary" onClick={this.close}>
            Close
          </Button>
          <Button variant="primary" onClick={this.save}>
            { this.props.saveButtonLabel || 'Save Changes' }
          </Button>
        </BootstrapModal.Footer>
      </BootstrapModal>
    );
  }
}

export default Modal;


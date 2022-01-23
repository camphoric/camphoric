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
  handleClose?: () => void;
  handleShow?: () => void;
  handleSave?: () => void;
}

class Modal extends React.Component<Props, State> {
  state: State = {
    showModal: false,
  }

  close = () => {
    this.setState({ showModal: false });
    this.props.handleClose &&
      this.props.handleClose();
  }

  show = () => {
    this.setState({ showModal: true });
    this.props.handleShow &&
      this.props.handleShow();
  }

  save = () => {
    this.setState({ showModal: false });
    this.props.handleSave &&
      this.props.handleSave();
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


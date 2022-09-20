import React from 'react';
import {
  Button,
  Modal as BootstrapModal,
} from 'react-bootstrap';
import debug from 'utils/debug'

interface State {
  showModal: boolean
}

interface Props {
  title: string,
  saveButtonLabel?: string,
  onClose?: () => any;
  onShow?: () => any;
  onSave?: () => any;
  show?: boolean;
}

class Modal extends React.Component<Props, State> {
  state: State = {
    showModal: !!this.props.show,
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
    let show = this.state.showModal;

    // we can also use a prop to control whether this is shown.
    if (this.props.show !== undefined) show = this.props.show;

    debug('showModal', show);

    return (
      <BootstrapModal size="xl" show={show} onHide={this.close}>
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


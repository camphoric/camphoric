import React from 'react';
import { IoHelpCircleSharp } from 'react-icons/io5';
import {
  Button,
  Tabs,
  Tab,
} from 'react-bootstrap';

import Template from 'components/Template';
import JsonEditor from 'components/JsonEditor';
import Modal from 'components/Modal';

import helpText from './helpText';
import HelperDocs from './HelperDocs';

import './styles.scss';

interface Props {
  templateVars: Object,
}

class TemplateHelp extends React.Component<Props> {
  private modalRef = React.createRef<Modal>()

  close = () => this.modalRef?.current?.close();
  show = () => this.modalRef?.current?.show();

  render() {
    return (
      <>
        <Button onClick={this.show} style={{ border: 'none' }} variant="outline-info">
          <IoHelpCircleSharp />
        </Button>
        <Modal
          ref={this.modalRef}
          title="Template Help"
          saveButtonLabel="OK"
          onSave={this.close}
        >
          <Tabs defaultActiveKey="Help">
            <Tab eventKey="Help" title="Help">
              <Template
                markdown={helpText}
                templateVars={this.props.templateVars}
              />
            </Tab>
            <Tab className="template-help-modal-helpers" eventKey="Helpers" title="Helpers">
              <HelperDocs />
            </Tab>
            <Tab eventKey="Variables" title="Variables">
              <JsonEditor
                json={this.props.templateVars}
              />
            </Tab>
          </Tabs>
        </Modal>
      </>
    );
  }
}

export default TemplateHelp;

import React from 'react';
import { IoHelpCircleSharp } from 'react-icons/io5';
import {
  Button,
  Tabs,
  Tab,
} from 'react-bootstrap';

import Template, { ReportTemplateVars } from 'components/Template';
import JsonEditor from 'components/JsonEditor';
import Modal from 'components/Modal';

import helpText from './helpText';
import HelperDocs from './HelperDocs';

interface Props {
  templateVars: ReportTemplateVars,
}

class TemplateHelp extends React.Component<Props> {
  private modalRef = React.createRef<Modal>()

  close = () => this.modalRef?.current?.close();
  show = () => this.modalRef?.current?.show();

  downloadFile = () => {
    const fileData = JSON.stringify(this.props.templateVars, null, 2);
    const element = document.createElement('a');
    const file = new Blob([fileData], { type: 'application/json' });
    element.href = URL.createObjectURL(file);
    element.download = `${this.props.templateVars.event.name} Data.json`;
    document.body.appendChild(element);
    element.click();
  }

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
            <Tab className="template-help-modal-helpers" eventKey="Variables" title="Variables">
              <div className="button-container">
                <input id="jsonInput" type="hidden" />
                <Button onClick={this.downloadFile}>Download Template Data as JSON</Button>
              </div>
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

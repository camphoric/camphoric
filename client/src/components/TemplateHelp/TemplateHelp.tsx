import React from 'react';
import { IoHelpCircleSharp } from 'react-icons/io5';
import {
  Button,
  Tabs,
  Tab,
} from 'react-bootstrap';
import { useTemplateVars } from 'hooks/api';

import Template from 'components/Template';
import JsonEditor from 'components/JsonEditor';
import Modal from 'components/Modal';

import helpText from './helpText';
import HelperDocs from './HelperDocs';

function TemplateHelp() {
  const modalRef = React.useRef<Modal>(null);
  const templateVars = useTemplateVars();

  if (!templateVars) return null;

  const close = () => modalRef?.current?.close();
  const show = () => modalRef?.current?.show();

  const downloadFile = () => {
    const fileData = JSON.stringify(templateVars, null, 2);
    const element = document.createElement('a');
    const file = new Blob([fileData], { type: 'application/json' });
    element.href = URL.createObjectURL(file);
    element.download = `${templateVars.event.name} Data.json`;
    document.body.appendChild(element);
    element.click();
  }

  return (
    <>
      <Button onClick={show} style={{ border: 'none' }} variant="outline-info">
        <IoHelpCircleSharp />
      </Button>
      <Modal
        ref={modalRef}
        title="Template Help"
        saveButtonLabel="OK"
        onSave={close}
      >
        <Tabs defaultActiveKey="Help">
          <Tab eventKey="Help" title="Help">
            <Template
              markdown={helpText}
              templateVars={templateVars}
            />
          </Tab>
          <Tab className="template-help-modal-helpers" eventKey="Helpers" title="Helpers">
            <HelperDocs />
          </Tab>
          <Tab className="template-help-modal-helpers" eventKey="Variables" title="Variables">
            <div className="button-container">
              <input id="jsonInput" type="hidden" />
              <Button onClick={downloadFile}>Download Template Data as JSON</Button>
            </div>
            <JsonEditor
              json={templateVars}
            />
          </Tab>
        </Tabs>
      </Modal>
    </>
  );
}

export default TemplateHelp;

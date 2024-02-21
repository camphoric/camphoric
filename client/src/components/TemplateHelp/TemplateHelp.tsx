import React from 'react';
import { IoHelpCircleSharp } from 'react-icons/io5';
import {
  Button,
  Tabs,
  Tab,
} from 'react-bootstrap';
import { useTemplateVars } from 'hooks/api';

import DownloadFileButton from 'components/DownloadFileButton';
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
              <DownloadFileButton
                data={JSON.stringify(templateVars, null, 2)}
                type="application/json" 
                name={`${templateVars.event.name} Data.json`}
              >
                Download Template Data as JSON
              </DownloadFileButton>
            </div>
            <JsonEditor
              content={{ json: templateVars }}
            />
          </Tab>
        </Tabs>
      </Modal>
    </>
  );
}

export default TemplateHelp;

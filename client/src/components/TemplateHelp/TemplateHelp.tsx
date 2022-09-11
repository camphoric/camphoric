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

interface Props {
  templateVars: Object,
}

const helpText = `
# Camphoric Template Help

Camphoric templates come in two forms:

- Email Templates
- Report Templates

## Camphoric Email Templates

If a template specifically says that it's used for email, then it is an email
template. Email templates are a combination of Github Flavored Markdown and
Mustache templates.  

See the following for documentation:

- [Github Flavored Markdown Documentation](https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax)
- [Mustache Templating Language Documentation](https://mustache.github.io/mustache.5.html)

## Camphoric Report Templates

All other templates are report templates.  These are a combination of Github
Flavored Markdown and Handlebars templates.  Handlebars templates are like
Mustache templates with additional functionality like "if" statements, lookups
and more.

See the following for documentation:

- [Github Flavored Markdown Documentation](https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax)
- [Handlebars Templating Language Documentation](https://handlebarsjs.com/guide/)

## Variables Used for This Template

See the tab labeled "Variables" to see the variables passed to this template.
`;

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

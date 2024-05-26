import React from 'react';
import { Button, Alert } from 'react-bootstrap';
import { useParams, useHistory } from 'react-router-dom';
import CodeEditor from 'components/CodeEditor';
import TemplateHelp from 'components/TemplateHelp';
import Spinner from 'components/Spinner';
import Input, { Select } from 'components/Input';
import ConfirmDialog from 'components/Modal/ConfirmDialog';
import Modal from 'components/Modal';
import api from 'hooks/api';

export type EmailEditFormValue = {
  title: string,
  template: string,
  output: string,
  variables_schema: string,
}

type EmailEditFormPropsNew = {
  newEmail: true,
  email?: undefined,
  showModal: boolean,
  setShowModal: (b: boolean) => void,
  setActiveTab?: undefined
};


type EmailEditFormPropsEdit = {
  newEmail?: false,
  email?: ApiReport,
  showModal?: undefined,
  setShowModal?: undefined,
  setActiveTab: (tabname: string) => void,
};

type EmailEditFormProps = EmailEditFormPropsNew | EmailEditFormPropsEdit;

type NewEmailData = {
  variables_schema: string;
} & Omit<ApiReport, "id" | "created_at" | "updated_at" | "deleted_at" | "variables_schema">;

const emailToFormValue = (eventId: string, email?: ApiReport): NewEmailData => {
  return {
    event: email?.event || eventId,
    title: email?.title || '',
    template: email?.template || '',
    output: email?.output || 'csv',
    variables_schema: JSON.stringify(email?.variables_schema || {}, null, 2),
  }
};

type EmailError = { field: string, message: string };

function EmailEditForm({ email, ...props }: EmailEditFormProps) {
  const modalRef  = React.useRef<Modal>(null);
  const templateEditorRef = React.useRef<CodeEditor | null>(null);
  const variablesEditorRef = React.useRef<CodeEditor | null>(null);
  const { eventId } = useParams<{ eventId: string }>();
  const deleteModal  = React.useRef<ConfirmDialog>(null);
  const history = useHistory();
  const [formValues, setFormValues] = React.useState<NewEmailData | undefined>(emailToFormValue(eventId, email));
  const [emailId, setEmailId] = React.useState<number | undefined>(email?.id);
  const [errors, setErrors] = React.useState<EmailError[]>([]);
  const [deleteEmail] = api.useDeleteReportMutation();
  const [updateEmail] = api.useUpdateReportMutation();
  const [createEmail] = api.useCreateReportMutation();

  React.useEffect(() => {
    if (email?.id === emailId) return;
    setFormValues(undefined);

    setEmailId(email?.id);
    const vals = emailToFormValue(eventId, email);
    setFormValues(vals);
    if (templateEditorRef.current) {
      templateEditorRef.current.setValue(vals.template);
    }
    if (variablesEditorRef.current) {
      variablesEditorRef.current.setValue(vals.variables_schema);
    }
    
  }, [email, emailId, setEmailId, setFormValues, eventId]);

  if (!formValues) return <Spinner />;

  const saveEmail = async () => {
    const emailErrors = [];
    const vSchemaText = variablesEditorRef.current?.getValue() || formValues.variables_schema;

    try {
      const json = JSON.parse(vSchemaText);

      if (Array.isArray(json) || typeof json !== 'object') {
        throw new TypeError('must be an object');
      }
    } catch(e) {
      emailErrors.push({
        field: 'variables_schema',
        message: `${e}`,
      });
    }

    if (formValues.title.length === 0) {
      emailErrors.push({
        field: 'title',
        message: 'title is missing',
      });
    }

    if (emailErrors.length) {
      setErrors(emailErrors);

      return;
    }

    const template = templateEditorRef.current?.getValue() || formValues.template;
    const variables_schema = JSON.parse(vSchemaText);

    if (!email) {
      await createEmail({
        ...formValues,
        template,
        variables_schema,
      });
    } else {
      await updateEmail({
        id: email.id,
        ...formValues,
        template,
        variables_schema,
      });
    }

    setErrors([]);

    setFormValues(undefined);

    if (props.newEmail) {
      props.setShowModal(false);
    } else {
      props.setActiveTab && props.setActiveTab('View');
    }
  };

  const removeEmail = async () => {
    if (!email) return;

    await deleteEmail(email);

    setFormValues(emailToFormValue(eventId));

    history.replace({
      ...history.location,
      search: '',
    });
  };


  const handleFormChange = (field: keyof ApiReport) =>
    (changeEvent: React.ChangeEvent<HTMLInputElement>) => {
      const { value } = changeEvent.target;
      const newValue = {
        ...formValues,
        [field]: value,
      };

      setFormValues(newValue);
    };

  const outputOptions = [
    // { value: 'html', label: 'Jinja to HTML' },
    { value: 'md',  lang: 'twig', label: 'Jinja to Markdown' },
    { value: 'csv', lang: 'twig', label: 'Jinja to CSV' },
    { value: 'txt', lang: 'twig', label: 'Jinja to Plain Text' },
    { value: 'hbs', lang: 'handlebars', label: 'Handlebars to Markdown' },
  ];

  const contents = (
    <div className="email-edit-form">
      {
        errors.filter(e => e.field === 'title').map(
          (e) => (
            <Alert key={e.message} variant="danger">
              Error with Title: {e.message}
            </Alert>
          )
        )
      }
      <Input
        label="Title"
        onChange={handleFormChange('title')}
        value={formValues.title}
      />
      <Select
        label="Template Output"
        options={outputOptions}
        onChange={handleFormChange('output')}
        value={formValues.output}
      />

      <div>Template code <TemplateHelp /></div>
      <CodeEditor
        defaultLanguage={outputOptions.find(v => v.value === formValues.output)?.lang || 'twig'}
        defaultValue={formValues.template}
        ref={templateEditorRef}
      />

      {
        errors.filter(e => e.field === 'variables_schema').map(
          (e) => (
            <Alert key={e.message} variant="danger">
              Error with Variables Schema: {e.message}
            </Alert>
          )
        )
      }

      <br />
      <div>Variables schema</div>
      <CodeEditor
        defaultLanguage="json"
        defaultValue={formValues.variables_schema}
        ref={variablesEditorRef}
      />

      {
        !props.newEmail && (
          <div className="button-container">
            <Button variant="primary" onClick={saveEmail}>
              Save Changes
            </Button>

            <Button variant="danger" onClick={() => deleteModal.current?.show()}>
              Delete Email
            </Button>
          </div>
        )
      }
      {
        !!email && (
          <ConfirmDialog
            ref={deleteModal}
            title={`Delete email "${email.title}"?`}
            onConfirm={removeEmail}
          />
        )
      }
    </div>
  );

  if (props.newEmail) {
    return (
      <Modal
        ref={modalRef}
        title="New email"
        saveButtonLabel="Create"
        show={props.showModal}
        onSave={saveEmail}
        onClose={() => props.setShowModal(false)}
      >
        {contents}
      </Modal>
    );
  }

  return (
    <div>
      {contents}
    </div>
  );
}

export default EmailEditForm;

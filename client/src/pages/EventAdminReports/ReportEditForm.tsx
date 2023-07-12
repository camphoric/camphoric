import React from 'react';
import { Button, Alert } from 'react-bootstrap';
import { useParams, useHistory } from 'react-router-dom';
import Spinner from 'components/Spinner';
import Input, { TextArea, Select } from 'components/Input';
import ConfirmDialog from 'components/Modal/ConfirmDialog';
import TemplateHelp from 'components/TemplateHelp';
import Modal from 'components/Modal';
import api from 'hooks/api';
  

export type ReportEditFormValue = {
  title: string,
  template: string,
  output: string,
  variables_schema: string,
}

type ReportEditFormPropsNew = {
  newReport: true,
  report?: undefined,
  showModal: boolean,
  setShowModal: (b: boolean) => void,
  setActiveTab?: undefined
};


type ReportEditFormPropsEdit = {
  newReport?: false,
  report: ApiReport,
  showModal?: undefined,
  setShowModal?: undefined,
  setActiveTab: (tabname: string) => void,
};

type ReportEditFormProps = ReportEditFormPropsNew | ReportEditFormPropsEdit;

type NewReportData = {
  variables_schema: string;
} & Omit<ApiReport, "id" | "created_at" | "updated_at" | "deleted_at" | "variables_schema">;

const reportToFormValue = (eventId: string, report?: ApiReport): NewReportData => {
  return {
    event: report?.event || eventId,
    title: report?.title || '',
    template: report?.template || '',
    output: report?.output || 'md',
    variables_schema: JSON.stringify(report?.variables_schema || {}, null, 2),
  }
};

type ReportError = { field: string, message: string };

function ReportEditForm({ report, ...props }: ReportEditFormProps) {
  const modalRef  = React.useRef<Modal>(null);
  const { eventId } = useParams<{ eventId: string }>();
  const deleteModal  = React.useRef<ConfirmDialog>(null);
  const history = useHistory();
  const [formValues, setFormValues] = React.useState<NewReportData | undefined>(reportToFormValue(eventId, report));
  const [reportId, setReportId] = React.useState<number | undefined>(report?.id);
  const [errors, setErrors] = React.useState<ReportError[]>([]);
  const [deleteReport] = api.useDeleteReportMutation();
  const [updateReport] = api.useUpdateReportMutation();
  const [createReport] = api.useCreateReportMutation();

  React.useEffect(() => {
    if (report?.id === reportId) return;
    setFormValues(undefined);

    setReportId(report?.id);
    setFormValues(reportToFormValue(eventId, report));
  }, [report, reportId, setReportId, setFormValues, eventId]);

  if (!formValues) return <Spinner />;

  const saveReport = async () => {
    const reportErrors = [];

    try {
      const json = JSON.parse(formValues.variables_schema);

      if (Array.isArray(json) || typeof json !== 'object') {
        throw new TypeError('must be an object');
      }
    } catch(e) {
      reportErrors.push({
        field: 'variables_schema',
        message: `${e}`,
      });
    }

    if (formValues.title.length === 0) {
      reportErrors.push({
        field: 'title',
        message: 'title is missing',
      });
    }

    if (reportErrors.length) {
      setErrors(reportErrors);

      return;
    }

    if (!report) {
      await createReport({
        ...formValues,
        variables_schema: JSON.parse(formValues.variables_schema),
      });
    } else {
      await updateReport({
        id: report.id,
        ...formValues,
        variables_schema: JSON.parse(formValues.variables_schema),
      });
    }

    setErrors([]);

    if (props.newReport) {
      props.setShowModal(false);
    } else {
      props.setActiveTab && props.setActiveTab('View');
    }
  };

  const removeReport = async () => {
    if (!report) return;

    await deleteReport(report);

    setFormValues(reportToFormValue(eventId));

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


  const textAreaLabel = (
    <div>
      Report Template
      <TemplateHelp />
    </div>
  );

  const outputOptions = [
    // { value: 'html', label: 'Jinja to HTML' },
    // { value: 'md', label: 'Jinja to Markdown' },
    { value: 'csv', label: 'Jinja to CSV' },
    { value: 'hbs', label: 'Handlebars to Markdown' },
    // { value: 'txt', label: 'Jinja to Plain Text' },
  ];

  const contents = (
    <div className="report-edit-form">
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

      <TextArea
        label={textAreaLabel}
        className="report-template"
        onChange={handleFormChange('template')}
        value={formValues.template}
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
      <TextArea
        label="Variables Schema"
        className="report-variables-schema"
        onChange={handleFormChange('variables_schema')}
        value={formValues.variables_schema}
      />

      {
        !props.newReport && (
          <div className="button-container">
            <Button variant="primary" onClick={saveReport}>
              Save Changes
            </Button>

            <Button variant="danger" onClick={() => deleteModal.current?.show()}>
              Delete Report
            </Button>
          </div>
        )
      }
      {
        !!report && (
          <ConfirmDialog
            ref={deleteModal}
            title={`Delete report "${report.title}"?`}
            onConfirm={removeReport}
          />
        )
      }
    </div>
  );

  if (props.newReport) {
    return (
      <Modal
        ref={modalRef}
        title="New report"
        saveButtonLabel="Create"
        show={props.showModal}
        onSave={saveReport}
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

export default ReportEditForm;

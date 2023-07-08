import React from 'react';
import { Button } from 'react-bootstrap';
import { useParams, useHistory } from 'react-router-dom';
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

export interface ReportEditFormProps {
  newReport?: boolean;
  report?: ApiReport;
  setActiveTab?: (tabname: string) => void;
  modalRef?: React.RefObject<Modal>;
}

type NewReportData = Omit<ApiReport, "id" | "created_at" | "updated_at" | "deleted_at">;

const reportToFormValue = (eventId: string, report?: ApiReport): NewReportData => {
  return {
    event: report?.event || eventId,
    title: report?.title || '',
    template: report?.template || '',
    output: report?.output || 'md',
    variables_schema: report?.variables_schema || {},
  }
};

function ReportEditForm({ report, ...props }: ReportEditFormProps) {
  const { eventId } = useParams<{ eventId: string }>();
  const deleteModal  = React.useRef<ConfirmDialog>(null);
  const history = useHistory();
  const [formValues, setFormValues] = React.useState<NewReportData>(reportToFormValue(eventId, report));
  const [deleteReport] = api.useDeleteReportMutation();
  const [updateReport] = api.useUpdateReportMutation();
  const [createReport] = api.useCreateReportMutation();

  const saveReport = async () => {
    if (!report) {
      await createReport({
        ...formValues,
      });
    } else {
      await updateReport({
        id: report.id,
        ...formValues
      });
    }

    setFormValues(reportToFormValue(eventId));
    props.setActiveTab && props.setActiveTab('View');
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
    { value: 'html', label: 'Jinja to HTML' },
    { value: 'md', label: 'Jinja to Markdown' },
    { value: 'csv', label: 'Jinja to CSV' },
    { value: 'hbs', label: 'Handlebars to Markdown' },
    { value: 'txt', label: 'Jinja to Plain Text' },
  ];


  return (
    <div className="report-edit-form">
      <Input
        label="Title"
        onChange={handleFormChange('title')}
        defaultValue={formValues.title}
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
        defaultValue={formValues.template}
      />

      <TextArea
        label="Variables Schema"
        className="report-variables-schema"
        onChange={handleFormChange('variables_schema')}
        defaultValue={formValues.variables_schema}
      />

      <div className="button-container">
        <Button variant="primary" onClick={saveReport}>
          Save Changes
        </Button>

        <Button variant="danger" onClick={() => deleteModal.current?.show()}>
          Delete Report
        </Button>
      </div>

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
}

export default ReportEditForm;

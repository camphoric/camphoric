import React from 'react';
import Input, { TextArea } from 'components/Input';
import TemplateHelp from 'components/TemplateHelp';
import type { ReportTemplateVars } from 'components/Template';

export type ReportEditFormValue = {
  title: string,
  template: string,
}

export interface ReportEditFormProps {
  templateVars: ReportTemplateVars;
  result?: ApiReport;
  onChange: (obj: ReportEditFormValue) => void;
}

const blankFormValue = {
  title: '',
  template: '',
}

function ReportEditForm({ result, onChange, templateVars }: ReportEditFormProps) {
  const [reportValues, setReportValues] = React.useState<ReportEditFormValue>(blankFormValue);

  React.useEffect(() => {
    const { title, template } = result || {};
    const initialValue: ReportEditFormValue = {
      title: title || '',
      template: template || '',
    };

    setReportValues(initialValue);
    onChange(initialValue);
  }, [result, onChange]);

  const handleFormChange = (field: keyof ApiReport) =>
    (changeEvent: React.ChangeEvent<HTMLInputElement>) => {
      const { value } = changeEvent.target;
      const newValue = {
        ...reportValues,
        [field]: value,
      };

      setReportValues(newValue);
      onChange(newValue);
    };

  const textAreaLabel = (
    <div>
      Report Template 
      <TemplateHelp templateVars={templateVars} />
    </div>
  );

  return (
    <div className="report-edit-form">
      <Input
        label="Title"
        onChange={handleFormChange('title')}
        defaultValue={reportValues.title}
      />
      <TextArea
        label={textAreaLabel}
        onChange={handleFormChange('template')}
        defaultValue={reportValues.template}
      />
    </div>
  );
}

export default ReportEditForm;

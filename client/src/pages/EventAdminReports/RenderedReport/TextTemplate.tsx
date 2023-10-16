import React from 'react';
import { Alert } from 'react-bootstrap';
import Spinner from 'components/Spinner';
import api from 'store/admin/api';
import DownloadFileButton from 'components/DownloadFileButton';
import { useTemplateVars } from 'hooks/api';

type Props = {
  report: ApiReport,
};

function TextTemplate({ report }: Props) {
  const templateVars = useTemplateVars();

  const renderedReport = api.useGetRenderedReportQuery({
    id: report.id,
    ...templateVars,
  });


  if (!renderedReport.data) {
    return <Spinner />;
  }

  const txt = renderedReport.data.report;
  const error = renderedReport.data.error;

  if (error) {
    return (
      <>
        <Alert variant="danger">An error occurred</Alert>
        <pre>{error}</pre>
      </>
    )
  }

  return (
    <>
      <DownloadFileButton
        data={txt}
        type="text/plain" 
        name={`${report.title}.txt`}
      >
        Download Text File
      </DownloadFileButton>
      <h2>{report.title}</h2>
      <pre>{txt}</pre>
    </>
  );
}

export default TextTemplate;

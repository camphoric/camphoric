import React from 'react';
import { Alert } from 'react-bootstrap';
import Spinner from 'components/Spinner';
import api from 'store/admin/api';
import DownloadFileButton from 'components/DownloadFileButton';
import { useTemplateVars } from 'hooks/api';
import { markdown2Html } from 'components/Template/util';

type Props = {
  report: ApiReport,
};

function MarkdownTemplate({ report }: Props) {
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
        type="text/markdown"
        name={`${report.title}.md`}
      >
        Download Markdown File
      </DownloadFileButton>
      <h2>{report.title}</h2>
      <div
        className="md-template"
        dangerouslySetInnerHTML={{
          __html: markdown2Html(txt)
        }}
      />
    </>
  );
}

export default MarkdownTemplate;

import React from 'react';
import Spinner from 'components/Spinner';

import HandleBarsTemplate from './HandleBarsTemplate';
import CSVTemplate from './CSVTemplate';
import TextTemplate from './TextTemplate';
import MarkdownTemplate from './MarkdownTemplate';

type Props = {
  report: ApiReport,
};

function ReportSearchResult({ report }: Props) {
  switch(report.output) {
    case 'hbs':
      return (
        <HandleBarsTemplate
          report={report}
        />
      );
    case 'csv':
      return (
        <CSVTemplate
          report={report}
        />
      );
    case 'txt':
      return (
        <TextTemplate
          report={report}
        />
      );
    case 'md':
      return (
        <MarkdownTemplate
          report={report}
        />
      );

    default:
      return <Spinner />;
  }

}

export default ReportSearchResult;

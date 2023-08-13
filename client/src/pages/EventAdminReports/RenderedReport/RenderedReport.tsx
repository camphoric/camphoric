import React from 'react';
import Spinner from 'components/Spinner';

import HandleBarsTemplate from './HandleBarsTemplate';
import CSVTemplate from './CSVTemplate';

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

    default:
      return <Spinner />;
  }

}

export default ReportSearchResult;

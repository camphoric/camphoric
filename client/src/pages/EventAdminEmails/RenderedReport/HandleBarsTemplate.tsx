import React from 'react';
import Spinner from 'components/Spinner';
import { useTemplateVars } from 'hooks/api';
import Template from 'components/Template';

type Props = {
  report: ApiReport,
};

function HandleBarsTemplate({ report }: Props) {
  const templateVars = useTemplateVars();

  if ( !templateVars) {
    return <Spinner />;
  }

  return (
    <Template
      markdown={report.template}
      templateVars={templateVars}
    />
  );
}

export default HandleBarsTemplate;

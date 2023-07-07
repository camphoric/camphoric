import React from 'react';
import Spinner from 'components/Spinner';
import {
  useCamperLookup,
  useEvent,
  useLodgingLookup,
  useRegistrationLookup,
} from 'hooks/api';
import Template, { ReportTemplateVars } from 'components/Template';

type Props = {
  report: ApiReport,
};

function HandleBarsTemplate({ report }: Props) {
  const { data: event } = useEvent();
  const registrationLookup = useRegistrationLookup();
  const camperLookup = useCamperLookup();
  const lodgingLookup = useLodgingLookup();

  if (
    !event ||
    !camperLookup ||
    !registrationLookup ||
    !lodgingLookup
  ) {
    return <Spinner />;
  }

  const registrations = Object.values(registrationLookup);
  const campers = Object.values(camperLookup);

  const templateVars: ReportTemplateVars = {
    event,
    registrationLookup,
    lodgingLookup,
    camperLookup,
    registrations,
    campers,
  };


  return (
    <Template
      markdown={report.template}
      templateVars={templateVars}
    />
  );
}

export default HandleBarsTemplate;

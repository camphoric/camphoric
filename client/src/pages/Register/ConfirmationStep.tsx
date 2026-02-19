import React from 'react';
import Spinner from 'components/Spinner';
import Template from 'components/Template';
import type { InitialPaymentBody } from 'store/register';
import { FormData, PricingResults }from 'components/JsonSchemaForm';
import debug from 'utils/debug';
import { useRegFormData } from 'store/register/store';

import PageWrapper from './PageWrapper';
import {
  useNavigateToRegPage,
  useLocalStorageFormData,
} from './utils';

type ConfirmationTemplateVars = {
  paymentInfo: InitialPaymentBody,
  registration: FormData,
  totals: PricingResults,
  pricing_results: PricingResults,
} | undefined;

function ConfirmationStep() {
  const [templateVars, setTemplateVars] = React.useState<ConfirmationTemplateVars>();
  const [template, setTemplate] = React.useState<string | undefined>();
  const regFormData = useRegFormData();
  const storage = useLocalStorageFormData();
  const navigateToRegPage = useNavigateToRegPage();

  React.useEffect(() => {
    const {
      registration,
      paymentInfo,
      confirmationStep,
      paymentStep,
    } = regFormData;

    if (
      !paymentInfo ||
      !registration ||
      !confirmationStep ||
      !paymentStep ||
      !!templateVars
    ) return;

    setTemplate(confirmationStep.confirmationPageTemplate);
    setTemplateVars({
      paymentInfo,
      registration,
      totals: paymentStep.serverPricingResults,
      pricing_results: confirmationStep.serverPricingResults
    });
    storage.resetFormData();
  }, [regFormData, templateVars, storage]);

  if (!regFormData.confirmationStep && !templateVars && !template) {
    navigateToRegPage('/registration');

    return null;
  }

  if (!templateVars) return <Spinner />;

  debug('ConfirmationStep data', {
    templateVars,
    regFormData,
  });

  return (
    <PageWrapper>
      <section className="confirmation">
        <Template
          markdown={template}
          templateVars={templateVars}
        />
      </section>
    </PageWrapper>
  );
}

export default ConfirmationStep;

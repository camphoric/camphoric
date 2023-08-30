import React from 'react';

import debug from 'utils/debug';
import { Spinner } from 'react-bootstrap';
import SpinnerPage from 'components/Spinner';
import { type ErrorTransformer } from '@rjsf/utils';
import ErrorBoundary from 'components/ErrorBoundary';
import JsonSchemaForm, {
  FormData,
  JsonSchemaFormChangeEvent,
}from 'components/JsonSchemaForm';
import Template from 'components/Template';
import api from 'store/register/api';
import {
  useRegFormData,
  setPaymentStep,
  useAppDispatch,
} from 'store/register/store';

import {
  useNavigateToRegPage,
  useLocalStorageFormData,
} from './utils';
import PageWrapper from './PageWrapper';
import transformErrorsCreator from './transformErrors';

function RegistrationStep() {
  const [liveValidate, setLiveValidate] = React.useState(false);
  const [recalc, setRecalc] = React.useState(false);
  const regFormData = useRegFormData();
  const registrationApi = api.useGetRegistrationQuery();
  const [createRegistration] = api.useCreateRegistrationMutation();
  const dispatch = useAppDispatch();
  const storage = useLocalStorageFormData();
  const navigateToRegPage = useNavigateToRegPage();

  React.useEffect(() => {
    try {
      storage.rehydrateFormData();
    } catch (e) {
      if (e instanceof Error && e.message === 'no local storage data') {
          debug('no local storage');
      } else {
        console.error(e);
      }
    }
  }, [storage]);

  // strange workaround to get this spinner working
  React.useEffect(() => {
    setRecalc(regFormData.updating);
  }, [regFormData]);

  if (
    registrationApi.isFetching ||
    registrationApi.isLoading ||
    !registrationApi.data ||
    !storage.rehydrated
  ) return <SpinnerPage />;

  const config = registrationApi.data;

  const transformErrors = transformErrorsCreator(config.dataSchema) as ErrorTransformer;

  const onJsonSchemaFormError = (errors: Array<any>) => {
    setLiveValidate(true);

    // @ts-ignore
    debug('onJsonSchemaFormError', errors);

    // even if we don't find the phone error, to to top where the error list is
    window.scrollTo(0,0);

    // hack to fix focus for phone number input type
    errors.forEach((e) => {
      if (e.property.includes('phone')) {
        let camperIndex = 0;
        let m = e.property.match(/.campers\[(\d+)\]/);

        if (m && m[1] !== undefined) {
          camperIndex = m[1];
        } else {
          return;
        }

        let id = `root_campers_${camperIndex}`;
        m = e.property.match(/\.([^.]+)$/);

        if (m && m[1] !== undefined) {
          id = `root_campers_${camperIndex}_${m[1]}`;
        } else {
          return;
        }

        document.getElementById(id)?.focus();
      }
    });
  }

  const onChange = ({ formData, ...otherStuff }: JsonSchemaFormChangeEvent<FormData>) => {
    debug('RegistrationStep onChange', { formData, otherStuff });
    setRecalc(true);
    storage.saveFormData(formData);
  };

  // for debuging/ autofilling of form data
  if (import.meta.env.DEV) {
    // @ts-ignore
    window.regOnChange = formData => onChange({ formData });
  }

  const submitRegistration = async () => {
    const { invitation } = config;

    try {
      const payload = {
        formData: regFormData.registration,
        pricingResults: regFormData.totals,
        ...(!!invitation && { invitation }),
      };

      const result = await createRegistration(payload);
      debug('submitRegistration result', result);

      if ('error' in result) {
        throw new Error(`error fetching data: ${JSON.stringify(result)}`);
      }

      const { data } = result;

      await dispatch(setPaymentStep(data));
      navigateToRegPage('/payment');
    } catch(e) {
      console.error('submissionError', e);
    }
  };

  return (
    <PageWrapper>
      <ErrorBoundary section="RegistrationStep">
        <JsonSchemaForm
          schema={config.dataSchema}
          uiSchema={config.uiSchema}
          onChange={onChange}
          onSubmit={submitRegistration}
          onError={onJsonSchemaFormError}
          formData={regFormData.registration}
          /*
          // @ts-ignore */
          transformErrors={transformErrors}

          templateData={{
            ...(config.templateVars || {}),
            pricing: config.pricing,
            formData: regFormData.registration,
            totals: regFormData.totals, 
          }}
          noHtml5Validate
          liveValidate={liveValidate}
        >
          <div>
            <Template markdown={config.preSubmitTemplate} />
            <button type="submit" className="btn btn-info">
              Continue to payment
            </button>
          </div>
        </JsonSchemaForm>
        <div className="PriceTicker">
          {
            !!recalc && (
              <Spinner style={{ position: 'absolute', color: 'rgba(0, 0, 0, 0.4)' }} animation="border" role="status" />
            )
          }
          <div>Total: ${(regFormData.totals.total || 0).toFixed(2)}</div>
        </div>
      </ErrorBoundary>
    </PageWrapper>
  );
}

export default RegistrationStep;

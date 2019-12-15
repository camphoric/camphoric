import { UiSchema } from 'react-jsonschema-form';
import { JSONSchema6 } from "json-schema";

/* Utility States */
export type Dollars = number;

export type AppConfig = {
    uiSchema: UiSchema,
    dataSchema: JSONSchema6,
    pricingLogic: any,
    pricing: any,
};

/* App States */
interface FormDataState {
  config: AppConfig
  /* An opaque type is probably correct here. */
  formData: {
      campers: Array<Object>,
  }

  totals: {
      [key: string]: number,
  }
}

interface FetchingState {
  status: 'fetching',
}

interface LoadedState extends FormDataState {
  status: 'loaded',
}

interface SubmittingState extends FormDataState {
  status: 'submitting',
}

interface SubmittedState extends FormDataState {
  status: 'submitted',
}

interface SubmissionErrorState extends FormDataState {
  status: 'submissionError',
}

export type AppState = 
  FetchingState | 
  LoadedState |
  SubmittingState | 
  SubmittedState |
  SubmissionErrorState;

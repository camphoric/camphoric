import React from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import { RouteComponentProps, withRouter } from 'react-router';

import type { OrderResponseBody } from '@paypal/paypal-js';

import Spinner from 'components/Spinner';
import Template from 'components/Template';
import { getCsrfToken } from 'utils/fetch';
import debug from 'utils/debug';
import {
  calculatePrice,
  PricingResults,
  FormData,
  JsonSchemaFormChangeEvent,
} from 'components/JsonSchemaForm';

import RegisterComponent from './component';
import './styles.scss';

type PathParams = {
  eventId: string;
}

type Props = RouteComponentProps<PathParams>;

interface FetchingState {
  status: "fetching";
}

export type PaymentType = 'Check' | 'PayPal' | 'Card';
export type SubmitPaymentMethod = (
  paymentType: PaymentType,
  payPalResponse?: OrderResponseBody,
) => Promise<void>;
export type SubmitRegistrationMethod = (a: any) => Promise<void>;

export interface FormDataState {
  config: ApiRegister;
  formData: FormData;
  totals: PricingResults;
  step: "registration" | "payment";
  registrationUUID?: string;
}

interface LoadedState extends FormDataState {
  status: "loaded";
}

interface SubmittingState extends FormDataState {
  status: "submitting";
}

interface SubmittedState extends FormDataState {
  status: "submitted";
  confirmationProps: React.ComponentProps<typeof Template>;
}

interface SubmissionErrorState extends FormDataState {
  status: "submissionError";
}

export type RegistrationState =
  | FetchingState
  | LoadedState
  | SubmittingState
  | SubmittedState
  | SubmissionErrorState;

class App extends React.Component<Props, RegistrationState> {
  state: RegistrationState = {
    status: "fetching"
  };

  constructor(props: Props) {
    super(props);

    this.getConfig();
  }

  componentDidUpdate(prevProps: Props, prevState: RegistrationState) {
    if (this.state.status === "fetching" || prevState.status === "fetching") {
      return;
    }

    // for debuging/ autofilling of form data
    if (process.env.NODE_ENV === 'development') {
      // @ts-ignore
      window.regOnChange = formData => this.onChange({ formData });
      debug('config', this.state.config);
    }
  }

  submitRegistration: SubmitRegistrationMethod = async ({ formData }: any) => {
    if (this.state.status === "fetching") return;

    const { invitation } = this.state.config;

    try {
      const data = await this.doPost({
        formData,
        pricingResults: this.state.totals,
        ...(!!invitation && { invitation }),
      });

      this.setState({
        status: "submitting",
        step: "payment",
        registrationUUID: data.registrationUUID,
        totals: data.serverPricingResults,
      });
    } catch(e) {
      console.error('submissionError', e);

      this.setState({ status: "submissionError" });
    }
  }

  submitPayment: SubmitPaymentMethod = async (paymentType, payPalResponse) => {
    if (this.state.status === "fetching") return;
    debug('submitPayment');

    this.setState({ status: "fetching" });

    try {
      const data = await this.doPost({
        step: "payment",
        registrationUUID: this.state.registrationUUID,
        paymentType,
        payPalResponse,
      });

      const confirmationProps = {
        markdown: data.confirmationPageTemplate,
        templateVars: { pricing_results: data.serverPricingResults },
      };

      debug(confirmationProps);

      this.setState({
        status: "submitted",
        confirmationProps,
      });

    } catch {
      this.setState({ status: "submissionError" });
    }
  }

  doPost = async (data: Object) => {
    debug('doPost', data);

    const response = await fetch(`/api/events/${this.props.match.params.eventId}/register`, {
      method: "POST",
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCsrfToken(),
      },
      body: JSON.stringify(data),
    });

    const responseData = await response.json();
    debug("doPost response", response.status, responseData);

    return responseData;
  };

  getConfig = async () => {
    let config: ApiRegister;

    const { eventId } = this.props.match.params;

    // for invitation params, e.g. ?email=foo@bar.baz&code=abc123
    const { search } = this.props.location;

    try {
      const res = await fetch(`/api/events/${eventId}/register${search}`);
      config = await res.json();
    } catch (e) {
      console.error(e);
      return;
    }

    this.setState({
      status: "loaded",
      step: "registration",
      config,
      formData: { campers: [{}] },
      totals: { campers: [] },
    });
  };

  onChange = ({ formData }: JsonSchemaFormChangeEvent<FormData>) => {
    if (this.state.status === "fetching") return;

    const data = { formData } as LoadedState;

    if (this.state.step === "registration") {
      data.totals = calculatePrice(this.state.config, formData)
      debug('recalculating totals', data.totals);
    };

    debug('onChange', data);

    this.setState(data);
  };

  onJsonSchemaFormError = (errors: Array<any>) => {
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

        const els = document.getElementById(id)?.focus();

        console.log(camperIndex, id, els);
      }
    });
  }

  render() {
    let pageContent: JSX.Element;
    switch (this.state.status) {
      case "loaded":
      case "submitting":
      case "submissionError": {
        pageContent = (
          <RegisterComponent
            config={this.state.config}
            step={this.state.step}
            formData={this.state.formData}
            onChange={this.onChange}
            onJsonSchemaFormError={this.onJsonSchemaFormError}
            submitRegistration={this.submitRegistration}
            submitPayment={this.submitPayment}
            totals={this.state.totals}
            UUID={this.state.registrationUUID}
          />
        );
        break;
      }
      case "submitted":
        pageContent = (
            !!this.state.confirmationProps &&
              <section className="confirmation">
                <Template {...this.state.confirmationProps} />
              </section>
        );
        break;
      default:
        pageContent = <Spinner />;
    }

    return (
      <Container>
        <Row className="justify-content-md-center">
          <Col className="RegisterPage">
            {pageContent}
          </Col>
        </Row>
      </Container>
    );
  }
}

export default withRouter(App);

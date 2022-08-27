import React from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import { RouteComponentProps, withRouter } from 'react-router';

import Spinner from 'components/Spinner';
import Template from 'components/Template';
import { getCsrfToken } from 'utils/fetch';
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

export interface FormDataState {
  config: ApiRegister;
  formData: FormData;
  totals: PricingResults;
  step: "registration" | "payment";
  registrationUUID?: string | number;
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
    }
  }

  onSubmit = async ({ formData }: any) => {
    if (this.state.status === "fetching") return;

    this.setState({ status: "submitting" });

    if (this.state.step === "registration") {
      this.submitRegistration(formData);
    } else if (this.state.step === "payment") {
      this.submitPayment();
    }
  };

  async submitRegistration(formData: any) {
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

  async submitPayment() {
    if (this.state.status === "fetching") return;

    try {
      const data = await this.doPost({
        step: "payment",
        registrationUUID: this.state.registrationUUID,
        paymentType: "check",
      });

      const confirmationProps = {
        markdown: data.confirmationPageTemplate,
        templateVars: { pricing_results: data.serverPricingResults },
      };

      console.log(confirmationProps);

      this.setState({
        status: "submitted",
        confirmationProps,
      });

    } catch {
      this.setState({ status: "submissionError" });
    }
  }

  doPost = async (data: Object) => {
    const response = await fetch(`/api/events/${this.props.match.params.eventId}/register`, {
      method: "POST",
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCsrfToken(),
      },
      body: JSON.stringify(data),
    });

    const responseData = await response.json();
    console.log("doPost response", response.status, responseData);

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

    const data = {
      formData,
      totals: calculatePrice(this.state.config, formData),
    } as LoadedState;

    // for debug
    // console.log(data);

    this.setState(data);
  };

  render() {
    console.log('step', this.state.step);

    let pageContent: JSX.Element;
    switch (this.state.status) {
      case "loaded":
      case "submitting": {
        pageContent = (
          <RegisterComponent
            config={this.state.config}
            step={this.state.step}
            formData={this.state.formData}
            onChange={this.onChange}
            onSubmit={this.onSubmit}
            totals={this.state.totals}
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

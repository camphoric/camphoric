import React from 'react';
import { Alert, Container, Row, Col } from 'react-bootstrap';
import { Helmet } from 'react-helmet';
import { RouteComponentProps, withRouter } from 'react-router';

import PayPalProvider from 'components/PayPalProvider';
import Spinner from 'components/Spinner';
import Template from 'components/Template';
import { getCsrfToken } from 'utils/fetch';

import JsonSchemaForm, {
  calculatePrice,
  PricingResults,
  FormData,
  JsonSchemaFormChangeEvent,
} from 'components/JsonSchemaForm';

import './styles.scss';

type PathParams = {
  eventId: string;
}

type Props = RouteComponentProps<PathParams>;

interface FetchingState {
  status: "fetching";
}

interface FormDataState {
  config: ApiRegister;
  formData: FormData;
  totals: PricingResults;
  step: "registration" | "payment";
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
  }

  onSubmit = async ({ formData }: any) => {
    if (this.state.status === "fetching") {
      return;
    }
    this.setState({ status: "submitting" });

    if (this.state.step === "registration") {
      this.submitRegistration(formData);
    } else if (this.state.step === "payment") {
      this.submitPayment();
    }
  };

  async submitRegistration(formData: any) {
    const { invitation } = this.state.config;
    try {
      const data = await this.doPost({
        formData,
        pricingResults: this.state.totals,
        ...(!!invitation && { invitation }),
      });

      this.setState({
        status: "submitted",
        step: "payment",
        registrationId: data.registrationId,
        totals: data.serverPricingResults,
      });
    } catch {
      this.setState({ status: "submissionError" });
    }
  }

  async submitPayment() {
    try {
      const data = await this.doPost({
        step: "payment"
        registrationId: this.state.registrationId,
        paymentType: "check",

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

  async doPost(data: Object) => {
    const response = fetch(`/api/events/${this.props.match.params.eventId}/register`, {
      method: "POST",
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCsrfToken(),
      },
      body: JSON.stringify(data),
    });

    const responseData = await response.json();
    console.log("response", response.status, responseData);

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
    if (this.state.status === "fetching") {
      return;
    }

    console.log(formData);

    const data = {
      formData,
      totals: calculatePrice(this.state.config, formData),
    } as LoadedState;

    // for debug
    // console.log(data);

    this.setState(data);
  };

  transformErrors = (errors: Array<any>) =>
    errors.map(error => {
      if (error.name === "pattern" && error.property === ".payer_number") {
        return {
          ...error,
          message: "Please enter a valid phone number"
        };
      }

      return error;
    });

  render() {
    let pageContent: JSX.Element;
    switch (this.state.status) {
      case "loaded":
      case "submitting": {
        const { invitation, invitationError, registrationType } = this.state.config;
        pageContent = (
          <section>
            <Helmet>
              <title>{this.state.config.dataSchema.title}</title>
            </Helmet>
            {
              !!invitation &&
              <Alert variant="success">
                <p>
                  { `Welcome, ${invitation.recipient_name || invitation.recipient_email}!` }
                </p>
                <p>
                  {
                    !!registrationType &&
                    `Special registration: ${registrationType.label}`
                  }
                </p>
              </Alert>
            }
            {
              !!invitationError &&
              <Alert variant="warning">
                { invitationError }
              </Alert>
            }
            {
              this.state.step === "registration" &&
              <div className="registration-form">
                <JsonSchemaForm
                  schema={this.state.config.dataSchema}
                  uiSchema={this.state.config.uiSchema}
                  onChange={this.onChange}
                  onSubmit={this.onSubmit}
                  onError={() => console.log("errors")}
                  formData={this.state.formData}
                  transformErrors={this.transformErrors}

                  templateData={{
                    pricing: this.state.config.pricing,
                    formData: this.state.formData,
                    totals: this.state.totals,
                  }}
                  // liveValidate={true}
                >
                  <div>
                    <p>
                      By submitting this form, you agree to the{" "}
                      <a
                        href="http://www.larkcamp.org/campterms.html"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Terms of Registration
                      </a>
                      .
                    </p>
                    <button type="submit" className="btn btn-info">
                      Continue to payment
                    </button>
                  </div>
                </JsonSchemaForm>
              </div>
            }
            {
              this.state.step === "payment" &&
                <button type="submit" className="btn btn-info">
                  Pay by check
                </button>
            }
            <div className="PriceTicker">
              Total: ${(this.state.totals.total || 0).toFixed(2)}
            </div>
          </section>
        );
        break;
      }
      case "submitted":
        pageContent = (
          {
            this.state.confirmationProps &&
            <section className="confirmation">
              <Template {...this.state.confirmationProps} />
            </section>
          }
        );
        break;
      default:
        pageContent = <Spinner />;
    }

    const payPalOptions = 'config' in this.state ? this.state.config.payPalOptions : null;

    return (
      <PayPalProvider options={payPalOptions}>
        <Container>
          <Row className="justify-content-md-center">
            <Col className="RegisterPage">
              {pageContent}
            </Col>
          </Row>
        </Container>
      </PayPalProvider>
    );
  }
}

export default withRouter(App);

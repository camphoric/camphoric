import React from 'react';
import { RouteComponentProps, withRouter } from 'react-router';
import { Alert, Container, Row, Col } from 'react-bootstrap';

import Spinner from '../Spinner';

import JsonSchemaForm, {
  calculatePrice,
  PricingResults,
  FormData,
  JsonSchemaFormChangeEvent,
} from '../JsonSchemaForm';

import './RegisterPage.scss';

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
}

interface LoadedState extends FormDataState {
  status: "loaded";
}

interface SubmittingState extends FormDataState {
  status: "submitting";
}

interface SubmittedState extends FormDataState {
  status: "submitted";
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
    const { invitation } = this.state.config;
    this.setState({ status: "submitting" });
    try {
      const res = await fetch(`/api/events/${this.props.match.params.eventId}/register`, {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          formData,
          pricingResults: this.state.totals,
          ...(!!invitation && { invitation }),
        }),
      });
      const text = await res.text();
      console.log("response", res.status, text);
      this.setState({ status: "submitted" });
    } catch {
      this.setState({ status: "submissionError" });
    }
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
      config,
      formData: { campers: [{}] },
      totals: { campers: [] },
    });
  };

  onChange = ({ formData }: JsonSchemaFormChangeEvent<FormData>) => {
    if (this.state.status === "fetching") {
      return;
    }
    
    this.setState(({ 
      formData,
      totals: calculatePrice(this.state.config, formData),
    }) as LoadedState);
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
            {
              !!invitation &&
              <Alert variant="success">
                <p>
                  { `Welcome, ${invitation.recipient_email}!` }
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
                  Submit Registration
                </button>
              </div>
            </JsonSchemaForm>
            <div className="PriceTicker">
              Total: ${(this.state.totals.total || 0).toFixed(2)}
            </div>
          </section>
        );
        break;
      }
      case "submitted":
        pageContent = (
          <section className="reciept">
            <h1>You're all set!</h1>
            <h2>See you at Lark Camp 2020!</h2>
            <p>
              {" "}
              If you're paying by PayPal or credit card, we'll be sending you a
              confirmation with payment instructions within the next week. If
              you're paying by check, please make it for{" "}
              <strong> ${this.state.totals.total} </strong>
              payable to "Lark Camp", and mail it to:{" "}
            </p>

            <address>
              {" "}
              Lark Camp
              <br /> PO Box 1724
              <br /> Mendocino, CA 95460
              <br /> USA{" "}
            </address>

            <p>
              Do you need approval for your vehicle or trailer, have questions
              about carpooling, payments, meals, ordering t-shirts, or anything
              else? Email us at
              <a href="mailto: registration@larkcamp.org">
                {" "}
                registration@larkcamp.org{" "}
              </a>
              or call 707-397-5275.
            </p>

            <a href="https://www.larkcamp.org">
              Visit our website at www.larkcamp.org for more information!
            </a>
          </section>
        );
        break;
      default:
        pageContent = <Spinner />;
    }

    return (
      <Container><Row className="justify-content-md-center"><Col className="RegisterPage">
        {pageContent}
      </Col></Row></Container>
    );
  }
}

export default withRouter(App);

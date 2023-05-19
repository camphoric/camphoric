import React from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import { Helmet } from 'react-helmet';
import ErrorBoundary from 'components/ErrorBoundary';
import Spinner from 'components/Spinner';
import InvitationInfo from './InvitationInfo';
import RegistrationClosed from './RegistrationClosed';

import api from 'store/register/api';

import './styles.scss';

function PageWrapper(props: any) {
  const registrationApi = api.useGetRegistrationQuery();

  if (
    registrationApi.isFetching ||
    registrationApi.isLoading ||
    !registrationApi.data
  ) return <Spinner />;

  if (!registrationApi.data.event.is_open && !registrationApi.data.invitation) {
    return <RegistrationClosed />;
  }

  return (
    <Container>
      <Row className="justify-content-md-center">
        <Col className="RegisterPage">
          <section>
            <Helmet>
              <title>{registrationApi.data.dataSchema.title}</title>
            </Helmet>
            <div className="registration-form">
              <ErrorBoundary section="InvitationInfo">
                <InvitationInfo />
              </ErrorBoundary>
              { props.children }
            </div>
          </section>
        </Col>
      </Row>
    </Container>
  );
}

export default PageWrapper;

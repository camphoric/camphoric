import React from 'react';
import { Container, Row, Col } from 'react-bootstrap';

import Spinner from '../../Spinner';

/**
 * A login form
 */

type LoginProps = {
  onLoginSuccess: (authToken: string) => void,
  onLoginFail: (error: Error) => void,
};

type LoginState = {
  processing: boolean,
  authToken?: string,
  username: string,
  password: string,
};

class Login extends React.Component<LoginProps, LoginState> {
  state: LoginState = {
    processing: false,
    username: '',
    password: '',
  }

  attemptLogin = async () => {
    this.setState({ processing: true });
    const formData = new FormData();
    formData.append('username', this.state.username);
    formData.append('password', this.state.password);

    try {
      const response = await fetch(
        '/api-token-auth/',
        { method: 'POST', body: formData },
      );

      const json = await response.json();

      const token = json.token;
      this.setState({ processing: false });

      this.props.onLoginSuccess(token);
    } catch (e) {
      console.log(e);
      this.props.onLoginFail(e);
      this.setState({ processing: false });
    }
  }

  onPasswordKeyPress = (target: React.KeyboardEvent) => {
    if (target.charCode === 13) {
      this.attemptLogin();
    }
  }


  render() {
    return (
      <Container><Row className="justify-content-md-center"><Col>
        <form>
          <h1>Login</h1>
          <div className="form-group">
            <label>Login:</label>
            <input
              className="form-control"
              type="text"
              name="username"
              disabled={this.state.processing}
              onChange={e => this.setState({ username: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Password:</label>
            <input
              className="form-control"
              type="password"
              name="password"
              disabled={this.state.processing}
              onChange={e => this.setState({ password: e.target.value })}
              onKeyPress={this.onPasswordKeyPress}
            />
          </div>

          <button
            onClick={this.attemptLogin}
            disabled={this.state.processing}
          >
            Login
          </button>
          <div className="processing">
            { !!this.state.processing && <Spinner text="Logging in..." color="black" /> }
          </div>
        </form>
      </Col></Row></Container>
    );
  }
}

export default Login;

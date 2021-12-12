/**
 * A login form
 */

import React from 'react';
import { Container, Row, Col } from 'react-bootstrap';

import Spinner from 'components/Spinner';

import { UserInfo } from 'hooks/admin';
import './styles.scss';

type LoginProps = {
  onLoginSuccess: (user: UserInfo) => void,
  onLoginFail: (error: any) => void, // catch errors are always type any
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

    const credentials = {
      username: this.state.username,
      password: this.state.password,
    };

    try {
      const match = document.cookie.match(/\bcsrftoken=([^;]+)/);
      const csrf = (match && match[1]) || '';

      const response = await fetch(
        '/api/login',
        {
          method: 'POST',
          body: JSON.stringify(credentials),
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrf,
          },
        },
      );

      if (!response.ok) throw new Error('login failed');

      const user = await response.json();

      this.setState({ processing: false });

      this.props.onLoginSuccess(user);
    } catch (e) {
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
      <Container className="login-form"><Row className="justify-content-md-center"><Col>
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

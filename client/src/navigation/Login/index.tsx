/**
 * A login form
 */

import React from 'react';
import { Container, Row, Col } from 'react-bootstrap';

import Spinner from 'components/Spinner';

import api from 'store/admin/api';
import './styles.scss';

function Login() {
  const [login, loginState] = api.useLoginMutation();
  const [password, setPassword] = React.useState<string>();
  const [username, setUsername] = React.useState<string>();

  const attemptLogin = async () => {
    if (!username) return;
    if (!password) return;

    login({ username, password });
  }

  const onPasswordKeyPress = (target: React.KeyboardEvent) => {
    if (target.charCode === 13) {
      attemptLogin();
    }
  }

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
            disabled={loginState.isLoading}
            onChange={e => setUsername(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Password:</label>
          <input
            className="form-control"
            type="password"
            name="password"
            disabled={loginState.isLoading}
            onChange={e => setPassword(e.target.value)}
            onKeyPress={onPasswordKeyPress}
          />
        </div>
        <button
          onClick={attemptLogin}
          disabled={
            loginState.isLoading ||
            !username ||
            !password
          }
        >
          Login
        </button>
        <div className="processing">
          { !!loginState.isLoading && <Spinner text="Logging in..." color="black" /> }
        </div>
      </form>
    </Col></Row></Container>
  );
}

export default Login;

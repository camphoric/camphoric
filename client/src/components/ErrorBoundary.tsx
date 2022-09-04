import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  section?: string;
}

interface State {
  error?: Error;
  errorInfo?: ErrorInfo;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = { };

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  public render() {
    if (this.state.error) {
      const section = this.props.section ? ` with ${this.props.section}` : '';

      return process.env.NODE_ENV === 'development' ? (
        <>
          <strong>Something went wrong{section}.</strong>;
          <details style={{ whiteSpace: 'pre-wrap' }}>
            {this.state.error && this.state.error.toString()}
            <br />
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </details>
        </>
      ) : null;
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

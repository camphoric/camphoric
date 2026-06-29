/**
 * Isolates failures in risky subtrees (the registration form, invitation
 * context, report rendering) so one failure doesn't take down the page
 * (SPEC §9.6, §11). Shows detail in dev; fails quietly in prod.
 */

import { Alert } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Optional custom fallback; receives the caught error. */
  fallback?: (error: Error) => ReactNode;
}

interface State {
  error: Error | null;
}

const isDev = import.meta.env.DEV;

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface enough context to debug rather than swallowing it (CONTRIBUTING).
    console.error('ErrorBoundary caught an error', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error);

    return (
      <Alert
        icon={<IconAlertTriangle size={18} />}
        color="red"
        title="Something went wrong"
        variant="light"
      >
        {isDev ? error.message : 'An unexpected error occurred. Please try again.'}
      </Alert>
    );
  }
}

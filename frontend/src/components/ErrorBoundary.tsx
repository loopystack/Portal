import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('App error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <div
          style={{
            padding: '2rem',
            fontFamily: 'sans-serif',
            color: '#333',
            maxWidth: '600px',
            margin: '2rem auto',
          }}
        >
          <h2 style={{ color: '#c00' }}>Something went wrong</h2>
          <pre style={{ overflow: 'auto', background: '#f5f5f5', padding: '1rem' }}>
            {this.state.error.message}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

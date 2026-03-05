'use client';

/**
 * Per-panel error boundary with recovery button.
 * @module components/shared/error-boundary
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  handleRecover = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <div
            className="mb-2 text-2xl"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--danger)' }}
          >
            !
          </div>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {this.props.fallbackTitle ?? 'Something went wrong'}
          </h3>
          <p className="mt-1 max-w-[280px] text-xs" style={{ color: 'var(--text-secondary)' }}>
            {this.state.error?.message ?? 'An unexpected error occurred'}
          </p>
          <button
            type="button"
            onClick={this.handleRecover}
            className="mt-4 min-h-[44px] rounded-lg border px-4 py-2 text-xs font-medium"
            style={{
              borderColor: 'var(--border)',
              color: 'var(--text-primary)',
              background: 'var(--bg-elevated)',
            }}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

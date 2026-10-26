// Top-level error boundary: keeps a render error from blanking the whole app.
import { Component } from 'react';
import { Icon } from './ui/index.jsx';

export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[CUET AI Campus] Unhandled UI error', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-bg p-6">
        <div className="w-full max-w-md rounded-3xl border border-outline bg-surface p-8 text-center shadow-xl">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-danger/10 text-danger">
            <Icon name="error" size={28} />
          </span>
          <h1 className="mt-5 text-headline-sm font-semibold text-ink">Something went wrong</h1>
          <p className="mt-2 text-body-md text-ink-muted">
            This page hit an unexpected error. Your data is safe — try again or reload the app.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              className="rounded-xl border border-outline px-4 py-2.5 text-label-lg font-medium text-ink transition-colors hover:bg-surface-variant"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-xl bg-primary px-4 py-2.5 text-label-lg font-medium text-white transition-colors hover:bg-primary-light"
            >
              Reload app
            </button>
          </div>
        </div>
      </div>
    );
  }
}

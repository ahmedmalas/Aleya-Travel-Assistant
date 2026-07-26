import { Component, type ErrorInfo, type ReactNode } from 'react';
import { PrimaryButton, SecondaryButton } from './trip-platform/shared/ui';

type Props = { children: ReactNode; title?: string };
type State = { error: Error | null };

const CHUNK_RELOAD_KEY = 'aleya-travel:chunk-reload';
const isStaleChunkError = (error: Error) =>
  /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk .* failed/i.test(error.message);

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Aleya Travel UI error:', error, info.componentStack);
    if (!isStaleChunkError(error)) return;

    const lastReload = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || 0);
    if (Date.now() - lastReload > 60_000) {
      sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
      const url = new URL(window.location.href);
      url.searchParams.set('appVersion', String(Date.now()));
      window.location.replace(url.toString());
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    const staleChunk = isStaleChunkError(this.state.error);
    return (
      <div className="rounded-3xl border border-rose-300/30 bg-rose-950/30 p-6 text-rose-50" role="alert">
        <h2 className="text-xl font-semibold">{staleChunk ? 'Aleya has been updated' : this.props.title ?? 'Something went wrong'}</h2>
        <p className="mt-2 text-sm text-rose-100/90">
          {staleChunk
            ? 'Your browser opened an older version of this screen. Refresh once to load the latest hotel and trip tools. Your saved data remains intact.'
            : 'The panel failed to render. Your local data should still be intact — try reloading or opening another tab.'}
        </p>
        <p className="mt-3 rounded-xl bg-black/20 px-3 py-2 font-mono text-xs">{this.state.error.message}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <PrimaryButton type="button" onClick={() => this.setState({ error: null })}>Try again</PrimaryButton>
          <SecondaryButton type="button" onClick={() => {
            sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
            const url = new URL(window.location.href);
            url.searchParams.set('appVersion', String(Date.now()));
            window.location.replace(url.toString());
          }}>Load latest version</SecondaryButton>
        </div>
      </div>
    );
  }
}

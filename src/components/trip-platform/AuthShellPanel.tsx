import { useEffect, useState } from 'react';
import { useSharedTripStore } from '../../store/TripStoreContext';
import { Field, Panel, PrimaryButton, SecondaryButton, StatusBanner, inputClassName } from './shared/ui';

export function AuthShellPanel() {
  const {
    authState,
    authProvider,
    emailVerified,
    authSignIn,
    authSignUp,
    authSignOut,
    authForgotPassword,
    authResetPassword,
    authEnterDemoMode,
    authSetScreen,
    authClearError,
    authHydrateSession,
    cloudRuntime,
    supabaseTargetVerification,
  } = useSharedTripStore();
  const cloudConfigured = cloudRuntime.clientConfigured;
  const [email, setEmail] = useState(cloudConfigured ? '' : 'demo@travelbuddy.local');
  const [password, setPassword] = useState(cloudConfigured ? '' : 'demo-demo');
  const [displayName, setDisplayName] = useState(cloudConfigured ? '' : 'Demo Traveller');
  const [resetToken, setResetToken] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void authHydrateSession();
  }, []);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel
      title="Authentication"
      description={
        cloudConfigured
          ? 'Live Supabase Auth for Aleya Travel Assistant. Session persistence, refresh, and password visibility included.'
          : 'Local/demo mode — configure VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY for cloud auth.'
      }
    >
      <StatusBanner
        kind={supabaseTargetVerification.verified ? 'info' : 'error'}
        message={
          supabaseTargetVerification.verified
            ? `Supabase target verified${cloudRuntime.remoteMigrationsApplied ? ' · schema applied' : ''}.`
            : `Target unverified — ${supabaseTargetVerification.reason}`
        }
      />
      {authState.message ? <StatusBanner kind="info" message={authState.message} /> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {(['sign-in', 'sign-up', 'forgot-password', 'reset-password', 'session'] as const).map((screen) => (
          <SecondaryButton key={screen} type="button" onClick={() => authSetScreen(screen)} aria-pressed={authState.screen === screen}>
            {screen}
          </SecondaryButton>
        ))}
        {!cloudConfigured ? (
          <SecondaryButton type="button" onClick={() => authEnterDemoMode()}>
            Demo/local mode
          </SecondaryButton>
        ) : null}
        <SecondaryButton type="button" onClick={() => authClearError()}>
          Clear auth errors
        </SecondaryButton>
      </div>

      <p className="mt-4 text-sm text-slate-300">
        Mode: <span className="text-white">{authState.mode}</span>
        {' · '}
        Provider: <span className="text-white">{authProvider}</span>
        {' · '}
        Env: <span className="text-white">{cloudRuntime.env.ok ? 'configured' : 'local-demo'}</span>
        {emailVerified === null ? '' : ` · Email verified: ${emailVerified ? 'yes' : 'pending'}`}
        {authState.user ? ` · ${authState.user.displayName} (${authState.user.email})` : ' · no session user'}
      </p>

      {(authState.screen === 'sign-in' || authState.screen === 'sign-up' || authState.screen === 'forgot-password') && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Field label="Email" htmlFor="auth-email">
            <input id="auth-email" className={inputClassName} autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          {authState.screen !== 'forgot-password' ? (
            <Field label="Password" htmlFor="auth-password">
              <div className="flex gap-2">
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  className={inputClassName}
                  autoComplete={authState.screen === 'sign-up' ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <SecondaryButton type="button" aria-pressed={showPassword} onClick={() => setShowPassword((value) => !value)}>
                  {showPassword ? 'Hide' : 'Show'}
                </SecondaryButton>
              </div>
            </Field>
          ) : null}
          {authState.screen === 'sign-up' ? (
            <Field label="Display name" htmlFor="auth-name">
              <input id="auth-name" className={inputClassName} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </Field>
          ) : null}
        </div>
      )}

      {authState.screen === 'reset-password' ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Field label="Reset token (local demo)" htmlFor="auth-token">
            <input
              id="auth-token"
              className={inputClassName}
              value={resetToken || authState.resetToken || ''}
              onChange={(e) => setResetToken(e.target.value)}
            />
          </Field>
          <Field label="New password" htmlFor="auth-new-password">
            <div className="flex gap-2">
              <input
                id="auth-new-password"
                type={showPassword ? 'text' : 'password'}
                className={inputClassName}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <SecondaryButton type="button" onClick={() => setShowPassword((value) => !value)}>
                {showPassword ? 'Hide' : 'Show'}
              </SecondaryButton>
            </div>
          </Field>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {authState.screen === 'sign-in' ? (
          <PrimaryButton type="button" disabled={busy} onClick={() => void run(() => authSignIn(email, password))}>
            Sign in
          </PrimaryButton>
        ) : null}
        {authState.screen === 'sign-up' ? (
          <PrimaryButton type="button" disabled={busy} onClick={() => void run(() => authSignUp(email, password, displayName))}>
            Sign up
          </PrimaryButton>
        ) : null}
        {authState.screen === 'forgot-password' ? (
          <PrimaryButton type="button" disabled={busy} onClick={() => void run(() => authForgotPassword(email))}>
            Send reset email / token
          </PrimaryButton>
        ) : null}
        {authState.screen === 'reset-password' ? (
          <PrimaryButton
            type="button"
            disabled={busy}
            onClick={() => void run(() => authResetPassword(resetToken || authState.resetToken || '', password))}
          >
            Reset password
          </PrimaryButton>
        ) : null}
        {authState.screen === 'session' ? (
          <SecondaryButton type="button" disabled={busy} onClick={() => void run(() => authSignOut())}>
            Sign out
          </SecondaryButton>
        ) : null}
      </div>
    </Panel>
  );
}

import { useEffect, useState } from 'react';
import { useSharedTripStore } from '../store/TripStoreContext';

type AuthView = 'welcome' | 'sign-in' | 'sign-up' | 'forgot';

export function WelcomeAuthGate({ onEnter }: { onEnter: () => void }) {
  const {
    authState,
    authSignIn,
    authSignUp,
    authForgotPassword,
    authEnterDemoMode,
    authHydrateSession,
    cloudRuntime,
  } = useSharedTripStore();
  const [view, setView] = useState<AuthView>('welcome');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    void authHydrateSession();
  }, []);

  useEffect(() => {
    if (authState.mode === 'signed-in' || authState.mode === 'demo-local') onEnter();
  }, [authState.mode, onEnter]);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setNotice('');
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };

  const inputClass = 'w-full rounded-2xl border border-white/15 bg-slate-950/70 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-sky-300/50';

  if (view === 'welcome') {
    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <section className="relative overflow-hidden px-6 py-20 md:py-28">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.18),transparent_38%),radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.12),transparent_35%)]" />
          <div className="relative mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.42em] text-sky-300">Aleya Travel</p>
              <h1 className="mt-6 max-w-4xl text-5xl font-black tracking-tight md:text-7xl">Your AI travel agent, from first idea to the journey home.</h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">Plan complete trips, compare smarter options, organise bookings, manage money abroad and receive personal travel assistance in one place.</p>
              <div className="mt-9 flex flex-wrap gap-3">
                <button type="button" onClick={() => setView('sign-up')} className="rounded-full bg-sky-400 px-6 py-3 font-semibold text-slate-950 hover:bg-sky-300">Create my account</button>
                <button type="button" onClick={() => setView('sign-in')} className="rounded-full border border-white/20 px-6 py-3 font-semibold text-white hover:border-sky-300">Sign in</button>
                <button type="button" onClick={() => { authEnterDemoMode(); onEnter(); }} className="rounded-full px-6 py-3 text-sm font-semibold text-slate-300 hover:text-white">Explore as guest</button>
              </div>
              <p className="mt-4 text-xs text-slate-500">Guest trips remain on this device. Create an account to support secure cloud access and multi-device use.</p>
            </div>
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.05] p-6 shadow-2xl shadow-sky-950/40 backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-300">Ask Aleya</p>
              <p className="mt-4 text-2xl font-semibold">“Plan 14 days in Japan in October.”</p>
              <div className="mt-6 space-y-3 text-sm text-slate-300">
                <p className="rounded-2xl bg-slate-950/60 p-4">Flying Tuesday instead of Friday may save hundreds of dollars.</p>
                <p className="rounded-2xl bg-slate-950/60 p-4">Compare neighbourhoods by transport, atmosphere and total trip cost.</p>
                <p className="rounded-2xl bg-slate-950/60 p-4">Build the itinerary, budget, bookings and travel documents together.</p>
              </div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-12 text-white">
      <section className="w-full max-w-lg rounded-[2rem] border border-white/10 bg-white/[0.05] p-7 shadow-2xl shadow-sky-950/40">
        <button type="button" onClick={() => setView('welcome')} className="text-sm text-slate-400 hover:text-white">← Back to welcome</button>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.32em] text-sky-300">Aleya Travel</p>
        <h1 className="mt-2 text-3xl font-bold">{view === 'sign-up' ? 'Create your account' : view === 'forgot' ? 'Reset your password' : 'Welcome back'}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">{cloudRuntime.clientConfigured ? 'Securely access your trips and travel plans across your devices.' : 'Create an account with email or continue as a guest while Aleya is being prepared for public launch.'}</p>

        <div className="mt-6 space-y-4">
          {view === 'sign-up' ? <label className="block text-sm text-slate-200"><span className="mb-2 block">Name</span><input className={inputClass} value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" /></label> : null}
          <label className="block text-sm text-slate-200"><span className="mb-2 block">Email</span><input type="email" className={inputClass} value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></label>
          {view !== 'forgot' ? <label className="block text-sm text-slate-200"><span className="mb-2 block">Password</span><div className="flex gap-2"><input type={showPassword ? 'text' : 'password'} className={inputClass} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={view === 'sign-up' ? 'new-password' : 'current-password'} /><button type="button" onClick={() => setShowPassword((value) => !value)} className="rounded-2xl border border-white/15 px-4 text-sm">{showPassword ? 'Hide' : 'Show'}</button></div></label> : null}
        </div>

        {authState.message ? <p className="mt-4 rounded-xl border border-sky-300/25 bg-sky-500/10 p-3 text-sm text-sky-100">{authState.message}</p> : null}
        {notice ? <p className="mt-4 text-sm text-slate-300">{notice}</p> : null}

        <button type="button" disabled={busy || !email || (view !== 'forgot' && !password)} onClick={() => {
          if (view === 'sign-up') void run(() => authSignUp(email, password, displayName));
          else if (view === 'forgot') void run(async () => { await authForgotPassword(email); setNotice('Check your email for password reset instructions.'); });
          else void run(() => authSignIn(email, password));
        }} className="mt-6 w-full rounded-full bg-sky-400 px-5 py-3 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50">
          {busy ? 'Please wait…' : view === 'sign-up' ? 'Create account' : view === 'forgot' ? 'Send reset link' : 'Sign in'}
        </button>

        <div className="mt-5 flex flex-wrap justify-between gap-3 text-sm">
          {view === 'sign-in' ? <button type="button" onClick={() => setView('forgot')} className="text-sky-300">Forgot password?</button> : <span />}
          <button type="button" onClick={() => setView(view === 'sign-up' ? 'sign-in' : 'sign-up')} className="text-sky-300">{view === 'sign-up' ? 'Already have an account?' : 'Create an account'}</button>
        </div>
      </section>
    </main>
  );
}

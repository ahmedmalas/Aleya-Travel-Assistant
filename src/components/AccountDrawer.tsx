import { useEffect, useState } from 'react';
import { UserProfilePanel, type ProfileSection } from './UserProfilePanel';

type AccountView = 'menu' | ProfileSection | 'help';

const menuItems: Array<{ id: ProfileSection | 'help'; title: string; description: string }> = [
  { id: 'personal', title: 'Personal details', description: 'Name, email address, mobile number and identity.' },
  { id: 'regional', title: 'Home and regional details', description: 'Home city, airport, language, time zone and currency.' },
  { id: 'preferences', title: 'Travel preferences', description: 'Cabin, seating, accommodation and accessibility preferences.' },
  { id: 'emergency', title: 'Emergency information', description: 'Emergency contact details kept separately.' },
  { id: 'help', title: 'Help & support', description: 'Get help, report an issue or contact Aleya support.' },
];

export function AccountDrawer({ onClose, onSignOut }: { onClose: () => void; onSignOut: () => void }) {
  const [view, setView] = useState<AccountView>('menu');

  useEffect(() => {
    const back = () => setView('menu');
    window.addEventListener('aleya-account-back', back);
    return () => window.removeEventListener('aleya-account-back', back);
  }, []);

  const supportSubject = encodeURIComponent('Aleya Travel support request');
  const issueSubject = encodeURIComponent('Aleya Travel issue report');

  return (
    <div className="fixed inset-0 z-[80] bg-slate-950/75 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="My Aleya account">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close account" onClick={onClose} />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-2xl flex-col overflow-hidden border-l border-white/10 bg-slate-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div><p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-300">My Aleya</p><h2 className="mt-1 text-2xl font-bold">Account</h2></div>
          <button type="button" onClick={onClose} className="rounded-full border border-white/15 px-4 py-2 text-sm hover:border-sky-300">Close</button>
        </div>

        <div className="flex-1 overflow-y-auto py-6">
          {view === 'menu' ? (
            <div className="flex min-h-full flex-col px-6">
              <p className="text-sm text-slate-400">Choose what you want to view or update.</p>
              <div className="mt-5 space-y-3">
                {menuItems.map((item) => (
                  <button key={item.id} type="button" onClick={() => setView(item.id)} className="w-full rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left hover:border-sky-300/60 hover:bg-sky-400/[0.06]">
                    <span className="block font-semibold text-white">{item.title}</span>
                    <span className="mt-1 block text-sm leading-6 text-slate-400">{item.description}</span>
                  </button>
                ))}
              </div>
              <button type="button" onClick={onSignOut} className="mt-auto w-full border-t border-white/10 py-5 text-left font-semibold text-rose-200 hover:text-rose-100">Sign out</button>
            </div>
          ) : null}

          {view === 'personal' || view === 'regional' || view === 'preferences' || view === 'emergency' ? <UserProfilePanel section={view} /> : null}

          {view === 'help' ? (
            <section className="px-6 pb-8">
              <button type="button" onClick={() => setView('menu')} className="mb-5 text-sm text-sky-300 hover:text-sky-200">← Back to account</button>
              <h2 className="text-3xl font-bold">Help & support</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">Get help using Aleya, report something that is not working, or contact our support team.</p>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <a href={`mailto:support@aleya.travel?subject=${supportSubject}`} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 hover:border-sky-300/60"><span className="font-semibold text-white">Contact support</span><span className="mt-2 block text-sm text-slate-400">Ask a question or request assistance.</span></a>
                <a href={`mailto:support@aleya.travel?subject=${issueSubject}`} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 hover:border-sky-300/60"><span className="font-semibold text-white">Report an issue</span><span className="mt-2 block text-sm text-slate-400">Tell us what went wrong and where it happened.</span></a>
              </div>
              <div className="mt-6 rounded-2xl border border-white/10 bg-slate-900/60 p-5">
                <h3 className="font-semibold text-white">Include these details</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">What you were trying to do, what happened instead, and a screenshot where possible.</p>
              </div>
            </section>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

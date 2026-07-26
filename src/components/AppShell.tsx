import { useRef, useState, type FormEvent } from 'react';
import { SectionCard } from './SectionCard';
import { TripPlatform } from './trip-platform/TripPlatform';
import { CurrencyBootstrap } from './CurrencyBootstrap';
import { UserProfilePanel } from './UserProfilePanel';
import { MoneyServicesPanel } from './MoneyServicesPanel';
import { VisaEntryPanel } from './VisaEntryPanel';
import { WelcomeAuthGate } from './WelcomeAuthGate';
import { TripStoreProvider } from '../store/TripStoreContext';
import { travelSections } from '../data/sections';
import { detectUserCurrency } from '../lib/currency';

const normaliseAirport = (value: string) => value.trim().toLowerCase().replace(/[^a-z]/g, '').slice(0, 3);
const compactDate = (value: string) => value.replaceAll('-', '').slice(2);
const today = new Date().toISOString().split('T')[0];

function CustomerApp() {
  const [entered, setEntered] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [origin, setOrigin] = useState('SYD');
  const [destination, setDestination] = useState('MEL');
  const [departDate, setDepartDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [travellers, setTravellers] = useState(1);
  const [flightError, setFlightError] = useState<string | null>(null);
  const departureInputRef = useRef<HTMLInputElement>(null);
  const returnInputRef = useRef<HTMLInputElement>(null);
  const preferredCurrency = detectUserCurrency();

  if (!entered) return <WelcomeAuthGate onEnter={() => setEntered(true)} />;

  const openCalendar = (input: HTMLInputElement | null) => {
    if (!input) return;
    input.focus();
    if ('showPicker' in input) input.showPicker();
  };

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const openPlatformTool = (tabId: 'stays' | 'itinerary') => {
    const groupLabel = tabId === 'stays' ? 'Book' : 'Plan';
    scrollToSection('trip-platform');
    window.setTimeout(() => {
      const groupButton = Array.from(document.querySelectorAll<HTMLButtonElement>('nav[aria-label="Platform sections"] button')).find(
        (button) => button.textContent?.trim() === groupLabel,
      );
      groupButton?.click();
      window.setTimeout(() => {
        document.getElementById(`trip-platform-tab-${tabId}`)?.click();
        document.getElementById(`trip-platform-panel-${tabId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }, 100);
  };

  const searchFlights = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const from = normaliseAirport(origin);
    const to = normaliseAirport(destination);
    if (from.length !== 3 || to.length !== 3) {
      setFlightError('Enter valid three-letter airport codes, such as SYD and MEL.');
      return;
    }
    if (!departDate) {
      setFlightError('Choose a departure date.');
      return;
    }
    if (returnDate && returnDate < departDate) {
      setFlightError('The return date must be after the departure date.');
      return;
    }
    setFlightError(null);
    const outbound = compactDate(departDate);
    const inbound = returnDate ? `/${compactDate(returnDate)}` : '';
    const url = `https://www.skyscanner.com.au/transport/flights/${from}/${to}/${outbound}${inbound}/?adultsv2=${travellers}&cabinclass=economy&currency=${preferredCurrency}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const shortcutClass = 'rounded-full bg-white/10 px-4 py-2 text-slate-300 hover:bg-sky-400/20 hover:text-white';

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <CurrencyBootstrap />
      <style>{`
        .customer-trip-platform > section > div:first-child > div:first-child {
          display: none;
        }
        .customer-trip-platform > section > div:first-child > p[role='status'][class*='border-sky-300'] {
          display: none;
        }
      `}</style>
      <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <a href="#top" className="block" aria-label="Aleya Travel home"><p className="text-sm uppercase tracking-[0.4em] text-sky-300">Aleya Travel</p><h1 className="mt-1 text-xl font-bold">AI Travel Assistant</h1></a>
          <nav className="flex flex-wrap items-center justify-end gap-2" aria-label="Customer navigation">
            <button type="button" onClick={() => scrollToSection('visa-entry')} className="rounded-full border border-white/15 px-4 py-2 text-sm text-slate-200 hover:border-sky-300">Visas & entry</button>
            <button type="button" onClick={() => scrollToSection('money-services')} className="rounded-full border border-white/15 px-4 py-2 text-sm text-slate-200 hover:border-sky-300">Money & ATMs</button>
            <button type="button" onClick={() => scrollToSection('flight-search')} className="rounded-full border border-white/15 px-4 py-2 text-sm text-slate-200 hover:border-sky-300">Search</button>
            <button type="button" onClick={() => scrollToSection('trip-platform')} className="rounded-full bg-sky-400/20 px-4 py-2 text-sm text-sky-100 hover:bg-sky-400/30">My trips</button>
            <button type="button" onClick={() => setAccountOpen(true)} className="flex h-10 items-center gap-2 rounded-full border border-white/15 bg-white/[0.05] pl-2 pr-4 text-sm text-white hover:border-sky-300" aria-label="Open my account"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-400 font-bold text-slate-950">A</span><span className="hidden sm:inline">Ahmed</span></button>
          </nav>
        </div>
      </header>

      <main id="top">
        <section className="mx-auto grid max-w-7xl gap-10 px-6 py-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-16">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.4em] text-sky-300">Welcome to your travel dashboard</p>
            <h2 className="mt-6 max-w-4xl text-4xl font-black tracking-tight text-white md:text-6xl">Where will Aleya take you next?</h2>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">Search flights, organise accommodation, build itineraries, track bookings and manage your travel plans from one personalised place.</p>
            <div className="mt-8 flex flex-wrap gap-3 text-sm">
              <button type="button" onClick={() => scrollToSection('flight-search')} className={shortcutClass}>Flights</button>
              <button type="button" onClick={() => openPlatformTool('stays')} className={shortcutClass}>Hotels</button>
              <button type="button" onClick={() => openPlatformTool('itinerary')} className={shortcutClass}>Itineraries</button>
              <button type="button" onClick={() => scrollToSection('visa-entry')} className={shortcutClass}>Visa requirements</button>
              <button type="button" onClick={() => scrollToSection('money-services')} className={shortcutClass}>Exchange & ATMs</button>
            </div>
          </div>

          <form id="flight-search" onSubmit={searchFlights} className="scroll-mt-28 rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-sky-950/30">
            <p className="text-sm uppercase tracking-[0.32em] text-sky-300">Quick search</p><h3 className="mt-2 text-2xl font-bold">Find available flights</h3>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm text-slate-200"><span className="mb-2 block">From</span><input aria-label="Origin airport" required maxLength={3} value={origin} onChange={(event) => setOrigin(event.target.value.toUpperCase())} placeholder="SYD" className="w-full rounded-xl border border-white/15 bg-slate-950/70 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-sky-300/40" /></label>
              <label className="block text-sm text-slate-200"><span className="mb-2 block">To</span><input aria-label="Destination airport" required maxLength={3} value={destination} onChange={(event) => setDestination(event.target.value.toUpperCase())} placeholder="MEL" className="w-full rounded-xl border border-white/15 bg-slate-950/70 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-sky-300/40" /></label>
              <label className="block text-sm text-slate-200"><span className="mb-2 block">Departure</span><div className="relative"><input ref={departureInputRef} aria-label="Departure date" required type="date" min={today} value={departDate} onClick={() => openCalendar(departureInputRef.current)} onFocus={() => openCalendar(departureInputRef.current)} onChange={(event) => { setDepartDate(event.target.value); if (returnDate && returnDate < event.target.value) setReturnDate(''); }} style={{ colorScheme: 'dark' }} className="w-full cursor-pointer rounded-xl border border-white/15 bg-slate-950/70 px-4 py-3 pr-12 text-white outline-none focus:ring-2 focus:ring-sky-300/40" /><button type="button" aria-label="Open departure calendar" onClick={() => openCalendar(departureInputRef.current)} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-xl text-sky-200 hover:text-white">📅</button></div></label>
              <label className="block text-sm text-slate-200"><span className="mb-2 block">Return (optional)</span><div className="relative"><input ref={returnInputRef} aria-label="Return date" type="date" min={departDate || today} value={returnDate} onClick={() => openCalendar(returnInputRef.current)} onFocus={() => openCalendar(returnInputRef.current)} onChange={(event) => setReturnDate(event.target.value)} style={{ colorScheme: 'dark' }} className="w-full cursor-pointer rounded-xl border border-white/15 bg-slate-950/70 px-4 py-3 pr-12 text-white outline-none focus:ring-2 focus:ring-sky-300/40" /><button type="button" aria-label="Open return calendar" onClick={() => openCalendar(returnInputRef.current)} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-xl text-sky-200 hover:text-white">📅</button></div></label>
              <label className="block text-sm text-slate-200 sm:col-span-2"><span className="mb-2 block">Adult travellers</span><select aria-label="Adult travellers" value={travellers} onChange={(event) => setTravellers(Number(event.target.value))} className="w-full rounded-xl border border-white/15 bg-slate-950/70 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-sky-300/40">{[1, 2, 3, 4, 5, 6, 7, 8].map((count) => <option key={count} value={count}>{count}</option>)}</select></label>
            </div>
            {flightError ? <p className="mt-4 rounded-xl border border-rose-300/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100" role="alert">{flightError}</p> : null}
            <button type="submit" className="mt-5 w-full rounded-full bg-sky-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-sky-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300">Search flights in {preferredCurrency}</button>
            <p className="mt-3 text-xs leading-5 text-slate-400">Results use your regional currency ({preferredCurrency}).</p>
          </form>
        </section>

        <section className="mx-auto grid max-w-7xl gap-5 px-6 pb-12 md:grid-cols-2 lg:grid-cols-3">{travelSections.map((section) => <SectionCard key={section.title} section={section} />)}</section>
        <VisaEntryPanel />
        <MoneyServicesPanel />
        <div id="trip-platform" className="customer-trip-platform scroll-mt-28">
          <div className="mx-auto max-w-7xl px-6 pb-5">
            <p className="text-sm font-semibold uppercase tracking-[0.32em] text-sky-300">My trips</p>
            <h2 className="mt-2 text-3xl font-bold text-white md:text-4xl">Plan and manage your journey</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">Ask Aleya for help, organise your itinerary, manage bookings and keep everything for your journey together.</p>
          </div>
          <TripPlatform />
        </div>
      </main>
      <footer className="border-t border-white/10 px-6 py-8 text-center text-sm text-slate-500">Aleya Travel — search, plan and manage your journey.</footer>

      {accountOpen ? <div className="fixed inset-0 z-[80] bg-slate-950/75 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="My Aleya account"><button type="button" className="absolute inset-0 cursor-default" aria-label="Close account" onClick={() => setAccountOpen(false)} /><aside className="absolute right-0 top-0 h-full w-full max-w-4xl overflow-y-auto border-l border-white/10 bg-slate-950 shadow-2xl"><div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-slate-950/95 px-6 py-4 backdrop-blur"><div><p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-300">My Aleya</p><h2 className="mt-1 text-2xl font-bold">Account & travel preferences</h2></div><button type="button" onClick={() => setAccountOpen(false)} className="rounded-full border border-white/15 px-4 py-2 text-sm hover:border-sky-300">Close</button></div><div className="py-6"><UserProfilePanel /></div></aside></div> : null}
    </div>
  );
}

export function AppShell() {
  return (
    <TripStoreProvider>
      <CustomerApp />
    </TripStoreProvider>
  );
}

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { TripPlatform } from './trip-platform/TripPlatform';
import { AiPlanningPanel } from './trip-platform/AiPlanningPanel';
import { CurrencyBootstrap } from './CurrencyBootstrap';
import { AccountDrawer } from './AccountDrawer';
import { MoneyServicesPanel } from './MoneyServicesPanel';
import { VisaEntryPanel } from './VisaEntryPanel';
import { WelcomeAuthGate } from './WelcomeAuthGate';
import {
  projectCanonicalSearch,
  useTravelConversation,
} from '../features/travel-conversation';
import { TripStoreProvider } from '../store/TripStoreContext';
import { detectUserCurrency } from '../lib/currency';

const normaliseAirport = (value: string) => value.trim().toLowerCase().replace(/[^a-z]/g, '').slice(0, 3);
const compactDate = (value: string) => value.replaceAll('-', '').slice(2);
const today = new Date().toISOString().split('T')[0];
type CabinClass = 'economy' | 'premiumeconomy' | 'business' | 'first';
type WorkspaceView = 'visa' | 'money' | 'trips' | null;

function CustomerApp() {
  const [entered, setEntered] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [workspace, setWorkspace] = useState<WorkspaceView>(null);
  const [manualOrigin, setManualOrigin] = useState<string | null>(null);
  const [manualDestination, setManualDestination] = useState<string | null>(null);
  const [manualDepartDate, setManualDepartDate] = useState<string | null>(null);
  const [manualReturnDate, setManualReturnDate] = useState<string | null>(null);
  const [manualTravellers, setManualTravellers] = useState<number | null>(null);
  const [cabinClass, setCabinClass] = useState<CabinClass>('economy');
  const [flightError, setFlightError] = useState<string | null>(null);
  const departureInputRef = useRef<HTMLInputElement>(null);
  const returnInputRef = useRef<HTMLInputElement>(null);
  const preferredCurrency = detectUserCurrency();
  const travelState = useTravelConversation();
  const searchProjection = projectCanonicalSearch(travelState);

  // Canonical conversation always wins over stale manual edits after each turn/reset.
  useEffect(() => {
    setManualOrigin(null);
    setManualDestination(null);
    setManualDepartDate(null);
    setManualReturnDate(null);
    setManualTravellers(null);
  }, [travelState.conversationId, travelState.turnCount]);

  const origin = manualOrigin ?? searchProjection.origin.airportCode ?? '';
  const destination = manualDestination ?? searchProjection.destination.airportCode ?? '';
  const departDate = manualDepartDate ?? searchProjection.departureDate ?? '';
  const returnDate = manualReturnDate ?? searchProjection.returnDate ?? '';
  const travellers = manualTravellers ?? searchProjection.adults;
  const travellerSource = manualTravellers != null ? 'explicit' : searchProjection.travellerSource;

  if (!entered) return <WelcomeAuthGate onEnter={() => setEntered(true)} />;

  const openCalendar = (input: HTMLInputElement | null) => {
    if (!input) return;
    input.focus();
    if ('showPicker' in input) input.showPicker();
  };

  const showFlights = () => {
    setWorkspace(null);
    window.setTimeout(() => document.getElementById('flight-search')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  };

  const showAssistant = () => {
    setWorkspace(null);
    window.setTimeout(() => document.getElementById('aleya-assistant')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const openWorkspace = (view: Exclude<WorkspaceView, null>) => {
    setWorkspace(view);
    window.setTimeout(() => document.getElementById('selected-workspace')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const searchFlights = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const from = normaliseAirport(origin);
    const to = normaliseAirport(destination);
    if (from.length !== 3 || to.length !== 3) return setFlightError('Enter valid three-letter airport codes, such as SYD and MEL.');
    if (!departDate) return setFlightError('Choose a departure date.');
    if (returnDate && returnDate < departDate) return setFlightError('The return date must be after the departure date.');
    setFlightError(null);
    const outbound = compactDate(departDate);
    const inbound = returnDate ? `/${compactDate(returnDate)}` : '';
    window.open(`https://www.skyscanner.com.au/transport/flights/${from}/${to}/${outbound}${inbound}/?adultsv2=${travellers}&cabinclass=${cabinClass}&currency=${preferredCurrency}`, '_blank', 'noopener,noreferrer');
  };

  const signOut = () => {
    setAccountOpen(false);
    setWorkspace(null);
    setEntered(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const serviceButton = (active: boolean) =>
    `whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition ${active ? 'border-sky-300 text-white' : 'border-transparent text-slate-300 hover:border-white/30 hover:text-white'}`;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <CurrencyBootstrap />
      <style>{`.customer-trip-platform > section > div:first-child > div:first-child { display: none; } .customer-trip-platform > section > div:first-child > p[role='status'][class*='border-sky-300'] { display: none; }`}</style>

      <header className="sticky top-0 z-50 bg-slate-950/95 backdrop-blur">
        <div className="border-b border-white/10">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
            <button type="button" onClick={showAssistant} className="block text-left" aria-label="Aleya Travel home">
              <p className="text-sm uppercase tracking-[0.4em] text-sky-300">Aleya Travel</p>
              <h1 className="mt-1 text-xl font-bold">Travel made easier.</h1>
            </button>
            <button type="button" onClick={() => setAccountOpen(true)} className="flex h-10 items-center rounded-full border border-white/15 bg-white/[0.05] p-1.5 text-white hover:border-sky-300" aria-label="Open account menu">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-400 font-bold text-slate-950">A</span>
            </button>
          </div>
        </div>

        <nav className="border-b border-white/10 bg-slate-900/80" aria-label="Travel services">
          <div className="mx-auto flex max-w-7xl overflow-x-auto px-2 sm:px-6">
            <button type="button" onClick={showAssistant} className={serviceButton(workspace === null)}>Aleya AI Assistant</button>
            <button type="button" onClick={showFlights} className={serviceButton(false)}>Flights</button>
            <button type="button" onClick={() => openWorkspace('trips')} className={serviceButton(workspace === 'trips')}>Hotels & itineraries</button>
            <button type="button" onClick={() => openWorkspace('visa')} className={serviceButton(workspace === 'visa')}>Visa requirements</button>
            <button type="button" onClick={() => openWorkspace('money')} className={serviceButton(workspace === 'money')}>Exchange & ATMs</button>
          </div>
        </nav>
      </header>

      <main id="top">
        <section id="aleya-assistant" className="scroll-mt-36 px-6 py-12 lg:py-16">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto mb-8 max-w-4xl text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.35em] text-sky-300">Aleya AI Assistant</p>
              <h2 className="mt-5 text-4xl font-black tracking-tight text-white md:text-6xl">Plan your entire journey with Aleya</h2>
              <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-300 md:text-lg">Ask naturally, build an itinerary, compare ideas, work within your budget and organise every part of your trip in one conversation.</p>
            </div>
            <AiPlanningPanel />
          </div>
        </section>

        <section className="border-t border-white/10 px-6 py-12 lg:py-16">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-4xl text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.35em] text-sky-300">Flight search</p>
              <h2 className="mt-5 text-4xl font-black tracking-tight text-white md:text-5xl">Where do you want to go?</h2>
              <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-300">Compare flights in your regional currency and preferred cabin class.</p>
            </div>

            <form
              id="flight-search"
              onSubmit={searchFlights}
              className="mx-auto mt-10 max-w-5xl scroll-mt-36 rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-sky-950/30 md:p-8"
              data-testid="canonical-search-form"
              data-origin={origin}
              data-destination={destination}
              data-depart={departDate}
              data-return={returnDate}
              data-adults={String(travellers)}
              data-traveller-source={travellerSource}
              data-route={`${origin || '?'}→${destination || '?'}`}
            >
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
                <label className="block text-sm text-slate-200"><span className="mb-2 block">From</span><input aria-label="Origin airport" required maxLength={3} value={origin} onChange={(event) => setManualOrigin(event.target.value.toUpperCase())} placeholder={searchProjection.origin.airportCode || 'SYD'} className="w-full rounded-xl border border-white/15 bg-slate-950/70 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-sky-300/40" data-testid="search-origin" /></label>
                <label className="block text-sm text-slate-200"><span className="mb-2 block">To</span><input aria-label="Destination airport" required maxLength={3} value={destination} onChange={(event) => setManualDestination(event.target.value.toUpperCase())} placeholder={searchProjection.destination.airportCode || 'MEL'} className="w-full rounded-xl border border-white/15 bg-slate-950/70 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-sky-300/40" data-testid="search-destination" /></label>
                <label className="block text-sm text-slate-200"><span className="mb-2 block">Departure</span><div className="relative"><input ref={departureInputRef} aria-label="Departure date" required type="date" min={today} value={departDate} onClick={() => openCalendar(departureInputRef.current)} onChange={(event) => { setManualDepartDate(event.target.value); if (returnDate && returnDate < event.target.value) setManualReturnDate(''); }} style={{ colorScheme: 'dark' }} className="w-full cursor-pointer rounded-xl border border-white/15 bg-slate-950/70 px-4 py-3 pr-11 text-white outline-none focus:ring-2 focus:ring-sky-300/40" data-testid="search-depart" /><button type="button" aria-label="Open departure calendar" onClick={() => openCalendar(departureInputRef.current)} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-lg text-sky-200">📅</button></div></label>
                <label className="block text-sm text-slate-200"><span className="mb-2 block">Return</span><div className="relative"><input ref={returnInputRef} aria-label="Return date" type="date" min={departDate || today} value={returnDate} onClick={() => openCalendar(returnInputRef.current)} onChange={(event) => setManualReturnDate(event.target.value)} style={{ colorScheme: 'dark' }} className="w-full cursor-pointer rounded-xl border border-white/15 bg-slate-950/70 px-4 py-3 pr-11 text-white outline-none focus:ring-2 focus:ring-sky-300/40" data-testid="search-return" /><button type="button" aria-label="Open return calendar" onClick={() => openCalendar(returnInputRef.current)} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-lg text-sky-200">📅</button></div></label>
                <label className="block text-sm text-slate-200"><span className="mb-2 block">Travellers{travellerSource === 'product_default' ? ' (default 1 adult)' : ''}</span><select aria-label="Adult travellers" value={travellers} onChange={(event) => setManualTravellers(Number(event.target.value))} className="w-full rounded-xl border border-white/15 bg-slate-950/70 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-sky-300/40" data-testid="search-travellers" data-traveller-source={travellerSource}>{[1,2,3,4,5,6,7,8].map((count) => <option key={count} value={count}>{count}</option>)}</select></label>
                <label className="block text-sm text-slate-200"><span className="mb-2 block">Cabin</span><select aria-label="Cabin class" value={cabinClass} onChange={(event) => setCabinClass(event.target.value as CabinClass)} className="w-full rounded-xl border border-white/15 bg-slate-950/70 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-sky-300/40"><option value="economy">Economy</option><option value="premiumeconomy">Premium economy</option><option value="business">Business</option><option value="first">First class</option></select></label>
              </div>
              {flightError ? <p className="mt-4 rounded-xl border border-rose-300/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100" role="alert">{flightError}</p> : null}
              <button type="submit" className="mt-5 w-full rounded-full bg-sky-400 px-5 py-3.5 font-semibold text-slate-950 transition hover:bg-sky-300">Search flights</button>
              <p className="mt-3 text-center text-xs text-slate-400">Prices shown in {preferredCurrency}.</p>
            </form>
          </div>
        </section>

        {workspace ? (
          <section id="selected-workspace" className="scroll-mt-36 border-t border-white/10 bg-slate-950/70 pt-8">
            <div className="mx-auto flex max-w-7xl justify-end px-6">
              <button type="button" onClick={showAssistant} className="rounded-full border border-white/15 px-4 py-2 text-sm text-slate-200 hover:border-sky-300">Close</button>
            </div>
            {workspace === 'visa' ? <VisaEntryPanel /> : null}
            {workspace === 'money' ? <MoneyServicesPanel /> : null}
            {workspace === 'trips' ? <div className="customer-trip-platform"><TripPlatform /></div> : null}
          </section>
        ) : null}
      </main>

      <footer className="border-t border-white/10 px-6 py-6 text-center text-sm text-slate-500">Aleya Travel</footer>
      {accountOpen ? <AccountDrawer onClose={() => setAccountOpen(false)} onSignOut={signOut} /> : null}
    </div>
  );
}

export function AppShell() {
  return <TripStoreProvider><CustomerApp /></TripStoreProvider>;
}

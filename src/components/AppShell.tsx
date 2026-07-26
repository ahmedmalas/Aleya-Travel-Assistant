import { useRef, useState, type FormEvent } from 'react';
import { SectionCard } from './SectionCard';
import { TripPlatform } from './trip-platform/TripPlatform';
import { CurrencyBootstrap } from './CurrencyBootstrap';
import { travelSections } from '../data/sections';
import { detectUserCurrency } from '../lib/currency';

const normaliseAirport = (value: string) => value.trim().toLowerCase().replace(/[^a-z]/g, '').slice(0, 3);
const compactDate = (value: string) => value.replaceAll('-', '').slice(2);
const today = new Date().toISOString().split('T')[0];

export function AppShell() {
  const [origin, setOrigin] = useState('SYD');
  const [destination, setDestination] = useState('MEL');
  const [departDate, setDepartDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [travellers, setTravellers] = useState(1);
  const [flightError, setFlightError] = useState<string | null>(null);
  const departureInputRef = useRef<HTMLInputElement>(null);
  const returnInputRef = useRef<HTMLInputElement>(null);
  const preferredCurrency = detectUserCurrency();

  const openCalendar = (input: HTMLInputElement | null) => {
    if (!input) return;
    input.focus();
    if ('showPicker' in input) input.showPicker();
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

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <CurrencyBootstrap />
      <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <a href="#top" className="block" aria-label="Aleya Travel home">
            <p className="text-sm uppercase tracking-[0.4em] text-sky-300">Aleya Travel</p>
            <h1 className="mt-1 text-xl font-bold">AI Travel Assistant</h1>
          </a>
          <nav className="flex flex-wrap items-center justify-end gap-2" aria-label="Main navigation">
            <a className="rounded-full border border-white/15 px-4 py-2 text-sm text-slate-200 hover:border-sky-300" href="#flight-search">Search flights</a>
            <a className="rounded-full bg-sky-400/20 px-4 py-2 text-sm text-sky-100 hover:bg-sky-400/30" href="#trip-platform">Open trip planner</a>
          </nav>
        </div>
      </header>

      <main id="top">
        <section className="mx-auto grid max-w-7xl gap-10 px-6 py-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-16">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.4em] text-sky-300">Search. Compare. Plan.</p>
            <h2 className="mt-6 max-w-4xl text-4xl font-black tracking-tight text-white md:text-6xl">Your entire trip starts with Aleya.</h2>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">Search flights, organise accommodation, build itineraries, track bookings and manage your travel plans from one place.</p>
            <div className="mt-8 flex flex-wrap gap-3 text-sm text-slate-300">
              <a href="#flight-search" className="rounded-full bg-white/10 px-4 py-2 hover:bg-sky-400/20">Flights</a>
              <a href="#trip-platform" className="rounded-full bg-white/10 px-4 py-2 hover:bg-sky-400/20">Hotels</a>
              <a href="#trip-platform" className="rounded-full bg-white/10 px-4 py-2 hover:bg-sky-400/20">Itineraries</a>
              <a href="#trip-platform" className="rounded-full bg-white/10 px-4 py-2 hover:bg-sky-400/20">Trip manager</a>
            </div>
          </div>

          <form id="flight-search" onSubmit={searchFlights} className="scroll-mt-28 rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-sky-950/30">
            <p className="text-sm uppercase tracking-[0.32em] text-sky-300">Flight search</p>
            <h3 className="mt-2 text-2xl font-bold">Find available flights</h3>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm text-slate-200">
                <span className="mb-2 block">From</span>
                <input aria-label="Origin airport" required maxLength={3} value={origin} onChange={(event) => setOrigin(event.target.value.toUpperCase())} placeholder="SYD" className="w-full rounded-xl border border-white/15 bg-slate-950/70 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-sky-300/40" />
              </label>
              <label className="block text-sm text-slate-200">
                <span className="mb-2 block">To</span>
                <input aria-label="Destination airport" required maxLength={3} value={destination} onChange={(event) => setDestination(event.target.value.toUpperCase())} placeholder="MEL" className="w-full rounded-xl border border-white/15 bg-slate-950/70 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-sky-300/40" />
              </label>
              <label className="block text-sm text-slate-200">
                <span className="mb-2 block">Departure</span>
                <div className="relative">
                  <input ref={departureInputRef} aria-label="Departure date" required type="date" min={today} value={departDate} onClick={() => openCalendar(departureInputRef.current)} onFocus={() => openCalendar(departureInputRef.current)} onChange={(event) => { setDepartDate(event.target.value); if (returnDate && returnDate < event.target.value) setReturnDate(''); }} style={{ colorScheme: 'dark' }} className="w-full cursor-pointer rounded-xl border border-white/15 bg-slate-950/70 px-4 py-3 pr-12 text-white outline-none focus:ring-2 focus:ring-sky-300/40" />
                  <button type="button" aria-label="Open departure calendar" onClick={() => openCalendar(departureInputRef.current)} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-xl text-sky-200 hover:text-white">📅</button>
                </div>
              </label>
              <label className="block text-sm text-slate-200">
                <span className="mb-2 block">Return (optional)</span>
                <div className="relative">
                  <input ref={returnInputRef} aria-label="Return date" type="date" min={departDate || today} value={returnDate} onClick={() => openCalendar(returnInputRef.current)} onFocus={() => openCalendar(returnInputRef.current)} onChange={(event) => setReturnDate(event.target.value)} style={{ colorScheme: 'dark' }} className="w-full cursor-pointer rounded-xl border border-white/15 bg-slate-950/70 px-4 py-3 pr-12 text-white outline-none focus:ring-2 focus:ring-sky-300/40" />
                  <button type="button" aria-label="Open return calendar" onClick={() => openCalendar(returnInputRef.current)} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-xl text-sky-200 hover:text-white">📅</button>
                </div>
              </label>
              <label className="block text-sm text-slate-200 sm:col-span-2">
                <span className="mb-2 block">Adult travellers</span>
                <select aria-label="Adult travellers" value={travellers} onChange={(event) => setTravellers(Number(event.target.value))} className="w-full rounded-xl border border-white/15 bg-slate-950/70 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-sky-300/40">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((count) => <option key={count} value={count}>{count}</option>)}
                </select>
              </label>
            </div>
            {flightError ? <p className="mt-4 rounded-xl border border-rose-300/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100" role="alert">{flightError}</p> : null}
            <button type="submit" className="mt-5 w-full rounded-full bg-sky-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-sky-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300">Search flights in {preferredCurrency}</button>
            <p className="mt-3 text-xs leading-5 text-slate-400">Click either date field or calendar icon to open the full calendar. Results use your regional currency ({preferredCurrency}).</p>
          </form>
        </section>

        <section className="mx-auto grid max-w-7xl gap-5 px-6 pb-12 md:grid-cols-2 lg:grid-cols-3">
          {travelSections.map((section) => <SectionCard key={section.title} section={section} />)}
        </section>

        <div id="trip-platform" className="scroll-mt-28"><TripPlatform /></div>
      </main>

      <footer className="border-t border-white/10 px-6 py-8 text-center text-sm text-slate-500">Aleya Travel — search, plan and manage your journey.</footer>
    </div>
  );
}

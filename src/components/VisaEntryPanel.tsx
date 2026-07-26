import { useEffect, useMemo, useRef, useState } from 'react';

type VisaApplication = {
  id: string;
  traveller: string;
  nationality: string;
  destination: string;
  departureDate: string;
  requirement: 'checking' | 'required' | 'eta' | 'not-required';
  status: 'not-started' | 'preparing' | 'submitted' | 'approved';
};

const STORAGE_KEY = 'aleya-travel:visa-applications:v1';
const today = new Date().toISOString().split('T')[0];
const formatDate = (value: string) => {
  if (!value) return '';
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(year, month - 1, day));
};

export function VisaEntryPanel() {
  const [traveller, setTraveller] = useState('');
  const [nationality, setNationality] = useState('Australian');
  const [destination, setDestination] = useState('');
  const [departureDate, setDepartureDate] = useState('');
  const [applications, setApplications] = useState<VisaApplication[]>([]);
  const departureInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setApplications(JSON.parse(stored) as VisaApplication[]);
    } catch {
      setApplications([]);
    }
  }, []);

  const officialSearchUrl = useMemo(() => {
    const query = encodeURIComponent(`${destination} visa entry requirements ${nationality} passport official government`);
    return `https://www.google.com/search?q=${query}`;
  }, [destination, nationality]);

  const saveApplications = (next: VisaApplication[]) => {
    setApplications(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const openCalendar = () => {
    const input = departureInputRef.current;
    if (!input) return;
    input.focus();
    if ('showPicker' in input) input.showPicker();
  };

  const addApplication = () => {
    if (!traveller.trim() || !destination.trim()) return;
    const next: VisaApplication = {
      id: crypto.randomUUID(),
      traveller: traveller.trim(),
      nationality: nationality.trim(),
      destination: destination.trim(),
      departureDate,
      requirement: 'checking',
      status: 'not-started',
    };
    saveApplications([next, ...applications]);
    setTraveller('');
    setDestination('');
    setDepartureDate('');
  };

  const update = (id: string, patch: Partial<VisaApplication>) => {
    saveApplications(applications.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
  };

  const inputClass = 'w-full rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2.5 text-white outline-none focus:ring-2 focus:ring-sky-300/40';

  return (
    <section id="visa-entry" className="scroll-mt-28 mx-auto max-w-7xl px-6 pb-12" aria-labelledby="visa-entry-title">
      <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-sky-950/20">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-sky-300">Travel documents</p>
        <h2 id="visa-entry-title" className="mt-2 text-3xl font-bold text-white">Visas & entry requirements</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">Check whether each traveller needs a visa, electronic travel authorisation or other entry permission, then track the application through to approval.</p>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm text-slate-200"><span className="mb-2 block">Traveller</span><input className={inputClass} value={traveller} onChange={(event) => setTraveller(event.target.value)} placeholder="Traveller name" /></label>
          <label className="text-sm text-slate-200"><span className="mb-2 block">Passport nationality</span><input className={inputClass} value={nationality} onChange={(event) => setNationality(event.target.value)} /></label>
          <label className="text-sm text-slate-200"><span className="mb-2 block">Destination country</span><input className={inputClass} value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="Japan" /></label>
          <label className="text-sm text-slate-200"><span className="mb-2 block">Departure date</span><div className="relative"><input ref={departureInputRef} type="date" min={today} value={departureDate} onClick={openCalendar} onFocus={openCalendar} onChange={(event) => setDepartureDate(event.target.value)} style={{ colorScheme: 'dark' }} className={`${inputClass} cursor-pointer pr-12`} /><button type="button" aria-label="Open departure calendar" onClick={openCalendar} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-xl text-sky-200 hover:text-white">📅</button></div></label>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <a href={destination ? officialSearchUrl : 'https://www.smartraveller.gov.au/destinations'} target="_blank" rel="noreferrer" className="rounded-full border border-white/20 px-5 py-3 text-sm font-semibold text-white hover:border-sky-300">Check official entry information</a>
          <button type="button" onClick={addApplication} disabled={!traveller.trim() || !destination.trim()} className="rounded-full bg-sky-400 px-5 py-3 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50">Add to visa tracker</button>
        </div>
        <p className="mt-3 text-xs leading-5 text-slate-400">Entry rules can change and may depend on passport type, transit points, trip purpose and length of stay. Aleya opens official government information; travellers should confirm requirements before paying or applying.</p>

        <div className="mt-7 space-y-3">
          {applications.length === 0 ? <p className="rounded-2xl border border-dashed border-white/15 p-5 text-sm text-slate-400">No visa checks saved yet.</p> : applications.map((entry) => (
            <article key={entry.id} className="grid gap-3 rounded-2xl border border-white/10 bg-slate-950/40 p-4 md:grid-cols-[1.4fr_1fr_1fr_auto] md:items-center">
              <div><p className="font-semibold text-white">{entry.traveller} · {entry.destination}</p><p className="mt-1 text-xs text-slate-400">{entry.nationality} passport{entry.departureDate ? ` · departs ${formatDate(entry.departureDate)}` : ''}</p></div>
              <select className={inputClass} aria-label={`Visa requirement for ${entry.traveller}`} value={entry.requirement} onChange={(event) => update(entry.id, { requirement: event.target.value as VisaApplication['requirement'] })}><option value="checking">Checking requirement</option><option value="required">Visa required</option><option value="eta">eVisa / ETA required</option><option value="not-required">No visa required</option></select>
              <select className={inputClass} aria-label={`Application status for ${entry.traveller}`} value={entry.status} onChange={(event) => update(entry.id, { status: event.target.value as VisaApplication['status'] })}><option value="not-started">Not started</option><option value="preparing">Preparing documents</option><option value="submitted">Submitted</option><option value="approved">Approved</option></select>
              <button type="button" onClick={() => saveApplications(applications.filter((item) => item.id !== entry.id))} className="rounded-full border border-white/15 px-4 py-2 text-sm text-slate-300 hover:border-rose-300 hover:text-rose-200">Remove</button>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

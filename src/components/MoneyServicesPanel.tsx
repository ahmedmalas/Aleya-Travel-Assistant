import { useMemo, useState } from 'react';
import { detectUserCurrency, getCurrencyLabel, getSupportedCurrencies } from '../lib/currency';

type RatesResponse = { rates?: Record<string, number>; time_last_update_utc?: string };

export function MoneyServicesPanel() {
  const [from, setFrom] = useState(detectUserCurrency());
  const [to, setTo] = useState('USD');
  const [amount, setAmount] = useState(100);
  const [converted, setConverted] = useState<number | null>(null);
  const [updatedAt, setUpdatedAt] = useState('');
  const [status, setStatus] = useState('');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const options = useMemo(() => getSupportedCurrencies(), []);
  const inputClass = 'w-full rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2.5 text-white outline-none focus:ring-2 focus:ring-sky-300/40';

  const convert = async () => {
    setStatus('Loading live exchange rate…');
    setConverted(null);
    try {
      const response = await fetch(`https://open.er-api.com/v6/latest/${encodeURIComponent(from)}`);
      if (!response.ok) throw new Error('Exchange service unavailable');
      const data = (await response.json()) as RatesResponse;
      const rate = data.rates?.[to];
      if (!rate) throw new Error('Currency pair unavailable');
      setConverted(amount * rate);
      setUpdatedAt(data.time_last_update_utc || new Date().toLocaleString('en-AU'));
      setStatus('Live indicative rate loaded. Providers may charge fees or use different retail rates.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to load live rate.');
    }
  };

  const findNearby = () => {
    if (!navigator.geolocation) { setStatus('Location services are unavailable in this browser.'); return; }
    setStatus('Requesting your location…');
    navigator.geolocation.getCurrentPosition(
      (position) => { setLocation({ lat: position.coords.latitude, lng: position.coords.longitude }); setStatus('Location found. Choose a nearby service below.'); },
      () => setStatus('Location permission was not granted. You can still open a general map search.'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const mapUrl = (query: string) => {
    const search = location ? `${query} near ${location.lat},${location.lng}` : query;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(search)}`;
  };

  return <section id="money-services" className="scroll-mt-28 mx-auto max-w-7xl px-6 pb-12" aria-labelledby="money-services-title"><div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-sky-950/20"><p className="text-xs font-semibold uppercase tracking-[0.32em] text-sky-300">Money abroad</p><h2 id="money-services-title" className="mt-2 text-3xl font-bold text-white">Currency exchange & nearby cash services</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">Check an indicative live rate, then locate ATMs, currency exchange counters, Western Union, MoneyGram and cash collection services near your current location.</p><div className="mt-6 grid gap-4 md:grid-cols-4"><label className="text-sm text-slate-200"><span className="mb-2 block">Amount</span><input type="number" min={0} className={inputClass} value={amount} onChange={(event) => setAmount(Number(event.target.value) || 0)} /></label><label className="text-sm text-slate-200"><span className="mb-2 block">From</span><select className={inputClass} value={from} onChange={(event) => setFrom(event.target.value)}>{options.map((item: string) => <option key={item} value={item}>{getCurrencyLabel(item)}</option>)}</select></label><label className="text-sm text-slate-200"><span className="mb-2 block">To</span><select className={inputClass} value={to} onChange={(event) => setTo(event.target.value)}>{options.map((item: string) => <option key={item} value={item}>{getCurrencyLabel(item)}</option>)}</select></label><div className="flex items-end"><button type="button" onClick={() => void convert()} className="w-full rounded-full bg-sky-400 px-5 py-3 font-semibold text-slate-950 hover:bg-sky-300">Get live rate</button></div></div>{converted !== null ? <div className="mt-5 rounded-2xl border border-emerald-300/30 bg-emerald-500/10 p-4"><p className="text-2xl font-bold text-emerald-100">{amount.toLocaleString('en-AU')} {from} ≈ {converted.toLocaleString('en-AU',{ maximumFractionDigits: 2 })} {to}</p><p className="mt-1 text-xs text-emerald-100/70">Rate updated: {updatedAt}</p></div> : null}{status ? <p className="mt-4 text-sm text-slate-300" role="status">{status}</p> : null}<div className="mt-7 flex flex-wrap items-center gap-3"><button type="button" onClick={findNearby} className="rounded-full border border-sky-300/40 px-5 py-3 text-sm font-semibold text-sky-100 hover:bg-sky-400/10">Use my location</button><span className="text-xs text-slate-400">Location is used only to open nearby map searches.</span></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{([['Nearby ATMs','ATM'],['Currency exchange','currency exchange'],['Western Union','Western Union'],['MoneyGram','MoneyGram'],['Cash pickup','cash pickup money transfer']] as Array<[string,string]>).map(([label,query]) => <a key={label} href={mapUrl(query)} target="_blank" rel="noreferrer" className="rounded-2xl border border-white/15 bg-slate-950/50 p-4 text-center text-sm font-semibold text-white hover:border-sky-300/60 hover:bg-sky-400/10">{label} ↗</a>)}</div><p className="mt-4 text-xs leading-5 text-slate-500">Exchange rates are indicative only. Confirm the final rate, fees, identification requirements, opening hours and cash availability with the provider before travelling or collecting funds.</p></div></section>;
}

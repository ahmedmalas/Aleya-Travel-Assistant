import { useEffect, useState } from 'react';
import { detectUserCurrency, getCurrencyLabel, getSupportedCurrencies } from '../lib/currency';

type UserProfile = {
  fullName: string; preferredName: string; email: string; phone: string; countryOfResidence: string;
  homeCity: string; homeAirport: string; nationality: string; language: string; currency: string;
  timezone: string; travelStyle: string; cabinPreference: string; seatingPreference: string;
  hotelPreferences: string; dietaryRequirements: string; accessibilityNeeds: string;
  emergencyContactName: string; emergencyContactPhone: string;
};

const STORAGE_KEY = 'aleya-travel:user-profile:v1';
const currencies = getSupportedCurrencies();
const createProfile = (): UserProfile => ({
  fullName: '', preferredName: '', email: '', phone: '', countryOfResidence: '', homeCity: '', homeAirport: '',
  nationality: '', language: typeof navigator === 'undefined' ? 'en-AU' : navigator.language || 'en-AU',
  currency: detectUserCurrency(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Australia/Sydney',
  travelStyle: 'balanced', cabinPreference: 'economy', seatingPreference: '', hotelPreferences: '',
  dietaryRequirements: '', accessibilityNeeds: '', emergencyContactName: '', emergencyContactPhone: '',
});

export function UserProfilePanel() {
  const [profile, setProfile] = useState<UserProfile>(createProfile);
  const [saved, setSaved] = useState(false);
  useEffect(() => { try { const stored = localStorage.getItem(STORAGE_KEY); if (stored) setProfile({ ...createProfile(), ...(JSON.parse(stored) as Partial<UserProfile>) }); } catch { /* ignore invalid local profile */ } }, []);
  const update = (field: keyof UserProfile, value: string) => { setProfile((current) => ({ ...current, [field]: value })); setSaved(false); };
  const save = () => { localStorage.setItem(STORAGE_KEY, JSON.stringify(profile)); setSaved(true); };
  const inputClass = 'w-full rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2.5 text-white outline-none focus:ring-2 focus:ring-sky-300/40';
  const fields: Array<[keyof UserProfile, string]> = [['fullName','Full name'],['preferredName','Preferred name'],['email','Email'],['phone','Phone'],['countryOfResidence','Country of residence'],['homeCity','Home city'],['homeAirport','Home airport'],['nationality','Nationality'],['language','Language / locale'],['timezone','Time zone'],['seatingPreference','Seating preference'],['emergencyContactName','Emergency contact'],['emergencyContactPhone','Emergency contact phone']];
  const notes: Array<[keyof UserProfile, string]> = [['hotelPreferences','Hotel preferences'],['dietaryRequirements','Dietary requirements'],['accessibilityNeeds','Accessibility needs']];
  return <section id="user-profile" className="scroll-mt-28 mx-auto max-w-7xl px-6 pb-12" aria-labelledby="user-profile-title"><div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-sky-950/20"><p className="text-xs font-semibold uppercase tracking-[0.32em] text-sky-300">My Aleya</p><h2 id="user-profile-title" className="mt-2 text-3xl font-bold text-white">My travel profile</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">Your identity, home location, currency and travel preferences help Aleya personalise planning, recommendations and future bookings.</p><div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{fields.map(([field,label]) => <label key={field} className="block text-sm text-slate-200"><span className="mb-2 block">{label}</span><input className={inputClass} value={profile[field]} onChange={(event) => update(field,event.target.value)} /></label>)}<label className="block text-sm text-slate-200"><span className="mb-2 block">Home currency</span><input className={inputClass} list="profile-currencies" value={profile.currency} onChange={(event) => update('currency',event.target.value.toUpperCase())} /><datalist id="profile-currencies">{currencies.map((currency: string) => <option key={currency} value={currency}>{getCurrencyLabel(currency)}</option>)}</datalist></label><label className="block text-sm text-slate-200"><span className="mb-2 block">Travel style</span><select className={inputClass} value={profile.travelStyle} onChange={(event) => update('travelStyle',event.target.value)}><option value="budget">Budget</option><option value="balanced">Balanced</option><option value="luxury">Luxury</option><option value="family">Family</option><option value="adventure">Adventure</option><option value="business">Business</option><option value="accessible">Accessible</option></select></label><label className="block text-sm text-slate-200"><span className="mb-2 block">Cabin preference</span><select className={inputClass} value={profile.cabinPreference} onChange={(event) => update('cabinPreference',event.target.value)}><option value="economy">Economy</option><option value="premium-economy">Premium economy</option><option value="business">Business</option><option value="first">First</option></select></label></div><div className="mt-4 grid gap-4 md:grid-cols-2">{notes.map(([field,label]) => <label key={field} className="block text-sm text-slate-200"><span className="mb-2 block">{label}</span><textarea rows={3} className={inputClass} value={profile[field]} onChange={(event) => update(field,event.target.value)} /></label>)}</div><div className="mt-5 flex items-center gap-3"><button type="button" onClick={save} className="rounded-full bg-sky-400 px-5 py-3 font-semibold text-slate-950 hover:bg-sky-300">Save my profile</button>{saved ? <span className="text-sm text-emerald-300">Profile saved on this device.</span> : null}</div></div></section>;
}

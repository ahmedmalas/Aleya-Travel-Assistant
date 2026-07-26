import { useEffect, useMemo, useState } from 'react';
import { detectUserCurrency, getCurrencyLabel, getSupportedCurrencies } from '../lib/currency';

export type ProfileSection = 'personal' | 'regional' | 'preferences' | 'emergency';

type UserProfile = {
  fullName: string; preferredName: string; email: string; phone: string; countryOfResidence: string;
  homeCity: string; homeAirport: string; nationality: string; language: string; currency: string; timezone: string;
  travelStyle: string; cabinPreference: string; seatingPreference: string; hotelPreferences: string;
  dietaryRequirements: string; accessibilityNeeds: string; emergencyContactName: string; emergencyContactPhone: string;
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

const sectionTitles: Record<ProfileSection, { title: string; description: string }> = {
  personal: { title: 'Personal details', description: 'Manage your name, contact details and identity information.' },
  regional: { title: 'Home and regional details', description: 'Set your home location, airport, language, time zone and currency.' },
  preferences: { title: 'Travel preferences', description: 'Tell Aleya how you prefer to travel, fly and stay.' },
  emergency: { title: 'Emergency information', description: 'Keep an emergency contact available for your journeys.' },
};

export function UserProfilePanel({ section, hideBackButton = false }: { section: ProfileSection; hideBackButton?: boolean }) {
  const [profile, setProfile] = useState<UserProfile>(createProfile);
  const [savedProfile, setSavedProfile] = useState<UserProfile>(createProfile);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const loaded = stored ? { ...createProfile(), ...(JSON.parse(stored) as Partial<UserProfile>) } : createProfile();
      setProfile(loaded);
      setSavedProfile(loaded);
    } catch {
      const fallback = createProfile();
      setProfile(fallback);
      setSavedProfile(fallback);
    }
  }, []);

  const isDirty = useMemo(() => JSON.stringify(profile) !== JSON.stringify(savedProfile), [profile, savedProfile]);
  const update = (field: keyof UserProfile, value: string) => { setProfile((current) => ({ ...current, [field]: value })); setSaved(false); };
  const save = () => { localStorage.setItem(STORAGE_KEY, JSON.stringify(profile)); setSavedProfile(profile); setSaved(true); };
  const inputClass = 'w-full rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2.5 text-white outline-none focus:ring-2 focus:ring-sky-300/40';
  const renderInput = (field: keyof UserProfile, label: string, type = 'text') => <label key={field} className="block text-sm text-slate-200"><span className="mb-2 block">{label}</span><input type={type} className={inputClass} value={profile[field]} onChange={(event) => update(field, event.target.value)} /></label>;
  const heading = sectionTitles[section];

  return (
    <section className="px-6 pb-8" aria-labelledby={`profile-${section}-title`}>
      {!hideBackButton ? <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('aleya-account-back'))} className="mb-5 text-sm text-sky-300 hover:text-sky-200">← Back to account</button> : null}
      <h2 id={`profile-${section}-title`} className="text-3xl font-bold text-white">{heading.title}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{heading.description}</p>

      {section === 'personal' ? <div className="mt-6 grid gap-4 md:grid-cols-2">{renderInput('fullName','Full name')}{renderInput('preferredName','Preferred name')}{renderInput('email','Email address','email')}{renderInput('phone','Mobile number','tel')}{renderInput('nationality','Nationality')}{renderInput('countryOfResidence','Country of residence')}</div> : null}

      {section === 'regional' ? <div className="mt-6 grid gap-4 md:grid-cols-2">{renderInput('homeCity','Home city')}{renderInput('homeAirport','Home airport')}{renderInput('language','Language / locale')}{renderInput('timezone','Time zone')}<label className="block text-sm text-slate-200"><span className="mb-2 block">Home currency</span><input className={inputClass} list="profile-currencies" value={profile.currency} onChange={(event) => update('currency', event.target.value.toUpperCase())} /><datalist id="profile-currencies">{currencies.map((currency) => <option key={currency} value={currency}>{getCurrencyLabel(currency)}</option>)}</datalist></label></div> : null}

      {section === 'preferences' ? <div className="mt-6 space-y-4"><div className="grid gap-4 md:grid-cols-2"><label className="block text-sm text-slate-200"><span className="mb-2 block">Travel style</span><select className={inputClass} value={profile.travelStyle} onChange={(event) => update('travelStyle', event.target.value)}><option value="budget">Budget</option><option value="balanced">Balanced</option><option value="luxury">Luxury</option><option value="family">Family</option><option value="adventure">Adventure</option><option value="business">Business</option><option value="accessible">Accessible</option></select></label><label className="block text-sm text-slate-200"><span className="mb-2 block">Cabin preference</span><select className={inputClass} value={profile.cabinPreference} onChange={(event) => update('cabinPreference', event.target.value)}><option value="economy">Economy</option><option value="premium-economy">Premium economy</option><option value="business">Business</option><option value="first">First</option></select></label>{renderInput('seatingPreference','Seating preference')}</div>{(['hotelPreferences','dietaryRequirements','accessibilityNeeds'] as const).map((field) => { const labels = { hotelPreferences:'Hotel preferences', dietaryRequirements:'Dietary requirements', accessibilityNeeds:'Accessibility needs' }; return <label key={field} className="block text-sm text-slate-200"><span className="mb-2 block">{labels[field]}</span><textarea rows={3} className={inputClass} value={profile[field]} onChange={(event) => update(field,event.target.value)} /></label>; })}</div> : null}

      {section === 'emergency' ? <div className="mt-6 grid gap-4 md:grid-cols-2">{renderInput('emergencyContactName','Emergency contact name')}{renderInput('emergencyContactPhone','Emergency contact mobile','tel')}</div> : null}

      {isDirty ? <button type="button" onClick={save} className="mt-6 rounded-full bg-sky-400 px-5 py-3 font-semibold text-slate-950 hover:bg-sky-300">Save changes</button> : saved ? <p className="mt-5 text-sm text-emerald-300">Changes saved.</p> : null}
    </section>
  );
}

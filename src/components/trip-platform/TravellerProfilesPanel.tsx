import { useState } from 'react';
import type { Traveller } from '../../store/tripDomain';
import { useSharedTripStore } from '../../store/TripStoreContext';
import {
  EmptyState,
  Field,
  Panel,
  PrimaryButton,
  SecondaryButton,
  StatusBanner,
  inputClassName,
} from './shared/ui';

const createTraveller = (): Traveller => ({
  id: crypto.randomUUID(),
  name: '',
  preferredName: '',
  dateOfBirth: '',
  nationality: '',
  countryOfResidence: '',
  homeAirport: '',
  preferredDepartureAirports: '',
  language: 'en',
  currency: 'USD',
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
  travelPreferences: '',
  dietaryRequirements: '',
  accessibilityNeeds: '',
  seatingPreference: '',
  cabinPreference: '',
  hotelPreferences: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  loyaltyPrograms: '',
  loyaltyMemberships: [],
  companions: [],
  passportNumberLast4: '',
  passportExpiry: '',
  passportCountry: '',
  identityDocumentType: '',
  identityDocumentExpiry: '',
});

export function TravellerProfilesPanel() {
  const { trip, upsertTraveller, deleteTraveller } = useSharedTripStore();
  const [draft, setDraft] = useState<Traveller>(createTraveller());
  const [feedback, setFeedback] = useState<string | null>(null);
  const [loyaltyDraft, setLoyaltyDraft] = useState({ program: '', membershipNumberLast4: '', tier: '' });
  const [companionDraft, setCompanionDraft] = useState({ name: '', relationship: '', dateOfBirth: '', notes: '' });

  const handleSave = () => {
    if (!draft.name.trim()) {
      setFeedback('Traveller name is required.');
      return;
    }
    upsertTraveller({
      ...draft,
      passportNumberLast4: draft.passportNumberLast4.replace(/\D/g, '').slice(-4),
    });
    setDraft(createTraveller());
    setFeedback('Traveller profile saved. Identity fields store metadata only — never full document numbers or scans.');
  };

  return (
    <Panel
      title="Traveller profiles"
      description="Manage multiple travellers under this account/trip. Sensitive identity data is metadata-only and never exposed via public frontend env vars."
    >
      {feedback ? <StatusBanner kind="info" message={feedback} /> : null}
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Field label="Name" htmlFor="traveller-name">
          <input id="traveller-name" className={inputClassName} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </Field>
        <Field label="Preferred name" htmlFor="traveller-preferred">
          <input id="traveller-preferred" className={inputClassName} value={draft.preferredName} onChange={(e) => setDraft({ ...draft, preferredName: e.target.value })} />
        </Field>
        <Field label="Date of birth" htmlFor="traveller-dob">
          <input id="traveller-dob" type="date" className={inputClassName} value={draft.dateOfBirth} onChange={(e) => setDraft({ ...draft, dateOfBirth: e.target.value })} />
        </Field>
        <Field label="Nationality" htmlFor="traveller-nationality">
          <input id="traveller-nationality" className={inputClassName} value={draft.nationality} onChange={(e) => setDraft({ ...draft, nationality: e.target.value })} />
        </Field>
        <Field label="Country of residence" htmlFor="traveller-residence">
          <input id="traveller-residence" className={inputClassName} value={draft.countryOfResidence} onChange={(e) => setDraft({ ...draft, countryOfResidence: e.target.value })} />
        </Field>
        <Field label="Home airport" htmlFor="traveller-home-airport">
          <input id="traveller-home-airport" className={inputClassName} value={draft.homeAirport} onChange={(e) => setDraft({ ...draft, homeAirport: e.target.value })} placeholder="e.g. SYD" />
        </Field>
        <Field label="Preferred departure airports" htmlFor="traveller-dep-airports">
          <input id="traveller-dep-airports" className={inputClassName} value={draft.preferredDepartureAirports} onChange={(e) => setDraft({ ...draft, preferredDepartureAirports: e.target.value })} placeholder="SYD, MEL" />
        </Field>
        <Field label="Language" htmlFor="traveller-language">
          <input id="traveller-language" className={inputClassName} value={draft.language} onChange={(e) => setDraft({ ...draft, language: e.target.value })} />
        </Field>
        <Field label="Currency" htmlFor="traveller-currency">
          <input id="traveller-currency" className={inputClassName} value={draft.currency} onChange={(e) => setDraft({ ...draft, currency: e.target.value.toUpperCase() })} />
        </Field>
        <Field label="Time zone" htmlFor="traveller-tz">
          <input id="traveller-tz" className={inputClassName} value={draft.timeZone} onChange={(e) => setDraft({ ...draft, timeZone: e.target.value })} />
        </Field>
        <Field label="Travel preferences" htmlFor="traveller-prefs">
          <input id="traveller-prefs" className={inputClassName} value={draft.travelPreferences} onChange={(e) => setDraft({ ...draft, travelPreferences: e.target.value })} />
        </Field>
        <Field label="Dietary requirements" htmlFor="traveller-diet">
          <input id="traveller-diet" className={inputClassName} value={draft.dietaryRequirements} onChange={(e) => setDraft({ ...draft, dietaryRequirements: e.target.value })} />
        </Field>
        <Field label="Accessibility needs" htmlFor="traveller-access">
          <input id="traveller-access" className={inputClassName} value={draft.accessibilityNeeds} onChange={(e) => setDraft({ ...draft, accessibilityNeeds: e.target.value })} />
        </Field>
        <Field label="Seating preference" htmlFor="traveller-seat">
          <input id="traveller-seat" className={inputClassName} value={draft.seatingPreference} onChange={(e) => setDraft({ ...draft, seatingPreference: e.target.value })} placeholder="Aisle / window" />
        </Field>
        <Field label="Cabin preference" htmlFor="traveller-cabin">
          <input id="traveller-cabin" className={inputClassName} value={draft.cabinPreference} onChange={(e) => setDraft({ ...draft, cabinPreference: e.target.value })} placeholder="Economy / Premium" />
        </Field>
        <Field label="Hotel preferences" htmlFor="traveller-hotel">
          <input id="traveller-hotel" className={inputClassName} value={draft.hotelPreferences} onChange={(e) => setDraft({ ...draft, hotelPreferences: e.target.value })} />
        </Field>
        <Field label="Emergency contact name" htmlFor="traveller-emergency-name">
          <input id="traveller-emergency-name" className={inputClassName} value={draft.emergencyContactName} onChange={(e) => setDraft({ ...draft, emergencyContactName: e.target.value })} />
        </Field>
        <Field label="Emergency contact phone" htmlFor="traveller-emergency-phone">
          <input id="traveller-emergency-phone" className={inputClassName} value={draft.emergencyContactPhone} onChange={(e) => setDraft({ ...draft, emergencyContactPhone: e.target.value })} />
        </Field>
        <Field label="Loyalty programmes (free text)" htmlFor="traveller-loyalty">
          <input id="traveller-loyalty" className={inputClassName} value={draft.loyaltyPrograms} onChange={(e) => setDraft({ ...draft, loyaltyPrograms: e.target.value })} />
        </Field>
        <Field label="Passport last 4 (metadata only)" htmlFor="traveller-passport-last4">
          <input
            id="traveller-passport-last4"
            className={inputClassName}
            maxLength={4}
            value={draft.passportNumberLast4}
            onChange={(e) => setDraft({ ...draft, passportNumberLast4: e.target.value.replace(/\D/g, '').slice(-4) })}
          />
        </Field>
        <Field label="Passport expiry" htmlFor="traveller-passport-expiry">
          <input id="traveller-passport-expiry" type="date" className={inputClassName} value={draft.passportExpiry} onChange={(e) => setDraft({ ...draft, passportExpiry: e.target.value })} />
        </Field>
        <Field label="Passport country" htmlFor="traveller-passport-country">
          <input id="traveller-passport-country" className={inputClassName} value={draft.passportCountry} onChange={(e) => setDraft({ ...draft, passportCountry: e.target.value })} />
        </Field>
        <Field label="Identity document type" htmlFor="traveller-id-type">
          <input id="traveller-id-type" className={inputClassName} value={draft.identityDocumentType} onChange={(e) => setDraft({ ...draft, identityDocumentType: e.target.value })} placeholder="Passport / National ID" />
        </Field>
        <Field label="Identity document expiry" htmlFor="traveller-id-expiry">
          <input id="traveller-id-expiry" type="date" className={inputClassName} value={draft.identityDocumentExpiry} onChange={(e) => setDraft({ ...draft, identityDocumentExpiry: e.target.value })} />
        </Field>
      </div>

      <section className="mt-5 rounded-2xl border border-white/10 bg-slate-950/40 p-4">
        <h3 className="text-sm font-semibold text-white">Frequent-flyer / loyalty memberships</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <Field label="Programme" htmlFor="loyalty-program">
            <input id="loyalty-program" className={inputClassName} value={loyaltyDraft.program} onChange={(e) => setLoyaltyDraft({ ...loyaltyDraft, program: e.target.value })} />
          </Field>
          <Field label="Number last 4" htmlFor="loyalty-last4">
            <input
              id="loyalty-last4"
              className={inputClassName}
              maxLength={4}
              value={loyaltyDraft.membershipNumberLast4}
              onChange={(e) =>
                setLoyaltyDraft({ ...loyaltyDraft, membershipNumberLast4: e.target.value.replace(/\D/g, '').slice(-4) })
              }
            />
          </Field>
          <Field label="Tier" htmlFor="loyalty-tier">
            <input id="loyalty-tier" className={inputClassName} value={loyaltyDraft.tier} onChange={(e) => setLoyaltyDraft({ ...loyaltyDraft, tier: e.target.value })} />
          </Field>
          <div className="flex items-end">
            <SecondaryButton
              type="button"
              onClick={() => {
                if (!loyaltyDraft.program.trim()) return;
                setDraft({
                  ...draft,
                  loyaltyMemberships: [
                    ...draft.loyaltyMemberships,
                    { id: crypto.randomUUID(), ...loyaltyDraft },
                  ],
                });
                setLoyaltyDraft({ program: '', membershipNumberLast4: '', tier: '' });
              }}
            >
              Add membership
            </SecondaryButton>
          </div>
        </div>
        <ul className="mt-2 space-y-1 text-sm text-slate-300">
          {draft.loyaltyMemberships.map((item) => (
            <li key={item.id}>
              {item.program} · ****{item.membershipNumberLast4 || '----'} · {item.tier || 'tier n/a'}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-4 rounded-2xl border border-white/10 bg-slate-950/40 p-4">
        <h3 className="text-sm font-semibold text-white">Companions / family profiles</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <Field label="Companion name" htmlFor="companion-name">
            <input id="companion-name" className={inputClassName} value={companionDraft.name} onChange={(e) => setCompanionDraft({ ...companionDraft, name: e.target.value })} />
          </Field>
          <Field label="Relationship" htmlFor="companion-rel">
            <input id="companion-rel" className={inputClassName} value={companionDraft.relationship} onChange={(e) => setCompanionDraft({ ...companionDraft, relationship: e.target.value })} />
          </Field>
          <Field label="Date of birth" htmlFor="companion-dob">
            <input id="companion-dob" type="date" className={inputClassName} value={companionDraft.dateOfBirth} onChange={(e) => setCompanionDraft({ ...companionDraft, dateOfBirth: e.target.value })} />
          </Field>
          <div className="flex items-end">
            <SecondaryButton
              type="button"
              onClick={() => {
                if (!companionDraft.name.trim()) return;
                setDraft({
                  ...draft,
                  companions: [...draft.companions, { id: crypto.randomUUID(), ...companionDraft }],
                });
                setCompanionDraft({ name: '', relationship: '', dateOfBirth: '', notes: '' });
              }}
            >
              Add companion
            </SecondaryButton>
          </div>
        </div>
        <ul className="mt-2 space-y-1 text-sm text-slate-300">
          {draft.companions.map((item) => (
            <li key={item.id}>
              {item.name} · {item.relationship || 'relationship n/a'} · DOB {item.dateOfBirth || '—'}
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-3 flex gap-2">
        <PrimaryButton type="button" onClick={handleSave}>Save traveller</PrimaryButton>
        <SecondaryButton type="button" onClick={() => setDraft(createTraveller())}>Reset form</SecondaryButton>
      </div>

      <div className="mt-6 space-y-3">
        {trip.travellers.length === 0 ? (
          <EmptyState title="No travellers yet" body="Add profiles for people on this trip. Multiple travellers are supported under one account." />
        ) : (
          trip.travellers.map((traveller) => (
            <article key={traveller.id} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="text-sm text-slate-300">
                  <p className="text-base font-medium text-white">
                    {traveller.preferredName || traveller.name}
                    {traveller.preferredName && traveller.preferredName !== traveller.name ? (
                      <span className="text-slate-400"> ({traveller.name})</span>
                    ) : null}
                  </p>
                  <p className="mt-1">
                    DOB {traveller.dateOfBirth || '—'} · {traveller.nationality || 'Nationality n/a'} · residence{' '}
                    {traveller.countryOfResidence || '—'}
                  </p>
                  <p className="mt-1">
                    Airports: home {traveller.homeAirport || '—'} · preferred {traveller.preferredDepartureAirports || '—'}
                  </p>
                  <p className="mt-1">
                    {traveller.language || 'en'} · {traveller.currency || 'USD'} · {traveller.timeZone || 'tz n/a'}
                  </p>
                  <p className="mt-1">Diet: {traveller.dietaryRequirements || 'None listed'}</p>
                  <p className="mt-1">Accessibility: {traveller.accessibilityNeeds || 'None listed'}</p>
                  <p className="mt-1">
                    Seat {traveller.seatingPreference || '—'} · cabin {traveller.cabinPreference || '—'} · hotel{' '}
                    {traveller.hotelPreferences || '—'}
                  </p>
                  <p className="mt-1">
                    Emergency: {traveller.emergencyContactName || '—'} {traveller.emergencyContactPhone}
                  </p>
                  <p className="mt-1">
                    Loyalty: {traveller.loyaltyPrograms || '—'}
                    {traveller.loyaltyMemberships.length
                      ? ` · ${traveller.loyaltyMemberships.length} membership(s)`
                      : ''}
                  </p>
                  <p className="mt-1">Companions: {traveller.companions.length || 0}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Passport metadata: ****{traveller.passportNumberLast4 || '----'} · {traveller.passportCountry || '—'} ·
                    exp {traveller.passportExpiry || '—'} · {traveller.identityDocumentType || 'ID n/a'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <SecondaryButton type="button" onClick={() => setDraft(traveller)}>Edit</SecondaryButton>
                  <SecondaryButton type="button" onClick={() => deleteTraveller(traveller.id)}>Delete</SecondaryButton>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </Panel>
  );
}

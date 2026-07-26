import type { MouseEvent } from 'react';
import type { TravelSection } from '../data/sections';

type SectionCardProps = {
  section: TravelSection;
};

const TOOL_GROUPS: Record<string, string> = {
  flights: 'Book',
  stays: 'Book',
  services: 'Book',
  itinerary: 'Plan',
  destinations: 'Plan',
  budget: 'Plan',
  bookings: 'Organise',
  assistance: 'Home',
  'concierge-plan': 'Home',
};

export function SectionCard({ section }: SectionCardProps) {
  const openFeature = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    document.getElementById('trip-platform')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

    const groupLabel = TOOL_GROUPS[section.targetTab];
    const groupButton = Array.from(document.querySelectorAll<HTMLButtonElement>('nav[aria-label="Platform sections"] button')).find(
      (button) => button.textContent?.trim() === groupLabel,
    );
    groupButton?.click();

    window.setTimeout(() => {
      document.getElementById(`trip-platform-tab-${section.targetTab}`)?.click();
      document.getElementById(`trip-platform-panel-${section.targetTab}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);

    window.history.replaceState(null, '', `${section.href}?tool=${section.targetTab}`);
  };

  return (
    <article className="group relative rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-slate-950/20 backdrop-blur transition hover:-translate-y-1 hover:border-sky-300/40 hover:bg-white/[0.07]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-sky-300">{section.eyebrow}</p>
        <span className="rounded-full border border-white/15 px-2.5 py-1 text-[11px] text-slate-200">
          {section.availability}
        </span>
      </div>
      <h3 className="mt-4 text-xl font-semibold text-white">
        <a
          href={`${section.href}?tool=${section.targetTab}`}
          onClick={openFeature}
          className="after:absolute after:inset-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-300 group-hover:text-sky-200"
          aria-label={`Open ${section.title}`}
        >
          {section.title}
        </a>
      </h3>
      <p className="mt-3 text-sm leading-6 text-slate-300">{section.description}</p>
      <p className="mt-5 text-sm font-semibold text-sky-200 transition group-hover:translate-x-1">Open tool →</p>
    </article>
  );
}
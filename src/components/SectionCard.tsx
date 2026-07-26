import type { MouseEvent } from 'react';
import type { TravelSection } from '../data/sections';

type SectionCardProps = {
  section: TravelSection;
};

export function SectionCard({ section }: SectionCardProps) {
  const openFeature = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    window.dispatchEvent(new CustomEvent('aleya:navigate', { detail: { tab: section.targetTab } }));
    document.getElementById('trip-platform')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
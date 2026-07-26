import type { TravelSection } from '../data/sections';

type SectionCardProps = {
  section: TravelSection;
};

export function SectionCard({ section }: SectionCardProps) {
  return (
    <article className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-slate-950/20 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-sky-300">{section.eyebrow}</p>
        <span className="rounded-full border border-white/15 px-2.5 py-1 text-[11px] text-slate-200">
          {section.availability}
        </span>
      </div>
      <h3 className="mt-4 text-xl font-semibold text-white">
        <a href={section.href} className="hover:text-sky-200">
          {section.title}
        </a>
      </h3>
      <p className="mt-3 text-sm leading-6 text-slate-300">{section.description}</p>
    </article>
  );
}

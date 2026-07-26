import type { TripData, TripStop } from '../../store/tripDomain';

const pad = (value: number): string => String(value).padStart(2, '0');

const toIcsDateTime = (date: string, time: string): string | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const hhmm = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time || '09:00');
  const hours = hhmm ? Number(hhmm[1]) : 9;
  const minutes = hhmm ? Number(hhmm[2]) : 0;
  const stamp = `${date.replace(/-/g, '')}T${pad(hours)}${pad(minutes)}00`;
  return stamp;
};

const escapeIcs = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');

const fold = (line: string): string => {
  if (line.length <= 74) return line;
  const chunks: string[] = [];
  let remaining = line;
  chunks.push(remaining.slice(0, 74));
  remaining = remaining.slice(74);
  while (remaining.length > 0) {
    chunks.push(` ${remaining.slice(0, 73)}`);
    remaining = remaining.slice(73);
  }
  return chunks.join('\r\n');
};

export type CalendarExportOptions = {
  includeUnlockedOnly?: boolean;
  productId?: string;
};

/** Build a VCALENDAR payload for itinerary items. Google/Microsoft OAuth not required. */
export function buildItineraryIcs(trip: TripData, options: CalendarExportOptions = {}): string {
  const productId = options.productId ?? '-//ALEYA Travel Assistant//EN';
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${productId}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcs(trip.tripName || 'ALEYA Trip')}`,
  ];

  const stops = trip.stops.filter((stop) => {
    if (options.includeUnlockedOnly && stop.locked) return false;
    return Boolean(stop.date);
  });

  for (const stop of stops) {
    const dtStart = toIcsDateTime(stop.date, stop.startTime || '09:00');
    const dtEnd = toIcsDateTime(stop.date, stop.endTime || stop.startTime || '10:00');
    if (!dtStart || !dtEnd) continue;
    const description = [
      stop.notes,
      stop.bookingReference ? `Ref: ${stop.bookingReference}` : '',
      stop.supplierDetails ? `Supplier: ${stop.supplierDetails}` : '',
      stop.aiGenerated ? 'AI-generated planning item (not a live booking).' : '',
    ]
      .filter(Boolean)
      .join('\n');
    lines.push(
      'BEGIN:VEVENT',
      `UID:${stop.id}@aleya.travel`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${escapeIcs(stop.title)}`,
      `LOCATION:${escapeIcs(stop.location || trip.destination || '')}`,
      `DESCRIPTION:${escapeIcs(description)}`,
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

export function downloadIcsFile(filename: string, contents: string): void {
  const blob = new Blob([contents], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename.endsWith('.ics') ? filename : `${filename}.ics`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function buildPrintableItineraryHtml(trip: TripData): string {
  const rows = [...trip.stops]
    .sort((a, b) => a.day - b.day || a.order - b.order || a.startTime.localeCompare(b.startTime))
    .map(
      (stop) => `
      <tr>
        <td>Day ${stop.day}</td>
        <td>${stop.date || '—'}</td>
        <td>${stop.startTime || '—'}–${stop.endTime || '—'}</td>
        <td>${escapeHtml(stop.title)}${stop.aiGenerated ? ' <em>(AI suggestion)</em>' : ''}${stop.locked ? ' 🔒' : ''}</td>
        <td>${escapeHtml(stop.location)}</td>
        <td>${escapeHtml(stop.notes)}</td>
      </tr>`,
    )
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(trip.tripName)} itinerary</title>
  <style>
    body { font-family: Georgia, serif; color: #122; padding: 24px; }
    h1 { margin-bottom: 4px; }
    .meta { color: #456; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { border: 1px solid #ccd; padding: 8px; vertical-align: top; }
    th { background: #f2f5f8; text-align: left; }
    .disclaimer { margin-top: 16px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <h1>${escapeHtml(trip.tripName)}</h1>
  <p class="meta">${escapeHtml(trip.destination || 'No destination')} · ${trip.departureDate || '—'} → ${trip.returnDate || '—'} · ${trip.currency}</p>
  <table>
    <thead><tr><th>Day</th><th>Date</th><th>Time</th><th>Item</th><th>Location</th><th>Notes</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="6">No itinerary items.</td></tr>'}</tbody>
  </table>
  <p class="disclaimer">ALEYA Travel Assistant printable itinerary. AI/mock planning items are labelled and are not live bookings.</p>
</body>
</html>`;
}

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export function openPrintableItinerary(trip: TripData): void {
  const html = buildPrintableItineraryHtml(trip);
  const popup = window.open('', '_blank', 'noopener,noreferrer,width=960,height=720');
  if (!popup) return;
  popup.document.write(html);
  popup.document.close();
  popup.focus();
  popup.print();
}

/** Future calendar provider interfaces — no OAuth required now. */
export type ExternalCalendarProvider = 'google' | 'microsoft' | 'apple';

export type ExternalCalendarAdapter = {
  id: ExternalCalendarProvider;
  label: string;
  status: 'placeholder';
  connect(): Promise<{ ok: false; message: string }>;
  pushEvents(_stops: TripStop[]): Promise<{ ok: false; message: string }>;
};

export const EXTERNAL_CALENDAR_ADAPTERS: ExternalCalendarAdapter[] = [
  {
    id: 'google',
    label: 'Google Calendar',
    status: 'placeholder',
    async connect() {
      return { ok: false, message: 'Google Calendar OAuth is not configured in this phase.' };
    },
    async pushEvents() {
      return { ok: false, message: 'Google Calendar sync requires approved OAuth credentials.' };
    },
  },
  {
    id: 'microsoft',
    label: 'Microsoft Outlook',
    status: 'placeholder',
    async connect() {
      return { ok: false, message: 'Microsoft Graph OAuth is not configured in this phase.' };
    },
    async pushEvents() {
      return { ok: false, message: 'Microsoft calendar sync requires approved OAuth credentials.' };
    },
  },
];

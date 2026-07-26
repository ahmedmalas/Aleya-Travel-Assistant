import { useMemo, useState } from 'react';
import {
  createSupportTicket,
  FAQ_ENTRIES,
  getSystemStatus,
  loadSupportTickets,
  persistSupportTickets,
  type SupportTicket,
  type SupportTicketKind,
} from '../../store/support/supportCentre';
import { useSharedTripStore } from '../../store/TripStoreContext';
import { EmptyState, Field, Panel, PrimaryButton, StatusBanner, inputClassName } from './shared/ui';

export function SupportCentrePanel() {
  const { accountSettings, activeVaultTrip } = useSharedTripStore();
  const [tickets, setTickets] = useState<SupportTicket[]>(() => loadSupportTickets());
  const [kind, setKind] = useState<SupportTicketKind>('support');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const status = useMemo(() => getSystemStatus(), []);

  const submit = () => {
    if (!subject.trim() || !body.trim()) {
      setFeedback('Subject and details are required.');
      return;
    }
    const ticket = createSupportTicket({
      kind,
      subject,
      body,
      contactEmail: accountSettings.email,
      tripId: activeVaultTrip.id,
    });
    const next = [ticket, ...tickets];
    setTickets(next);
    persistSupportTickets(next);
    setSubject('');
    setBody('');
    setFeedback('Support request stored locally. External helpdesk is not connected in this phase.');
  };

  return (
    <Panel
      title="Help & support"
      description="FAQ, contact forms, bug reports, feature requests, and system status. Tickets are stored securely in-app until an external helpdesk is connected."
    >
      {feedback ? <StatusBanner kind="info" message={feedback} /> : null}

      <section className="mt-4 rounded-2xl border border-white/10 bg-slate-950/40 p-4">
        <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-300">System status</h3>
        <p className="mt-2 text-sm text-slate-200">
          Overall: <strong className="text-white">{status.overall}</strong> · updated{' '}
          {new Date(status.updatedAt).toLocaleString()}
        </p>
        <ul className="mt-2 space-y-1 text-sm text-slate-300">
          {status.components.map((component) => (
            <li key={component.name}>
              {component.name}: {component.status} — {component.detail}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-4">
        <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-300">FAQ</h3>
        <div className="mt-3 space-y-3">
          {FAQ_ENTRIES.map((entry) => (
            <details key={entry.id} className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
              <summary className="cursor-pointer font-medium text-white">{entry.question}</summary>
              <p className="mt-2 text-sm text-slate-300">{entry.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mt-6 grid gap-3 md:grid-cols-2">
        <Field label="Request type" htmlFor="support-kind">
          <select
            id="support-kind"
            className={inputClassName}
            value={kind}
            onChange={(event) => setKind(event.target.value as SupportTicketKind)}
          >
            <option value="support">Contact support</option>
            <option value="bug">Bug report</option>
            <option value="feature">Feature request</option>
            <option value="feedback">Feedback</option>
          </select>
        </Field>
        <Field label="Subject" htmlFor="support-subject">
          <input
            id="support-subject"
            className={inputClassName}
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
          />
        </Field>
        <div className="md:col-span-2">
          <Field label="Details" htmlFor="support-body">
            <textarea
              id="support-body"
              className={`${inputClassName} min-h-28`}
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
          </Field>
        </div>
      </section>
      <div className="mt-3">
        <PrimaryButton type="button" onClick={submit}>
          Submit request
        </PrimaryButton>
      </div>

      <section className="mt-6">
        <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-300">Ticket history</h3>
        {tickets.length === 0 ? (
          <div className="mt-3">
            <EmptyState title="No tickets yet" body="Submitted requests will appear here." />
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {tickets.map((ticket) => (
              <li key={ticket.id} className="rounded-xl border border-white/10 bg-slate-950/40 p-3 text-sm text-slate-300">
                <p className="font-medium text-white">
                  [{ticket.kind}] {ticket.subject}
                </p>
                <p className="mt-1">{ticket.body}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {ticket.status} · {new Date(ticket.createdAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-sm text-slate-300">
        <h3 className="font-medium text-white">Privacy & terms</h3>
        <p className="mt-2">
          Placeholder legal pages: privacy policy and terms of use will be published before production launch. Do not
          submit sensitive identity documents through support tickets.
        </p>
      </section>
    </Panel>
  );
}

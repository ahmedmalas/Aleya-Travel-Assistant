export type SupportTicketKind = 'support' | 'bug' | 'feature' | 'feedback';
export type SupportTicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export type SupportTicket = {
  id: string;
  kind: SupportTicketKind;
  subject: string;
  body: string;
  contactEmail: string;
  status: SupportTicketStatus;
  createdAt: string;
  updatedAt: string;
  tripId: string | null;
};

export type SystemStatus = {
  overall: 'operational' | 'degraded' | 'outage';
  updatedAt: string;
  components: Array<{ name: string; status: 'operational' | 'degraded' | 'outage'; detail: string }>;
};

export const SUPPORT_STORAGE_KEY = 'travel-buddy:support-tickets:v1';

export const FAQ_ENTRIES = [
  {
    id: 'faq-mock',
    question: 'Are flight and hotel results live inventory?',
    answer:
      'No. Until supplier credentials are approved, ALEYA uses mock providers through the provider gateway. Results are clearly labelled planning-only.',
  },
  {
    id: 'faq-docs',
    question: 'How are travel documents stored?',
    answer:
      'Document files use private storage with signed URLs and RLS. Metadata never includes full passport numbers — only last-4 and expiry fields.',
  },
  {
    id: 'faq-share',
    question: 'Can I share a trip securely?',
    answer:
      'Yes. Collaboration supports owner, editor, and viewer roles with invite, accept, revoke, and leave flows. RLS enforces access server-side.',
  },
  {
    id: 'faq-ai',
    question: 'Is the AI concierge using a live model?',
    answer:
      'This phase uses a secure mock AI planning abstraction so workflows can be completed without external AI credentials. Outputs are labelled AI-generated.',
  },
] as const;

export const createSupportTicket = (input: {
  kind: SupportTicketKind;
  subject: string;
  body: string;
  contactEmail: string;
  tripId?: string | null;
}): SupportTicket => {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    kind: input.kind,
    subject: input.subject.trim() || 'Untitled request',
    body: input.body.trim(),
    contactEmail: input.contactEmail.trim(),
    status: 'open',
    createdAt: now,
    updatedAt: now,
    tripId: input.tripId ?? null,
  };
};

export const loadSupportTickets = (): SupportTicket[] => {
  try {
    const raw = window.localStorage.getItem(SUPPORT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SupportTicket[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const persistSupportTickets = (tickets: SupportTicket[]): void => {
  try {
    window.localStorage.setItem(SUPPORT_STORAGE_KEY, JSON.stringify(tickets.slice(0, 200)));
  } catch {
    // Ignore quota errors.
  }
};

export const getSystemStatus = (): SystemStatus => ({
  overall: 'operational',
  updatedAt: new Date().toISOString(),
  components: [
    { name: 'App shell', status: 'operational', detail: 'Local UI and vault available.' },
    { name: 'Provider gateway', status: 'operational', detail: 'Mock providers active; live suppliers await credentials.' },
    { name: 'Cloud sync', status: 'degraded', detail: 'Requires signed-in Supabase session for cloud persistence.' },
    { name: 'Email / push / SMS', status: 'outage', detail: 'External notification providers not connected (placeholders only).' },
  ],
});

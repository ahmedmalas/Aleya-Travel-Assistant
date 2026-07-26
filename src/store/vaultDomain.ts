import {
  appendActivity,
  cloneTrip,
  createEmptyTrip,
  createSeededTrip,
  migrateTrip,
  sanitizeTrip,
  type CollaborationAuditEntry,
  type CollaborationMember,
  type CollaborationRole,
  type CollaborationState,
  type TripData,
  type TripDocument,
  type TripDocumentType,
} from './tripDomain';

export type {
  CollaborationAuditEntry,
  CollaborationMember,
  CollaborationRole,
  CollaborationState,
  TripDocument,
  TripDocumentType,
};

export type CollaborationMemberStatus = CollaborationMember['status'];

export type TripVaultMeta = {
  id: string;
  favourite: boolean;
  lastOpenedAt: string;
  createdAt: string;
  updatedAt: string;
  documents: TripDocument[];
  collaboration: CollaborationState;
};

export type VaultTrip = TripData & TripVaultMeta;

export type TripVaultState = {
  version: number;
  activeTripId: string;
  trips: VaultTrip[];
};

export type TripTemplate = {
  id: string;
  name: string;
  description: string;
  isDefault: boolean;
  createdAt: string;
  sourceTripId: string | null;
  snapshot: VaultTrip;
};

export type VaultSortKey = 'lastOpened' | 'name' | 'departure' | 'updated' | 'favourite';
export type VaultFilterKey =
  | 'all'
  | 'active'
  | 'upcoming'
  | 'completed'
  | 'cancelled'
  | 'draft'
  | 'archived'
  | 'favourites';

export type GlobalSearchHit = {
  id: string;
  tripId: string;
  tripName: string;
  entity: 'trip' | 'itinerary' | 'booking' | 'expense' | 'packing' | 'traveller' | 'document' | 'destination' | 'note' | 'service';
  title: string;
  subtitle: string;
};

export type CalendarViewMode = 'month' | 'week' | 'day';

export const DOCUMENT_TYPES: TripDocumentType[] = [
  'passport',
  'visa',
  'insurance',
  'ticket',
  'reservation',
  'other',
];

export const COLLABORATION_ROLES: CollaborationRole[] = ['owner', 'editor', 'viewer'];
export const VAULT_STORAGE_VERSION = 1;
export const TEMPLATE_STORAGE_VERSION = 1;
export const VAULT_STORAGE_KEY = 'travel-buddy:trip-vault:v1';
export const TEMPLATE_STORAGE_KEY = 'travel-buddy:trip-templates:v1';

const isIsoDate = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(value).getTime());
const asString = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback);
const asBoolean = (value: unknown, fallback = false): boolean => (typeof value === 'boolean' ? value : fallback);

export const createDefaultCollaboration = (ownerName = 'Local Owner', ownerEmail = 'owner@local'): CollaborationState => ({
  ownerName,
  ownerEmail,
  members: [
    {
      id: 'member-owner',
      name: ownerName,
      email: ownerEmail,
      role: 'owner',
      invitedAt: new Date().toISOString(),
      status: 'accepted',
    },
  ],
  auditHistory: [
    {
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      actorName: ownerName,
      action: 'initialized',
      details: 'Local collaboration foundation created (no backend sync).',
    },
  ],
});

export const createVaultTrip = (overrides: Partial<VaultTrip> = {}): VaultTrip => {
  const now = new Date().toISOString();
  const base = createEmptyTrip();
  return {
    ...base,
    id: crypto.randomUUID(),
    favourite: false,
    lastOpenedAt: now,
    createdAt: now,
    updatedAt: now,
    documents: [],
    collaboration: createDefaultCollaboration(),
    ...overrides,
  };
};

export const sanitizeDocument = (doc: Partial<TripDocument>): TripDocument => ({
  id: asString(doc.id, crypto.randomUUID()),
  type: DOCUMENT_TYPES.includes(doc.type as TripDocumentType) ? (doc.type as TripDocumentType) : 'other',
  title: asString(doc.title).trim() || 'Untitled document',
  holderName: asString(doc.holderName).trim(),
  documentNumberLast4: asString(doc.documentNumberLast4).replace(/\D/g, '').slice(-4),
  issuingCountry: asString(doc.issuingCountry).trim(),
  issueDate: isIsoDate(asString(doc.issueDate)) ? asString(doc.issueDate) : '',
  expiryDate: isIsoDate(asString(doc.expiryDate)) ? asString(doc.expiryDate) : '',
  notes: asString(doc.notes).trim(),
  attachmentName: asString(doc.attachmentName).trim(),
  attachmentMimeType: asString(doc.attachmentMimeType).trim(),
  storagePath: asString((doc as Partial<TripDocument>).storagePath).trim(),
});

export const sanitizeCollaboration = (value: unknown): CollaborationState => {
  if (!value || typeof value !== 'object') {
    return createDefaultCollaboration();
  }
  const raw = value as Partial<CollaborationState>;
  const ownerName = asString(raw.ownerName, 'Local Owner') || 'Local Owner';
  const ownerEmail = asString(raw.ownerEmail, 'owner@local') || 'owner@local';
  const members = Array.isArray(raw.members)
    ? raw.members.map((member) => {
        const item = member as Partial<CollaborationMember>;
        return {
          id: asString(item.id, crypto.randomUUID()),
          name: asString(item.name).trim() || 'Member',
          email: asString(item.email).trim(),
          role: COLLABORATION_ROLES.includes(item.role as CollaborationRole)
            ? (item.role as CollaborationRole)
            : 'viewer',
          invitedAt: asString(item.invitedAt, new Date().toISOString()),
          status:
            item.status === 'pending' ||
            item.status === 'accepted' ||
            item.status === 'revoked' ||
            item.status === 'expired' ||
            item.status === 'active' ||
            item.status === 'invited'
              ? item.status === 'invited'
                ? 'pending'
                : item.status === 'active'
                  ? 'accepted'
                  : item.status
              : 'pending',
        };
      })
    : createDefaultCollaboration(ownerName, ownerEmail).members;
  const auditHistory = Array.isArray(raw.auditHistory)
    ? raw.auditHistory
        .map((entry) => {
          const item = entry as Partial<CollaborationAuditEntry>;
          return {
            id: asString(item.id, crypto.randomUUID()),
            at: asString(item.at, new Date().toISOString()),
            actorName: asString(item.actorName, ownerName),
            action: asString(item.action, 'event'),
            details: asString(item.details),
          };
        })
        .slice(0, 100)
    : [];
  return { ownerName, ownerEmail, members, auditHistory };
};

export const toVaultTrip = (trip: TripData | VaultTrip, preferredId?: string): VaultTrip => {
  const now = new Date().toISOString();
  const asVault = trip as Partial<VaultTrip>;
  const migrated = sanitizeTrip(trip);
  return {
    ...migrated,
    id: asString(asVault.id, preferredId ?? crypto.randomUUID()) || crypto.randomUUID(),
    favourite: asBoolean(asVault.favourite, false),
    lastOpenedAt: asString(asVault.lastOpenedAt, now) || now,
    createdAt: asString(asVault.createdAt, now) || now,
    updatedAt: asString(asVault.updatedAt, now) || now,
    documents: Array.isArray(asVault.documents)
      ? asVault.documents.map((doc) => sanitizeDocument(doc as Partial<TripDocument>))
      : [],
    collaboration: sanitizeCollaboration(asVault.collaboration),
  };
};

export const cloneVaultTrip = (trip: VaultTrip, options?: { newId?: boolean; rename?: string }): VaultTrip => {
  const cloned = cloneTrip(trip);
  const now = new Date().toISOString();
  return {
    ...toVaultTrip(cloned),
    id: options?.newId === false ? trip.id : crypto.randomUUID(),
    tripName: options?.rename ?? `${trip.tripName} (copy)`,
    favourite: false,
    lastOpenedAt: now,
    createdAt: now,
    updatedAt: now,
    documents: trip.documents.map((doc) => ({ ...doc, id: crypto.randomUUID() })),
    collaboration: {
      ...createDefaultCollaboration(trip.collaboration.ownerName, trip.collaboration.ownerEmail),
      auditHistory: [
        {
          id: crypto.randomUUID(),
          at: now,
          actorName: trip.collaboration.ownerName,
          action: 'duplicated',
          details: `Duplicated from trip ${trip.id}.`,
        },
      ],
    },
    activityLog: [],
  };
};

export const createDefaultVaultState = (seed = true): TripVaultState => {
  const trip = toVaultTrip(seed ? createSeededTrip() : createEmptyTrip({ status: 'draft' }));
  return {
    version: VAULT_STORAGE_VERSION,
    activeTripId: trip.id,
    trips: [trip],
  };
};

export const migrateVaultState = (value: unknown, fallbackActiveTrip?: TripData | null): TripVaultState => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const raw = value as Partial<TripVaultState>;
    if (Array.isArray(raw.trips) && raw.trips.length > 0) {
      const trips = raw.trips.map((trip) => toVaultTrip(trip as TripData));
      const activeTripId =
        typeof raw.activeTripId === 'string' && trips.some((trip) => trip.id === raw.activeTripId)
          ? raw.activeTripId
          : trips[0]!.id;
      return {
        version: VAULT_STORAGE_VERSION,
        activeTripId,
        trips,
      };
    }
  }
  if (fallbackActiveTrip) {
    const trip = toVaultTrip(fallbackActiveTrip);
    return { version: VAULT_STORAGE_VERSION, activeTripId: trip.id, trips: [trip] };
  }
  return createDefaultVaultState(true);
};

export const syncActiveTripIntoVault = (vault: TripVaultState, activeTrip: TripData | VaultTrip): TripVaultState => {
  const nextActive = toVaultTrip(activeTrip, vault.activeTripId);
  const exists = vault.trips.some((trip) => trip.id === nextActive.id);
  const trips = exists
    ? vault.trips.map((trip) => (trip.id === nextActive.id ? { ...nextActive, updatedAt: new Date().toISOString() } : trip))
    : [...vault.trips, { ...nextActive, updatedAt: new Date().toISOString() }];
  return {
    ...vault,
    activeTripId: nextActive.id,
    trips,
  };
};

export const getActiveVaultTrip = (vault: TripVaultState): VaultTrip => {
  return vault.trips.find((trip) => trip.id === vault.activeTripId) ?? vault.trips[0] ?? createVaultTrip();
};

export const DEFAULT_TRIP_TEMPLATES: TripTemplate[] = [
  {
    id: 'template-weekend-city',
    name: 'Weekend city break',
    description: 'Two-night leisure city trip with light itinerary scaffolding.',
    isDefault: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    sourceTripId: null,
    snapshot: createVaultTrip({
      id: 'template-weekend-city-snapshot',
      tripName: 'Weekend city break',
      destination: '',
      purpose: 'leisure',
      travellerCount: 2,
      budget: 1200,
      status: 'draft',
      notes: 'Template: short city escape.',
      stops: [
        {
          id: 'tpl-s1',
          title: 'Arrive and check in',
          day: 1,
          order: 1,
          notes: '',
          date: '',
          startTime: '15:00',
          endTime: '16:00',
          location: '',
          category: 'lodging',
          cost: 0,
          currency: 'USD',
          bookingReference: '',

          locked: false,
          travellerIds: [],
          itemStatus: 'planned' as const,
          latitude: '',
          longitude: '',
          supplierDetails: '',
          reminderAt: '',
          aiGenerated: false,
        },
        {
          id: 'tpl-s2',
          title: 'City walking loop',
          day: 2,
          order: 1,
          notes: '',
          date: '',
          startTime: '10:00',
          endTime: '13:00',
          location: '',
          category: 'sightseeing',
          cost: 0,
          currency: 'USD',
          bookingReference: '',

          locked: false,
          travellerIds: [],
          itemStatus: 'planned' as const,
          latitude: '',
          longitude: '',
          supplierDetails: '',
          reminderAt: '',
          aiGenerated: false,
        },
      ],
    }),
  },
  {
    id: 'template-business',
    name: 'Business trip',
    description: 'Work-focused template with meetings and transport placeholders.',
    isDefault: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    sourceTripId: null,
    snapshot: createVaultTrip({
      id: 'template-business-snapshot',
      tripName: 'Business trip',
      purpose: 'business',
      travellerCount: 1,
      budget: 2500,
      status: 'draft',
      notes: 'Template: meetings and logistics.',
      stops: [
        {
          id: 'tpl-b1',
          title: 'Client meeting',
          day: 1,
          order: 1,
          notes: '',
          date: '',
          startTime: '09:00',
          endTime: '11:00',
          location: '',
          category: 'activity',
          cost: 0,
          currency: 'USD',
          bookingReference: '',

          locked: false,
          travellerIds: [],
          itemStatus: 'planned' as const,
          latitude: '',
          longitude: '',
          supplierDetails: '',
          reminderAt: '',
          aiGenerated: false,
        },
      ],
    }),
  },
  {
    id: 'template-solo',
    name: 'Solo travel',
    description: 'Independent itinerary with flexible pacing and safety notes.',
    isDefault: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    sourceTripId: null,
    snapshot: createVaultTrip({
      id: 'template-solo-snapshot',
      tripName: 'Solo escape',
      purpose: 'solo',
      travelStyle: 'balanced',
      travellerCount: 1,
      budget: 1800,
      status: 'draft',
      tags: ['solo', 'flexible'],
      notes: 'Template: solo travel with flexible days.',
    }),
  },
  {
    id: 'template-couples',
    name: 'Couples getaway',
    description: 'Romantic pacing with dining and shared experiences.',
    isDefault: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    sourceTripId: null,
    snapshot: createVaultTrip({
      id: 'template-couples-snapshot',
      tripName: 'Couples getaway',
      purpose: 'couples',
      travelStyle: 'romantic',
      travellerCount: 2,
      budget: 3200,
      status: 'draft',
      tags: ['couples', 'romantic'],
      notes: 'Template: couples getaway.',
    }),
  },
  {
    id: 'template-family',
    name: 'Family holiday',
    description: 'Family-friendly days with rest blocks and shared activities.',
    isDefault: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    sourceTripId: null,
    snapshot: createVaultTrip({
      id: 'template-family-snapshot',
      tripName: 'Family holiday',
      purpose: 'family',
      travelStyle: 'family',
      travellerCount: 4,
      budget: 5000,
      status: 'draft',
      tags: ['family'],
      notes: 'Template: family holiday.',
    }),
  },
  {
    id: 'template-road-trip',
    name: 'Road trip',
    description: 'Multi-stop driving itinerary with lodging hops.',
    isDefault: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    sourceTripId: null,
    snapshot: createVaultTrip({
      id: 'template-road-trip-snapshot',
      tripName: 'Road trip',
      purpose: 'road-trip',
      travelStyle: 'adventure',
      travellerCount: 2,
      budget: 2800,
      status: 'draft',
      tags: ['road-trip'],
      destinationsList: ['Start city', 'Midpoint', 'End city'],
      notes: 'Template: road trip multi-stop.',
    }),
  },
  {
    id: 'template-cruise',
    name: 'Cruise holiday',
    description: 'Embarkation, sea days, and port exploration scaffolding.',
    isDefault: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    sourceTripId: null,
    snapshot: createVaultTrip({
      id: 'template-cruise-snapshot',
      tripName: 'Cruise holiday',
      purpose: 'cruise',
      travelStyle: 'balanced',
      travellerCount: 2,
      budget: 4500,
      status: 'draft',
      tags: ['cruise'],
      notes: 'Template: cruise holiday.',
    }),
  },
  {
    id: 'template-weekend',
    name: 'Weekend escape',
    description: 'Short break with light packing and two signature experiences.',
    isDefault: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    sourceTripId: null,
    snapshot: createVaultTrip({
      id: 'template-weekend-snapshot',
      tripName: 'Weekend escape',
      purpose: 'weekend',
      travelStyle: 'balanced',
      travellerCount: 2,
      budget: 900,
      status: 'draft',
      tags: ['weekend'],
      notes: 'Template: weekend escape.',
    }),
  },
  {
    id: 'template-honeymoon',
    name: 'Honeymoon',
    description: 'Celebration-focused luxury leisure template.',
    isDefault: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    sourceTripId: null,
    snapshot: createVaultTrip({
      id: 'template-honeymoon-snapshot',
      tripName: 'Honeymoon',
      purpose: 'honeymoon',
      travelStyle: 'romantic',
      travellerCount: 2,
      budget: 7000,
      status: 'draft',
      tags: ['honeymoon', 'celebration'],
      notes: 'Template: honeymoon.',
    }),
  },
  {
    id: 'template-group',
    name: 'Group travel',
    description: 'Shared decisions, split expenses, and group logistics.',
    isDefault: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    sourceTripId: null,
    snapshot: createVaultTrip({
      id: 'template-group-snapshot',
      tripName: 'Group trip',
      purpose: 'group',
      travelStyle: 'balanced',
      travellerCount: 6,
      budget: 9000,
      status: 'draft',
      tags: ['group'],
      notes: 'Template: group travel.',
    }),
  },
  {
    id: 'template-accessible',
    name: 'Accessible travel',
    description: 'Accessibility-first pacing, transfers, and lodging notes.',
    isDefault: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    sourceTripId: null,
    snapshot: createVaultTrip({
      id: 'template-accessible-snapshot',
      tripName: 'Accessible trip',
      purpose: 'accessible',
      travelStyle: 'accessible',
      travellerCount: 2,
      budget: 3500,
      status: 'draft',
      tags: ['accessible'],
      notes: 'Template: accessible travel.',
    }),
  },
  {
    id: 'template-adventure',
    name: 'Adventure travel',
    description: 'Outdoor-forward days with gear and weather buffers.',
    isDefault: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    sourceTripId: null,
    snapshot: createVaultTrip({
      id: 'template-adventure-snapshot',
      tripName: 'Adventure trip',
      purpose: 'adventure',
      travelStyle: 'adventure',
      travellerCount: 2,
      budget: 4000,
      status: 'draft',
      tags: ['adventure'],
      notes: 'Template: adventure travel.',
    }),
  },
];

export const migrateTemplates = (value: unknown): TripTemplate[] => {
  if (!Array.isArray(value)) {
    return DEFAULT_TRIP_TEMPLATES.map((template) => ({
      ...template,
      snapshot: toVaultTrip(template.snapshot),
    }));
  }
  const custom = value
    .filter((item) => item && typeof item === 'object')
    .map((item) => {
      const raw = item as Partial<TripTemplate>;
      return {
        id: asString(raw.id, crypto.randomUUID()),
        name: asString(raw.name, 'Untitled template') || 'Untitled template',
        description: asString(raw.description),
        isDefault: asBoolean(raw.isDefault, false),
        createdAt: asString(raw.createdAt, new Date().toISOString()),
        sourceTripId: typeof raw.sourceTripId === 'string' ? raw.sourceTripId : null,
        snapshot: toVaultTrip((raw.snapshot as TripData) ?? createEmptyTrip()),
      } satisfies TripTemplate;
    });
  const defaults = DEFAULT_TRIP_TEMPLATES.filter(
    (template) => !custom.some((entry) => entry.id === template.id || (entry.isDefault && entry.name === template.name)),
  );
  return [...defaults, ...custom].map((template) => ({
    ...template,
    snapshot: toVaultTrip(template.snapshot),
  }));
};

export const tripFromTemplate = (template: TripTemplate, name?: string): VaultTrip => {
  const now = new Date().toISOString();
  const base = cloneVaultTrip(toVaultTrip(template.snapshot), { newId: true, rename: name ?? template.name });
  return toVaultTrip(
    appendActivity(
      {
        ...base,
        status: 'draft',
        lastOpenedAt: now,
        createdAt: now,
        updatedAt: now,
        favourite: false,
      },
      `Created from template: ${template.name}.`,
    ),
  );
};

export const templateFromTrip = (trip: VaultTrip, name: string, description = ''): TripTemplate => ({
  id: crypto.randomUUID(),
  name: name.trim() || `${trip.tripName} template`,
  description: description.trim(),
  isDefault: false,
  createdAt: new Date().toISOString(),
  sourceTripId: trip.id,
  snapshot: toVaultTrip({
    ...cloneTrip(trip),
    status: 'draft',
    activityLog: [],
  }),
});

export const validateVaultImportPayload = (
  value: unknown,
): { ok: true; vault: TripVaultState } | { ok: false; message: string } => {
  if (!value || typeof value !== 'object') {
    return { ok: false, message: 'Vault import payload must be an object.' };
  }
  const raw = value as Record<string, unknown>;
  if (raw.schema === 'travel-buddy-vault-backup') {
    const migrated = migrateVaultState(raw.vault);
    if (migrated.trips.length === 0) {
      return { ok: false, message: 'Vault backup contains no trips.' };
    }
    return { ok: true, vault: migrated };
  }
  if (raw.schema === 'travel-buddy-backup' || raw.schema === 'travel-buddy-backup-v1' || raw.trip) {
    const trip = migrateTrip(raw.trip ?? raw);
    const vaultTrip = toVaultTrip(trip);
    return {
      ok: true,
      vault: {
        version: VAULT_STORAGE_VERSION,
        activeTripId: vaultTrip.id,
        trips: [vaultTrip],
      },
    };
  }
  if (Array.isArray(raw.trips)) {
    return { ok: true, vault: migrateVaultState(raw) };
  }
  return { ok: false, message: 'Unrecognized vault/backup import format.' };
};

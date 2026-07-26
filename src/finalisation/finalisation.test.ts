import { describe, expect, it } from 'vitest';
import {
  applyNetworkChange,
  assertNoUnsafeHtml,
  auditTripHealth,
  buildAccessibilityAudit,
  buildOpsDashboard,
  buildSecurityReviewChecklist,
  computeVirtualWindow,
  createEmptyFinalisationState,
  createOfflineState,
  filterLargeCollection,
  getVersionInfo,
  loadFeatureFlags,
  manageLocalCache,
  parseImportContent,
  redactSecrets,
  runBenchmark,
  sanitizePlainText,
  selectedImportEntities,
  setFeatureFlag,
  summarizeAnalytics,
  toggleImportEntity,
  trackEvent,
  validateBackupIntegrity,
  validateImportFile,
  createAnalyticsState,
  buildCompatibilityReport,
  buildMigrationReport,
} from './index';
import { createEmptySyncState } from '../store/sync/syncEngine';
import { createEmptyTrip } from '../store/tripDomain';

describe('finalisation slices 89–98', () => {
  it('parses ICS, CSV, email text, and Travel Buddy backups with review selection', () => {
    const ics = parseImportContent({
      fileName: 'trip.ics',
      content: `BEGIN:VCALENDAR
BEGIN:VEVENT
SUMMARY:Flight LHR to BCN
DTSTART:20260910T090000
DTEND:20260910T120000
UID:ABC123
END:VEVENT
END:VCALENDAR`,
    });
    expect(ics.sourceKind).toBe('ics');
    expect(ics.entities[0]?.kind).toBe('flight');
    expect(ics.overallConfidence).toBeGreaterThan(50);

    const csv = parseImportContent({
      fileName: 'export.csv',
      content: `type,title,start,confirmation\nflight,BA123,2026-09-10,PNR12345\nhotel,City Stay,2026-09-10,HTL99999`,
    });
    expect(csv.entities).toHaveLength(2);

    const email = parseImportContent({
      fileName: 'confirm.eml',
      content: `Subject: Booking confirmation
Flight LHR → BCN on 2026-09-10 09:00
Confirmation: XYZ98765
Hotel check-in: Marina Bay Inn
`,
    });
    expect(email.sourceKind).toBe('email');
    expect(email.entities.length).toBeGreaterThan(0);

    const backup = parseImportContent({
      fileName: 'backup.json',
      content: JSON.stringify({
        schema: 'travel-buddy-backup',
        trip: {
          flights: [
            {
              flightNumber: 'BA123',
              departureAirport: 'LHR',
              arrivalAirport: 'BCN',
              departureDate: '2026-09-10',
              bookingReference: 'PNR1',
            },
          ],
          stays: [{ name: 'Hotel', checkInDate: '2026-09-10', checkOutDate: '2026-09-14' }],
          travellers: [{ name: 'Ada' }],
        },
      }),
    });
    expect(backup.sourceKind).toBe('travel_buddy_backup');
    expect(backup.entities.some((e) => e.kind === 'traveller')).toBe(true);

    const toggled = toggleImportEntity(backup, backup.entities[0]!.id, false);
    expect(selectedImportEntities(toggled).length).toBe(backup.entities.length - 1);
    expect(validateImportFile({ fileName: 'x.exe', sizeBytes: 10 }).ok).toBe(false);
  });

  it('produces trip health findings and score explanations', () => {
    const trip = createEmptyTrip();
    trip.tripName = 'Audit Trip';
    trip.destination = 'Barcelona';
    trip.departureDate = '2026-09-10';
    trip.returnDate = '2026-09-14';
    trip.budget = 100;
    trip.expenses = [
      {
        id: 'e1',
        title: 'Big spend',
        category: 'flights',
        amount: 500,
        currency: 'GBP',
        date: '2026-09-10',
        paid: true,
        notes: '',

        deposit: 0,
        refund: 0,
        sharedTravellerIds: [],
        exchangeRateToTrip: 1,
        attachmentName: '',
      },
    ];
    trip.stops = [
      {
        id: 's1',
        title: 'Museum',
        day: 1,
        order: 1,
        notes: '',
        date: '2026-09-10',
        startTime: '10:00',
        endTime: '12:00',
        location: 'City',
        category: 'sightseeing',
        cost: 0,
        currency: 'GBP',
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
        id: 's2',
        title: 'Lunch',
        day: 1,
        order: 2,
        notes: '',
        date: '2026-09-10',
        startTime: '11:00',
        endTime: '13:00',
        location: 'City',
        category: 'food',
        cost: 0,
        currency: 'GBP',
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
    ];
    const report = auditTripHealth(trip);
    expect(report.score).toBeLessThan(100);
    expect(report.findings.some((f) => f.kind === 'budget_overrun')).toBe(true);
    expect(report.findings.some((f) => f.kind === 'impossible_transfer')).toBe(true);
    expect(report.findings.some((f) => f.kind === 'missing_accommodation_nights')).toBe(true);
    expect(report.summary).toContain('Trip Health');
  });

  it('supports offline degraded mode and cache management', () => {
    let state = createOfflineState('online');
    state = applyNetworkChange(state, 'offline');
    expect(state.uiMode).toBe('read_only_degraded');
    state = applyNetworkChange(state, 'online');
    expect(state.recoveredAt).not.toBeNull();

    const data = new Map<string, string>([
      ['travel-buddy:other:a', '12345'],
      ['travel-buddy:other:b', 'x'],
    ]);
    const storage: Storage = {
      get length() {
        return data.size;
      },
      key(i: number) {
        return [...data.keys()][i] ?? null;
      },
      getItem(key: string) {
        return data.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        data.set(key, value);
      },
      removeItem(key: string) {
        data.delete(key);
      },
      clear() {
        data.clear();
      },
    };
    const managed = manageLocalCache(storage, { dropPrefix: 'travel-buddy:other:' });
    expect(managed.removed.length).toBe(2);
  });

  it('virtualises lists and benchmarks filter performance', () => {
    const window = computeVirtualWindow({
      scrollTop: 1000,
      viewportHeight: 400,
      itemCount: 1000,
      itemHeight: 40,
    });
    expect(window.startIndex).toBeGreaterThan(0);
    expect(window.endIndex - window.startIndex).toBeLessThan(50);
    const items = Array.from({ length: 5000 }, (_, i) => ({ id: i, name: `Trip ${i} Barcelona` }));
    const filtered = filterLargeCollection(items, 'barcelona 42', (item) => item.name, 20);
    expect(filtered.length).toBeGreaterThan(0);
    const bench = runBenchmark('filter', 20, () => {
      filterLargeCollection(items, 'trip', (item) => item.name, 50);
    });
    expect(bench.averageMs).toBeGreaterThanOrEqual(0);
  });

  it('hardens text/backup inputs and tracks local analytics', () => {
    expect(sanitizePlainText('<script>alert(1)</script>hi').toLowerCase()).not.toContain('script');
    expect(assertNoUnsafeHtml('<script>x</script>').ok).toBe(false);
    expect(validateBackupIntegrity('{"schema":"travel-buddy-backup","backupVersion":6}')).toMatchObject({
      ok: true,
    });
    expect(redactSecrets('api_key=abcd token=xyz')).toContain('[REDACTED]');
    expect(buildSecurityReviewChecklist().length).toBeGreaterThan(3);
    expect(buildAccessibilityAudit().some((item) => item.id === 'keyboard')).toBe(true);

    let analytics = createAnalyticsState();
    analytics = trackEvent(analytics, 'search', { q: 'BCN' }, 'deal-engine');
    analytics = trackEvent(analytics, 'funnel_step', { step: 'import_review' });
    const summary = summarizeAnalytics(analytics);
    expect(summary.totalEvents).toBe(2);
    expect(summary.funnels.import_review).toBe(1);
  });

  it('exposes release flags, compatibility, and ops dashboard model', () => {
    const flags = setFeatureFlag(loadFeatureFlags(), 'experimentalDiscoveryBoost', true);
    expect(flags.find((f) => f.id === 'experimentalDiscoveryBoost')?.enabled).toBe(true);
    expect(getVersionInfo().applicationVersion).toBeTruthy();
    expect(buildCompatibilityReport().liveProvidersEnabled).toBe(false);
    expect(buildMigrationReport().some((row) => row.toVersion === 7)).toBe(true);

    const ops = buildOpsDashboard({
      offline: createOfflineState('online'),
      syncState: createEmptySyncState(),
      analytics: createAnalyticsState(),
      featureFlags: flags,
      importHistory: [],
      storage: window.localStorage,
    });
    expect(ops.applicationHealth).toBe('healthy');
    expect(ops.compatibility.cloudOptional).toBe(true);
    expect(createEmptyFinalisationState().featureFlags.length).toBeGreaterThan(0);
  });
});

import { describe, expect, it } from 'vitest';
import type { BackupSnapshot, TripStop } from '../../store/useTripStore';
import { createEmptyTrip } from '../../store/tripDomain';
import {
  buildDeepComparison,
  formatBytes,
  groupStopsByDay,
  isInSelectedTimeRange,
} from './comparisonUtils';

const makeStop = (partial: Partial<TripStop> & Pick<TripStop, 'id' | 'title' | 'day' | 'order'>): TripStop => ({
  notes: '',
  date: '',
  startTime: '',
  endTime: '',
  location: '',
  category: 'other',
  cost: 0,
  currency: 'USD',
  bookingReference: '',
  locked: false,
  travellerIds: [],
  itemStatus: 'planned',
  latitude: '',
  longitude: '',
  supplierDetails: '',
  reminderAt: '',
  aiGenerated: false,
  ...partial,
});

const makeSnapshot = (id: string, stops: TripStop[]): BackupSnapshot => ({
  id,
  createdAt: '2026-01-01T10:00:00.000Z',
  tripTitle: `Trip ${id}`,
  backupVersion: 3,
  applicationVersion: '0.1.0',
  itineraryItemCount: stops.length,
  pinned: false,
  label: '',
  notes: '',
  linkedRecordCount: null,
  trip: {
    ...createEmptyTrip({ tripName: `Trip ${id}`, stops }),
  },
});

describe('comparisonUtils', () => {
  it('groups stops by day in ascending order', () => {
    const grouped = groupStopsByDay([
      { id: 'b', day: 2, order: 1 },
      { id: 'a', day: 1, order: 1 },
      { id: 'c', day: 1, order: 2 },
    ]);
    expect(grouped.map(([day]) => day)).toEqual([1, 2]);
    expect(grouped[0][1].map((stop) => stop.id)).toEqual(['a', 'c']);
  });

  it('formats byte sizes for storage health labels', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(2 * 1024 * 1024)).toBe('2.00 MB');
  });

  it('filters snapshot timestamps by selected range', () => {
    const now = new Date();
    expect(isInSelectedTimeRange(now.toISOString(), 'all')).toBe(true);
    expect(isInSelectedTimeRange(now.toISOString(), 'today')).toBe(true);
    expect(isInSelectedTimeRange('2000-01-01T00:00:00.000Z', 'week')).toBe(false);
  });

  it('builds deep comparison for added, removed, modified, and unchanged items', () => {
    const snapshotA = makeSnapshot('a', [
      makeStop({ id: 'keep', title: 'Same', day: 1, order: 1, notes: 'unchanged' }),
      makeStop({ id: 'edit', title: 'Old title', day: 1, order: 2, notes: 'old' }),
      makeStop({ id: 'gone', title: 'Removed', day: 2, order: 1, notes: '' }),
    ]);
    const snapshotB = makeSnapshot('b', [
      makeStop({ id: 'keep', title: 'Same', day: 1, order: 1, notes: 'unchanged' }),
      makeStop({ id: 'edit', title: 'New title', day: 1, order: 2, notes: 'new' }),
      makeStop({ id: 'fresh', title: 'Added', day: 3, order: 1, notes: '' }),
    ]);

    const comparison = buildDeepComparison(snapshotA, snapshotB);
    expect(comparison.unchanged.map((item) => item.id)).toEqual(['keep']);
    expect(comparison.removed.map((item) => item.id)).toEqual(['gone']);
    expect(comparison.added.map((item) => item.id)).toEqual(['fresh']);
    expect(comparison.modified).toHaveLength(1);
    expect(comparison.modified[0]?.id).toBe('edit');
    expect(comparison.modified[0]?.fieldDiffs.map((diff) => diff.fieldLabel)).toEqual(
      expect.arrayContaining(['Title', 'Notes / description']),
    );
  });
});

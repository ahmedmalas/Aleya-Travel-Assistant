import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useTripStore } from './useTripStore';

describe('useTripStore foundation slices 45-52', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('exposes repository contracts, auth shell, sync queue, notifications and command centre', async () => {
    const { result } = renderHook(() => useTripStore());
    expect(result.current.repositories.trips).toBeTruthy();
    expect(result.current.cloudAdapterPlan.status).toBe('connected');
    expect(result.current.storageKeyCatalog.activeTrip).toContain('trip-state');

    await act(async () => {
      await result.current.authSignIn('sam@example.com', 'password');
    });
    expect(result.current.authState.mode).toBe('signed-in');

    act(() => {
      result.current.queueEntityChange('trip', result.current.activeVaultTrip.id, { ok: true }, result.current.activeVaultTrip.id);
    });
    await act(async () => {
      await result.current.runSync();
    });
    expect(result.current.syncSummary.synced).toBeGreaterThan(0);

    act(() => {
      result.current.upsertDocument({
        id: 'n1',
        type: 'passport',
        title: 'Soon passport',
        holderName: 'Sam',
        documentNumberLast4: '9999',
        issuingCountry: 'US',
        issueDate: '2020-01-01',
        expiryDate: '2026-07-25',
        notes: '',
        attachmentName: '',
        attachmentMimeType: '',
        storagePath: '',
      });
    });
    expect(result.current.notifications.some((item) => item.kind === 'document-expiry')).toBe(true);
    expect(result.current.commandCentre.tripCount).toBeGreaterThan(0);
  });

  it('supports collaboration invitation lifecycle actions', () => {
    const { result } = renderHook(() => useTripStore());
    act(() => {
      result.current.inviteCollaborator({ name: 'Riley', email: 'riley@example.com', role: 'viewer' });
    });
    const member = result.current.activeVaultTrip.collaboration.members.find((entry) => entry.name === 'Riley');
    expect(member?.status).toBe('pending');
    act(() => {
      result.current.applyCollaboratorInvitationAction(member!.id, 'accept');
    });
    expect(
      result.current.activeVaultTrip.collaboration.members.find((entry) => entry.id === member!.id)?.status,
    ).toBe('accepted');
  });
});

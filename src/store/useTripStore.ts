import { useEffect, useMemo, useRef, useState } from 'react';
import {
  average,
  calculateIntegrityHealthScoreFromCounts,
  classifySimulationAccuracy,
  classifyTrendDirection,
  getRunSeverityWeight,
  getTrendWindowRuns,
  roundToTwo,
} from './integrityCalculations';
import {
  appendActivity,
  cloneTrip,
  createDefaultPackingList,
  createEmptyTrip,
  createSeededTrip,
  DEFAULT_PACKING_TEMPLATES,
  isLegacyTripShape,
  migrateTrip,
  sanitizeTrip,
  validateTripSetup,
  type Booking,
  type Expense,
  type PackingItem,
  type PackingList,
  type TripData,
  type TripSetupInput,
  type TripStop,
  type Traveller,
} from './tripDomain';
import {
  aiPlanToStops,
  generateAiTravelPlan,
  type AiPlanMode,
  type AiTravelPlan,
} from '../features/ai-planning/aiPlanning';
import {
  buildTripOverview,
  calculateBudgetSummary,
  calculateItineraryTotalCost,
  calculatePackingProgress,
  detectItineraryConflicts,
  summarizeItineraryByDay,
} from './platformCalculations';
import {
  collectDocumentExpiryReminders,
  filterAndSortVaultTrips,
  filterTemplates,
  searchVault,
  canPerform,
} from './vaultCalculations';
import {
  cloneVaultTrip,
  createVaultTrip,
  getActiveVaultTrip,
  migrateTemplates,
  migrateVaultState,
  syncActiveTripIntoVault,
  templateFromTrip,
  toVaultTrip,
  tripFromTemplate,
  validateVaultImportPayload,
  type CollaborationMember,
  type CollaborationRole,
  type TripDocument,
  type TripTemplate,
  type TripVaultState,
  type VaultFilterKey,
  type VaultSortKey,
  type VaultTrip,
} from './vaultDomain';
import {
  APPLICATION_VERSION,
  BACKUP_VERSION,
  DEFAULT_LOCAL_STORAGE_CAPACITY_BYTES,
  HISTORY_LIMIT,
  INTEGRITY_HISTORY_BASELINE_STORAGE_KEY,
  INTEGRITY_HISTORY_LIMIT,
  INTEGRITY_HISTORY_STORAGE_KEY,
  INTEGRITY_HISTORY_VERSION,
  INTEGRITY_REPAIR_BACKUP_STORAGE_KEY,
  LOCAL_SNAPSHOT_STORAGE_KEY,
  LOCAL_STORAGE_KEY,
  MIN_SUPPORTED_BACKUP_VERSION,
  SNAPSHOT_HISTORY_VERSION,
  SNAPSHOT_LABEL_LIMIT,
  SNAPSHOT_NOTES_LIMIT,
  STORAGE_KEYS,
  TEMPLATE_STORAGE_KEY,
  UNPINNED_SNAPSHOT_LIMIT,
  VAULT_STORAGE_KEY,
} from './storeConstants';
import {
  enterDemoMode,
  loadAuthState,
  persistAuthState,
  setAuthScreen,
  type AuthScreen,
  type AuthShellState,
} from './auth/authShell';
import {
  clearAuthError,
  hydrateAuthFromSession,
  liveForgotPassword,
  liveResetPassword,
  liveSignIn,
  liveSignOut,
  liveSignUp,
} from './auth/liveAuth';
import {
  enqueueChange,
  loadSyncState,
  persistSyncState,
  retryFailedChanges,
  setNetworkState,
  syncQueueSummary,
  type SyncEngineState,
  type SyncEntityType,
} from './sync/syncEngine';
import { runCloudSync } from './sync/cloudSync';
import {
  hydrateVaultFromRepositories,
  persistVaultToRepositories,
  shouldAutoPersistToCloud,
} from './sync/cloudPersistence';
import type { DraftPlan, TripBriefInput } from '../features/trip-brief/models';
import { getTripDurationDays } from '../features/trip-brief/tripBrief.mapper';
import {
  buildNotificationsFromTrips,
  dismissNotification as applyDismissNotification,
  loadNotificationState,
  markAllNotificationsRead as applyMarkAllNotificationsRead,
  markNotificationRead as applyMarkNotificationRead,
  persistNotificationState,
  unreadNotificationCount,
  visibleNotifications,
  type NotificationCentreState,
} from './notifications/notificationCentre';
import { buildCommandCentre } from './commandCentre/commandCentre';
import {
  SUPABASE_ADAPTER_PLAN,
  createLocalDataRepositories,
  createSupabaseDataRepositories,
  migrateLocalVaultToCloud,
} from './repositories';
import {
  applyInvitationAction,
  assertCanEdit,
  assertCanManageMembers,
  type InvitationAction,
} from './collaboration/collaborationLifecycle';
import { applyCloudInvitationAction, persistInvitationToCloud } from './collaboration/cloudCollaboration';
import {
  createSignedDocumentUrl,
  deleteTravelDocumentFile,
  uploadTravelDocument,
  validateDocumentFile,
} from './documents/secureStorage';
import {
  evaluateAccountDeletion,
  requestAccountDeletion,
  exportAccountDataBundle,
  loadAccountSettings,
  persistAccountSettings,
  syncAccountSettingsToCloud,
  updateAccountSettings,
  type AccountSettings,
} from './settings/accountSettings';
import { getCloudRuntimeStatus, getSupabaseClient, isSupabaseConfigured } from '../lib/supabase/client';
import { SUPABASE_TARGET_VERIFICATION } from '../lib/supabase/env';
import {
  DEFAULT_CHECKLIST_TEMPLATES,
  applyChecklistTemplate,
  createLostLuggageWorkflow,
  createLostPassportWorkflow,
  exportJournalSummary,
  sanitizeChecklistItem,
  sanitizeDailyRoute,
  sanitizeDestination,
  sanitizeEmergencyCentre,
  sanitizeFlight,
  sanitizeGroundTransport,
  sanitizeJournalEntry,
  sanitizeSavedPlace,
  sanitizeStay,
  type AccommodationStay,
  type ChecklistItem,
  type DailyRoute,
  type DestinationProfile,
  type EmergencyCentre,
  type FlightSegment,
  type GroundTransport,
  type JournalEntry,
  type SavedPlace,
} from './travelOpsDomain';
import { buildSmartAssistance } from './smartAssistance';
import {
  completeOnboardingStep as applyCompleteOnboardingStep,
  dismissOnboarding as applyDismissOnboarding,
  loadOnboardingState,
  onboardingProgress as computeOnboardingProgress,
  persistOnboardingState,
  resetOnboarding as createResetOnboardingState,
  type OnboardingState,
  type OnboardingStepId,
} from './onboarding';
import {
  applyPreferenceOverrides,
  createDefaultPreferenceProfile,
  createEmptyDealEngineState,
  createShortlistItem,
  loadDealEngineState,
  migrateDealEngineState,
  persistDealEngineState,
  type DealEngineState,
  type ScoringWeights,
  type ShortlistItem,
  type TravellerPreferenceProfile,
  type UniversalOffer,
} from '../deal-engine';
import {
  applyNetworkChange,
  attachConflictSummaries,
  auditTripHealth,
  loadFinalisationState,
  persistFinalisationState,
  selectedImportEntities,
  setFeatureFlag,
  trackEvent,
  type AnalyticsEventName,
  type FeatureFlagId,
  type FinalisationState,
  type ImportReviewDraft,
} from '../finalisation';

export type {
  Booking,
  Expense,
  PackingItem,
  PackingList,
  TripData,
  TripSetupInput,
  TripStop,
  Traveller,
} from './tripDomain';
export { validateTripSetup } from './tripDomain';
export {
  buildTripOverview,
  calculateBudgetSummary,
  calculatePackingProgress,
  detectItineraryConflicts,
  summarizeItineraryByDay,
} from './platformCalculations';

type TripBackup = {
  schema: 'travel-buddy-backup';
  backupVersion: number;
  applicationVersion: string;
  exportedAt: string;
  tripTitle: string;
  trip: TripData;
  vault?: TripVaultState;
  templates?: TripTemplate[];
  dealEngine?: DealEngineState;
};

type LegacyTripBackup = {
  schema: 'travel-buddy-backup-v1';
  exportedAt: string;
  trip: TripData;
};

type HistoryState = {
  past: TripData[];
  present: TripData;
  future: TripData[];
};

export type ImportPreview = {
  backupVersion: string;
  applicationVersion: string;
  exportedAt: string;
  tripTitle: string;
  itineraryItemCount: number;
  linkedRecordCount: number | null;
};

export type BackupSnapshot = {
  id: string;
  createdAt: string;
  tripTitle: string;
  itineraryItemCount: number;
  backupVersion: number;
  applicationVersion: string;
  linkedRecordCount: number | null;
  pinned: boolean;
  label: string;
  notes: string;
  trip: TripData;
};

export type SnapshotHistoryImportPreview = {
  historyVersion: number;
  applicationVersion: string;
  exportedAt: string;
  totalSnapshotCount: number;
};

export type SnapshotCleanupMode = 'all-unpinned' | 'older-than-7' | 'older-than-30' | 'older-than-90';

type PersistenceErrorTarget = 'active-trip' | 'snapshot-history';

export type PersistenceErrorInfo = {
  target: PersistenceErrorTarget;
  message: string;
  occurredAt: string;
};

export type StorageHealthSummary = {
  activeTripStorageStatus: 'healthy' | 'error';
  snapshotHistoryStorageStatus: 'healthy' | 'error';
  totalSnapshotCount: number;
  pinnedSnapshotCount: number;
  unpinnedSnapshotCount: number;
  estimatedStoredBytes: number;
  lastSuccessfulPersistenceAt: string | null;
  mostRecentPersistenceError: PersistenceErrorInfo | null;
  activeTripPersistenceError: PersistenceErrorInfo | null;
  snapshotHistoryPersistenceError: PersistenceErrorInfo | null;
};

type StorageParseStatus = 'valid' | 'missing' | 'corrupted';
type StorageTarget = 'active-trip' | 'snapshot-history';

export type StorageCorruptionState = {
  target: StorageTarget;
  parseStatus: 'corrupted';
  message: string;
  rawPayloadAvailable: boolean;
  detectedAt: string;
};

export type StorageDiagnosticsSummary = {
  applicationVersion: string;
  backupVersion: number;
  snapshotHistoryVersion: number;
  activeTripStorageKey: string;
  snapshotHistoryStorageKey: string;
  activeTripRawPayloadSize: number;
  snapshotHistoryRawPayloadSize: number;
  totalEstimatedStoredSize: number;
  activeTripParseStatus: StorageParseStatus;
  snapshotHistoryParseStatus: StorageParseStatus;
  lastSuccessfulPersistenceAt: string | null;
  latestActiveTripPersistenceError: PersistenceErrorInfo | null;
  latestSnapshotHistoryPersistenceError: PersistenceErrorInfo | null;
  totalSnapshotCount: number;
  pinnedSnapshotCount: number;
  unpinnedSnapshotCount: number;
  browserTimestamp: string;
};

export type IntegrityIssueSeverity = 'warning' | 'repairable-error' | 'blocking-error';
export type IntegrityIssueTarget = 'active-trip' | 'snapshot-history';

export type IntegrityIssue = {
  id: string;
  target: IntegrityIssueTarget;
  issueType: string;
  severity: IntegrityIssueSeverity;
  affectedRecord: string;
  description: string;
  proposedRepair: string;
  automaticRepairAvailable: boolean;
};

export type IntegrityAuditReport = {
  generatedAt: string;
  applicationVersion: string;
  backupVersion: number;
  snapshotHistoryVersion: number;
  issueCount: number;
  warningCount: number;
  repairableErrorCount: number;
  blockingErrorCount: number;
  repairableIssueIds: string[];
  issues: IntegrityIssue[];
};

export type IntegrityAuditRunType = 'manual-audit' | 'before-repair' | 'after-repair';

export type IntegrityAuditRun = {
  id: string;
  generatedAt: string;
  applicationVersion: string;
  backupVersion: number;
  snapshotHistoryVersion: number;
  totalIssueCount: number;
  warningCount: number;
  repairableErrorCount: number;
  blockingErrorCount: number;
  repairableIssueCount: number;
  unresolvedIssueCount: number;
  activeTripIssueCount: number;
  snapshotHistoryIssueCount: number;
  durationMs: number;
  issueFingerprints: string[];
  runType: IntegrityAuditRunType;
};

export type IntegrityHistoryChangeSummary = {
  baselineRunId: string;
  latestRunId: string;
  totalIssueDelta: number;
  warningDelta: number;
  repairableErrorDelta: number;
  blockingErrorDelta: number;
  activeTripIssueDelta: number;
  snapshotHistoryIssueDelta: number;
  newlyIntroducedFingerprints: string[];
  resolvedFingerprints: string[];
  unchangedFingerprints: string[];
  result: 'Improved' | 'Unchanged' | 'Regressed';
};

export type IntegrityHistoryImportPreview = {
  historyVersion: number;
  exportedAt: string;
  totalRunCount: number;
  importedRunCount: number;
  baselineRunId: string | null;
};

export type IntegrityTrendDirection = 'Improving' | 'Stable' | 'Deteriorating';

export type IntegrityTrendWindow = 'latest-5' | 'latest-10' | 'all-retained';

export type IntegrityTrendSummary = {
  window: IntegrityTrendWindow;
  sampleSize: number;
  direction: IntegrityTrendDirection;
  averageIssueCount: number;
  averageBlockingErrorCount: number;
  averageRepairableErrorCount: number;
  averageWarningCount: number;
};

export type IntegrityAuditStatistics = {
  totalAuditRuns: number;
  firstAuditAt: string | null;
  latestAuditAt: string | null;
  averageDurationMs: number;
  fastestDurationMs: number;
  slowestDurationMs: number;
  averageIssueCount: number;
  highestIssueCount: number;
  lowestIssueCount: number;
};

export type IntegritySeverityTotals = {
  warningCount: number;
  repairableErrorCount: number;
  blockingErrorCount: number;
};

export type IntegrityStreakSummary = {
  currentImprovementStreak: number;
  longestImprovementStreak: number;
  currentRegressionStreak: number;
  currentStableStreak: number;
};

export type IntegrityStorageWarningLevel = 'Informational' | 'Warning' | 'Critical';

export type IntegrityStorageUsageSummary = {
  totalUsedBytes: number;
  estimatedRemainingBytes: number;
  integrityHistoryBytes: number;
  snapshotHistoryBytes: number;
  tripStateBytes: number;
  warningLevel: IntegrityStorageWarningLevel;
};

export type IntegrityHistoryValidationSummary = {
  duplicateRunIds: string[];
  malformedRunCount: number;
  invalidTimestampRunIds: string[];
  malformedFingerprintRunIds: string[];
  invalidBaselineReference: boolean;
  unsupportedVersion: boolean;
  missingMetadata: boolean;
  status: 'Healthy' | 'Attention Required' | 'Critical';
};

export type IntegrityHistoryCompactionPreview = {
  duplicateRunsRemoved: number;
  malformedRunsRemoved: number;
  invalidTimestampRunsRemoved: number;
  malformedFingerprintRunsRemoved: number;
  runsTrimmedByRetention: number;
  baselineCleared: boolean;
  resultingRunCount: number;
  resultingBaselineRunId: string | null;
};

export type IntegrityRepairImpactSummary = {
  selectedRepairCount: number;
  unresolvedSelectedIssueCount: number;
  estimatedIssuesResolved: number;
  estimatedIssuesRemaining: number;
  estimatedWarningsRemaining: number;
  estimatedRepairableErrorsRemaining: number;
  estimatedBlockingErrorsRemaining: number;
  activeTripRecordsAffected: number;
  snapshotHistoryRecordsAffected: number;
  nonRepairableIssuesRemaining: number;
  expectedHealthScoreBefore: number;
  expectedHealthScoreAfter: number;
  expectedHealthScoreDelta: number;
};

export type IntegrityRepairSimulationSummary = {
  selectedRepairIssueIds: string[];
  issueTotalsBefore: number;
  issueTotalsAfter: number;
  warningCountBefore: number;
  warningCountAfter: number;
  repairableErrorCountBefore: number;
  repairableErrorCountAfter: number;
  blockingErrorCountBefore: number;
  blockingErrorCountAfter: number;
  introducedFingerprints: string[];
  resolvedFingerprints: string[];
  unchangedFingerprints: string[];
  unresolvedFingerprints: string[];
  expectedHealthScoreBefore: number;
  expectedHealthScoreAfter: number;
  expectedHealthScoreDelta: number;
  expectedLatestVsBaselineResult: 'Improved' | 'Unchanged' | 'Regressed';
  simulationDurationMs: number;
};

export type IntegritySimulationAccuracySummary = {
  predictedIssueTotal: number;
  actualIssueTotal: number;
  predictedWarningCount: number;
  actualWarningCount: number;
  predictedRepairableErrorCount: number;
  actualRepairableErrorCount: number;
  predictedBlockingErrorCount: number;
  actualBlockingErrorCount: number;
  predictedResolvedFingerprintCount: number;
  actualResolvedFingerprintCount: number;
  status: 'Exact Match' | 'Partial Match' | 'Diverged';
};

export type IntegrityRuntimeMetricName =
  | 'integrity-audit'
  | 'history-comparison'
  | 'analytics-calculation'
  | 'storage-validation'
  | 'compaction-preview'
  | 'repair-impact-analysis'
  | 'repair-simulation'
  | 'diagnostics-run'
  | 'integrity-report-generation';

export type IntegrityRuntimeMetricStats = {
  latestDurationMs: number;
  fastestDurationMs: number;
  slowestDurationMs: number;
  averageDurationMs: number;
  sampleCount: number;
};

export type IntegrityDiagnosticsCategoryStatus = 'Pass' | 'Warning' | 'Fail';

export type IntegrityDiagnosticsCategoryResult = {
  status: IntegrityDiagnosticsCategoryStatus;
  findings: string[];
};

export type IntegrityDiagnosticsSummary = {
  overallStatus: 'Healthy' | 'Attention Required' | 'Critical';
  auditHistoryConsistency: IntegrityDiagnosticsCategoryResult;
  baselineConsistency: IntegrityDiagnosticsCategoryResult;
  fingerprintConsistency: IntegrityDiagnosticsCategoryResult;
  analyticsConsistency: IntegrityDiagnosticsCategoryResult;
  storageConsistency: IntegrityDiagnosticsCategoryResult;
  runtimeTimings: Partial<Record<IntegrityRuntimeMetricName, IntegrityRuntimeMetricStats>>;
  recommendedManualActions: string[];
  generatedAt: string;
};

export type IntegrityOverviewSummary = {
  currentHealthScore: number;
  healthSummary: string;
  latestAuditTimestamp: string | null;
  latestRunType: IntegrityAuditRunType | null;
  selectedBaselineRunId: string | null;
  latestVsBaselineResult: 'Improved' | 'Unchanged' | 'Regressed' | null;
  unresolvedIssueCount: number;
  blockingIssueCount: number;
  repairableIssueCount: number;
  storageWarning: IntegrityStorageWarningLevel;
  historyValidationStatus: IntegrityHistoryValidationSummary['status'];
  diagnosticsStatus: IntegrityDiagnosticsSummary['overallStatus'] | 'Not Run';
};

type SnapshotHistoryBackup = {
  schema: 'travel-buddy-snapshot-history';
  snapshotHistoryVersion: number;
  applicationVersion: string;
  exportedAt: string;
  totalSnapshotCount: number;
  snapshots: BackupSnapshot[];
};

type IntegrityHistoryBackup = {
  schema: 'travel-buddy-integrity-history';
  integrityHistoryVersion: number;
  exportedAt: string;
  selectedBaselineRunId: string | null;
  runs: IntegrityAuditRun[];
};

const bytesInString = (value: string): number => {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(value).length;
  }
  return value.length;
};

const getPersistenceErrorMessage = (error: unknown, target: PersistenceErrorTarget): string => {
  const targetLabel = target === 'active-trip' ? 'active trip' : 'snapshot history';
  if (error instanceof DOMException && error.name === 'QuotaExceededError') {
    return `Local storage quota exceeded while saving ${targetLabel}.`;
  }
  if (error instanceof Error && error.message.trim().length > 0) {
    return `Failed to save ${targetLabel}: ${error.message}`;
  }
  return `Failed to save ${targetLabel} to local storage.`;
};

const createCorruptionState = (
  target: StorageTarget,
  message: string,
  rawPayloadAvailable: boolean,
): StorageCorruptionState => ({
  target,
  parseStatus: 'corrupted',
  message,
  rawPayloadAvailable,
  detectedAt: new Date().toISOString(),
});

const seededTrip: TripData = createSeededTrip();

const isTripData = (value: unknown): value is TripData => isLegacyTripShape(value);

type ParsedActiveTripStorage = {
  trip: TripData;
  parseStatus: StorageParseStatus;
  corruption: StorageCorruptionState | null;
  rawPayloadSize: number;
};

const isBackupSnapshot = (value: unknown): value is BackupSnapshot => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const snapshot = value as Partial<BackupSnapshot>;
  return (
    typeof snapshot.id === 'string' &&
    typeof snapshot.createdAt === 'string' &&
    typeof snapshot.tripTitle === 'string' &&
    typeof snapshot.itineraryItemCount === 'number' &&
    typeof snapshot.backupVersion === 'number' &&
    typeof snapshot.applicationVersion === 'string' &&
    (typeof snapshot.linkedRecordCount === 'number' || snapshot.linkedRecordCount === null || snapshot.linkedRecordCount === undefined) &&
    (typeof snapshot.pinned === 'boolean' || snapshot.pinned === undefined) &&
    (typeof snapshot.label === 'string' || snapshot.label === undefined) &&
    (typeof snapshot.notes === 'string' || snapshot.notes === undefined) &&
    isTripData(snapshot.trip)
  );
};

const normalizeSnapshot = (value: unknown): BackupSnapshot | null => {
  if (!isBackupSnapshot(value)) {
    return null;
  }
  const snapshot = value as BackupSnapshot;
  return {
    ...snapshot,
    linkedRecordCount: typeof snapshot.linkedRecordCount === 'number' ? snapshot.linkedRecordCount : null,
    pinned: snapshot.pinned === true,
    label: typeof snapshot.label === 'string' ? snapshot.label.slice(0, SNAPSHOT_LABEL_LIMIT) : '',
    notes: typeof snapshot.notes === 'string' ? snapshot.notes.slice(0, SNAPSHOT_NOTES_LIMIT) : '',
    trip: sanitizeTrip(snapshot.trip),
  };
};

const applySnapshotRetention = (snapshots: BackupSnapshot[]): BackupSnapshot[] => {
  let keptUnpinned = 0;
  return snapshots.filter((snapshot) => {
    if (snapshot.pinned) {
      return true;
    }
    if (keptUnpinned >= UNPINNED_SNAPSHOT_LIMIT) {
      return false;
    }
    keptUnpinned += 1;
    return true;
  });
};

const isSnapshotOlderThanDays = (snapshot: BackupSnapshot, days: number): boolean => {
  const createdAt = new Date(snapshot.createdAt);
  if (Number.isNaN(createdAt.getTime())) {
    return false;
  }
  return Date.now() - createdAt.getTime() > days * 24 * 60 * 60 * 1000;
};

const getSnapshotsMatchingCleanup = (snapshots: BackupSnapshot[], mode: SnapshotCleanupMode): BackupSnapshot[] => {
  if (mode === 'all-unpinned') {
    return snapshots.filter((snapshot) => !snapshot.pinned);
  }
  const dayLimit = mode === 'older-than-7' ? 7 : mode === 'older-than-30' ? 30 : 90;
  return snapshots.filter((snapshot) => !snapshot.pinned && isSnapshotOlderThanDays(snapshot, dayLimit));
};

type ParsedSnapshotStorage = {
  snapshots: BackupSnapshot[];
  parseStatus: StorageParseStatus;
  corruption: StorageCorruptionState | null;
  rawPayloadSize: number;
};

const parsePersistedTripStorage = (rawValue: string | null): ParsedActiveTripStorage => {
  if (rawValue === null) {
    return {
      trip: cloneTrip(seededTrip),
      parseStatus: 'missing',
      corruption: null,
      rawPayloadSize: 0,
    };
  }

  const rawPayloadSize = bytesInString(rawValue);
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawValue);
  } catch {
    return {
      trip: cloneTrip(seededTrip),
      parseStatus: 'corrupted',
      corruption: createCorruptionState('active-trip', 'Active trip storage contains malformed JSON.', true),
      rawPayloadSize,
    };
  }

  if (isTripData(parsed)) {
    return {
      trip: sanitizeTrip(parsed),
      parseStatus: 'valid',
      corruption: null,
      rawPayloadSize,
    };
  }

  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && 'schema' in (parsed as Record<string, unknown>)) {
    return {
      trip: cloneTrip(seededTrip),
      parseStatus: 'corrupted',
      corruption: createCorruptionState(
        'active-trip',
        'Active trip storage has unsupported schema/version for trip-state key.',
        true,
      ),
      rawPayloadSize,
    };
  }

  return {
    trip: cloneTrip(seededTrip),
    parseStatus: 'corrupted',
    corruption: createCorruptionState(
      'active-trip',
      'Active trip storage is structurally invalid or missing required fields.',
      true,
    ),
    rawPayloadSize,
  };
};

const parsePersistedSnapshotStorage = (rawValue: string | null): ParsedSnapshotStorage => {
  if (rawValue === null) {
    return {
      snapshots: [],
      parseStatus: 'missing',
      corruption: null,
      rawPayloadSize: 0,
    };
  }

  const rawPayloadSize = bytesInString(rawValue);
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawValue);
  } catch {
    return {
      snapshots: [],
      parseStatus: 'corrupted',
      corruption: createCorruptionState('snapshot-history', 'Snapshot history storage contains malformed JSON.', true),
      rawPayloadSize,
    };
  }

  if (!Array.isArray(parsed)) {
    if (parsed && typeof parsed === 'object' && 'schema' in (parsed as Record<string, unknown>)) {
      return {
        snapshots: [],
        parseStatus: 'corrupted',
        corruption: createCorruptionState(
          'snapshot-history',
          'Snapshot history storage has unsupported schema/version for snapshots key.',
          true,
        ),
        rawPayloadSize,
      };
    }
    return {
      snapshots: [],
      parseStatus: 'corrupted',
      corruption: createCorruptionState(
        'snapshot-history',
        'Snapshot history storage is structurally invalid or missing required fields.',
        true,
      ),
      rawPayloadSize,
    };
  }

  const normalizedSnapshots = parsed.map(normalizeSnapshot);
  if (normalizedSnapshots.some((snapshot) => snapshot === null)) {
    return {
      snapshots: [],
      parseStatus: 'corrupted',
      corruption: createCorruptionState(
        'snapshot-history',
        'Snapshot history storage contains unreadable or unsupported snapshot entries.',
        true,
      ),
      rawPayloadSize,
    };
  }

  return {
    snapshots: applySnapshotRetention(normalizedSnapshots as BackupSnapshot[]),
    parseStatus: 'valid',
    corruption: null,
    rawPayloadSize,
  };
};

const dedupe = (items: string[]): string[] => Array.from(new Set(items));

const buildSearchIndex = (trip: TripData): Map<string, string[]> => {
  const index = new Map<string, string[]>();
  for (const stop of trip.stops) {
    const tokens = `${stop.title} ${stop.notes} ${stop.location} ${stop.category} ${stop.bookingReference}`
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean);
    for (const token of dedupe(tokens)) {
      const existing = index.get(token) ?? [];
      index.set(token, dedupe([...existing, stop.id]));
    }
  }
  return index;
};

const updateHistory = (history: HistoryState, next: TripData): HistoryState => ({
  past: [...history.past, history.present].slice(-HISTORY_LIMIT),
  present: next,
  future: [],
});

const sortStops = (stops: TripStop[]): TripStop[] =>
  [...stops].sort((a, b) => {
    if (a.day !== b.day) {
      return a.day - b.day;
    }
    return a.order - b.order;
  });

const assertRecord = (value: unknown, message: string): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(message);
  }
  return value as Record<string, unknown>;
};

const ensureString = (value: unknown, message: string): string => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(message);
  }
  return value;
};

const ensureNumber = (value: unknown, message: string): number => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(message);
  }
  return value;
};

const countLinkedRecords = (root: Record<string, unknown>): number | null => {
  const possibleCounts: number[] = [];
  const sources: unknown[] = [
    root.vaultRecords,
    root.docRecords,
    root.documents,
    root.linkedRecords,
    root.vault,
    (root.trip as Record<string, unknown> | undefined)?.vaultRecords,
    (root.trip as Record<string, unknown> | undefined)?.docRecords,
    (root.trip as Record<string, unknown> | undefined)?.documents,
    (root.trip as Record<string, unknown> | undefined)?.linkedRecords,
    (root.trip as Record<string, unknown> | undefined)?.vault,
  ];

  for (const source of sources) {
    if (Array.isArray(source)) {
      possibleCounts.push(source.length);
      continue;
    }
    if (source && typeof source === 'object') {
      possibleCounts.push(Object.keys(source).length);
    }
  }

  if (possibleCounts.length === 0) {
    return null;
  }
  return Math.max(...possibleCounts);
};

const parseTripBackupPreview = (
  rawValue: string,
): { trip: TripData; preview: ImportPreview; dealEngine?: DealEngineState } => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawValue);
  } catch {
    throw new Error('Backup file is not valid JSON.');
  }

  const parsedObject = assertRecord(parsed, 'Backup file must contain an object.');

  if ('schema' in parsedObject && parsedObject.schema === 'travel-buddy-vault-backup') {
    const validated = validateVaultImportPayload(parsedObject);
    if (!validated.ok) {
      throw new Error(validated.message);
    }
    const trip = getActiveVaultTrip(validated.vault);
    return {
      trip,
      preview: {
        backupVersion: 'vault-v1',
        applicationVersion:
          typeof parsedObject.applicationVersion === 'string' ? parsedObject.applicationVersion : 'Not provided',
        exportedAt: typeof parsedObject.exportedAt === 'string' ? parsedObject.exportedAt : 'Not provided',
        tripTitle: `${trip.tripName} (+${Math.max(0, validated.vault.trips.length - 1)} more)`,
        itineraryItemCount: validated.vault.trips.reduce((sum, entry) => sum + entry.stops.length, 0),
        linkedRecordCount: validated.vault.trips.reduce(
          (sum, entry) => sum + entry.documents.length + entry.bookings.length,
          0,
        ),
      },
    };
  }

  if ('schema' in parsedObject && parsedObject.schema === 'travel-buddy-backup-v1') {
    const legacyBackup = parsedObject as Partial<LegacyTripBackup>;
    if (!isTripData(legacyBackup.trip)) {
      throw new Error('Legacy backup is missing trip data.');
    }
    const trip = sanitizeTrip(legacyBackup.trip);
    return {
      trip,
      preview: {
        backupVersion: 'legacy-v1',
        applicationVersion: 'Not provided',
        exportedAt: typeof legacyBackup.exportedAt === 'string' ? legacyBackup.exportedAt : 'Not provided',
        tripTitle: trip.tripName,
        itineraryItemCount: trip.stops.length,
        linkedRecordCount: countLinkedRecords(parsedObject),
      },
    };
  }

  if (!('schema' in parsedObject)) {
    if (isTripData(parsedObject)) {
      const trip = sanitizeTrip(parsedObject);
      return {
        trip,
        preview: {
          backupVersion: 'plain-trip-data',
          applicationVersion: 'Not provided',
          exportedAt: 'Not provided',
          tripTitle: trip.tripName,
          itineraryItemCount: trip.stops.length,
          linkedRecordCount: countLinkedRecords(parsedObject),
        },
      };
    }
    throw new Error('Backup is missing required schema metadata.');
  }

  if (parsedObject.schema !== 'travel-buddy-backup') {
    throw new Error('Backup schema is unsupported.');
  }

  const backupVersion = ensureNumber(parsedObject.backupVersion, 'Backup version is missing or invalid.');
  if (!Number.isInteger(backupVersion)) {
    throw new Error('Backup version must be an integer.');
  }
  if (backupVersion < MIN_SUPPORTED_BACKUP_VERSION || backupVersion > BACKUP_VERSION) {
    throw new Error(`Backup version ${backupVersion} is not supported by this app.`);
  }

  const applicationVersion = ensureString(parsedObject.applicationVersion, 'Application version is missing from backup.');
  const exportedAt = ensureString(parsedObject.exportedAt, 'Export timestamp is missing from backup.');
  const tripTitle = ensureString(parsedObject.tripTitle, 'Trip title is missing from backup.');

  if (!isTripData(parsedObject.trip)) {
    throw new Error('Trip data structure is malformed or missing required fields.');
  }

  const trip = sanitizeTrip(migrateTrip(parsedObject.trip));
  const dealEngine =
    parsedObject.dealEngine != null ? migrateDealEngineState(parsedObject.dealEngine) : undefined;
  return {
    trip,
    preview: {
      backupVersion: String(backupVersion),
      applicationVersion,
      exportedAt,
      tripTitle,
      itineraryItemCount: trip.stops.length,
      linkedRecordCount: countLinkedRecords(parsedObject),
    },
    dealEngine,
  };
};

const parseTripBackup = (rawValue: string): TripData => parseTripBackupPreview(rawValue).trip;

const parseSnapshotHistoryBackup = (
  rawValue: string,
): { preview: SnapshotHistoryImportPreview; snapshots: BackupSnapshot[] } => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawValue);
  } catch {
    throw new Error('Snapshot history file is not valid JSON.');
  }

  const parsedObject = assertRecord(parsed, 'Snapshot history file must contain an object.');
  if (parsedObject.schema !== 'travel-buddy-snapshot-history') {
    throw new Error('Snapshot history schema is unsupported.');
  }

  const historyVersion = ensureNumber(parsedObject.snapshotHistoryVersion, 'Snapshot history version is missing or invalid.');
  if (!Number.isInteger(historyVersion)) {
    throw new Error('Snapshot history version must be an integer.');
  }
  if (historyVersion !== SNAPSHOT_HISTORY_VERSION) {
    throw new Error(`Snapshot history version ${historyVersion} is not supported by this app.`);
  }

  const applicationVersion = ensureString(parsedObject.applicationVersion, 'Application version is missing from snapshot history.');
  const exportedAt = ensureString(parsedObject.exportedAt, 'Export timestamp is missing from snapshot history.');
  const totalSnapshotCount = ensureNumber(parsedObject.totalSnapshotCount, 'Total snapshot count is missing or invalid.');
  if (!Number.isInteger(totalSnapshotCount) || totalSnapshotCount < 0) {
    throw new Error('Total snapshot count must be a non-negative integer.');
  }

  if (!Array.isArray(parsedObject.snapshots)) {
    throw new Error('Snapshot history payload is missing snapshots array.');
  }

  const normalizedSnapshots = parsedObject.snapshots
    .map(normalizeSnapshot)
    .filter((snapshot): snapshot is BackupSnapshot => snapshot !== null);

  return {
    preview: {
      historyVersion,
      applicationVersion,
      exportedAt,
      totalSnapshotCount,
    },
    snapshots: applySnapshotRetention(normalizedSnapshots),
  };
};

const tripSignature = (trip: TripData): string => JSON.stringify(sanitizeTrip(trip));

const makeSnapshot = (trip: TripData, linkedRecordCount: number | null = null): BackupSnapshot => {
  const sanitizedTrip = sanitizeTrip(trip);
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    tripTitle: sanitizedTrip.tripName,
    itineraryItemCount: sanitizedTrip.stops.length,
    backupVersion: BACKUP_VERSION,
    applicationVersion: APPLICATION_VERSION,
    linkedRecordCount,
    pinned: false,
    label: '',
    notes: '',
    trip: sanitizedTrip,
  };
};

const formatBackupTimestamp = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}-${hours}${minutes}`;
};

const formatSnapshotHistoryTimestamp = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}-${hours}${minutes}`;
};

const formatDiagnosticsTimestamp = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}-${hours}${minutes}`;
};

const safeReadStorageValue = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const buildIntegrityIssueFingerprint = (issue: IntegrityIssue): string =>
  `${issue.target}|${issue.issueType}|${issue.affectedRecord}|${issue.severity}`;

const trimIntegrityHistoryRuns = (runs: IntegrityAuditRun[]): IntegrityAuditRun[] =>
  runs.slice(0, INTEGRITY_HISTORY_LIMIT);

const sortIntegrityHistoryRuns = (runs: IntegrityAuditRun[]): IntegrityAuditRun[] =>
  [...runs].sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());

const isIntegrityAuditRun = (value: unknown): value is IntegrityAuditRun => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const run = value as Partial<IntegrityAuditRun>;
  return (
    typeof run.id === 'string' &&
    typeof run.generatedAt === 'string' &&
    typeof run.applicationVersion === 'string' &&
    typeof run.backupVersion === 'number' &&
    typeof run.snapshotHistoryVersion === 'number' &&
    typeof run.totalIssueCount === 'number' &&
    typeof run.warningCount === 'number' &&
    typeof run.repairableErrorCount === 'number' &&
    typeof run.blockingErrorCount === 'number' &&
    typeof run.repairableIssueCount === 'number' &&
    typeof run.unresolvedIssueCount === 'number' &&
    typeof run.activeTripIssueCount === 'number' &&
    typeof run.snapshotHistoryIssueCount === 'number' &&
    typeof run.durationMs === 'number' &&
    Array.isArray(run.issueFingerprints) &&
    run.issueFingerprints.every((entry) => typeof entry === 'string') &&
    (run.runType === 'manual-audit' || run.runType === 'before-repair' || run.runType === 'after-repair')
  );
};

type IntegrityHistoryHydrationResult = {
  runs: IntegrityAuditRun[];
  parseStatus: 'valid' | 'missing' | 'corrupted';
};

const parsePersistedIntegrityHistoryRuns = (rawValue: string | null): IntegrityHistoryHydrationResult => {
  if (!rawValue) {
    return { runs: [], parseStatus: 'missing' };
  }
  try {
    const parsed: unknown = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return { runs: [], parseStatus: 'corrupted' };
    }
    const validRuns = parsed.filter(isIntegrityAuditRun);
    if (validRuns.length !== parsed.length) {
      return { runs: [], parseStatus: 'corrupted' };
    }
    return {
      runs: trimIntegrityHistoryRuns(sortIntegrityHistoryRuns(validRuns)),
      parseStatus: 'valid',
    };
  } catch {
    return { runs: [], parseStatus: 'corrupted' };
  }
};

const parsePersistedIntegrityBaselineId = (rawValue: string | null, runs: IntegrityAuditRun[]): string | null => {
  if (!rawValue) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(rawValue);
    if (typeof parsed !== 'string') {
      return null;
    }
    return runs.some((run) => run.id === parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const classifyIntegrityHistoryChange = (delta: {
  totalIssueDelta: number;
  warningDelta: number;
  repairableErrorDelta: number;
  blockingErrorDelta: number;
}): 'Improved' | 'Unchanged' | 'Regressed' => {
  if (
    delta.totalIssueDelta === 0 &&
    delta.warningDelta === 0 &&
    delta.repairableErrorDelta === 0 &&
    delta.blockingErrorDelta === 0
  ) {
    return 'Unchanged';
  }
  const weighted =
    delta.blockingErrorDelta * 5 +
    delta.repairableErrorDelta * 3 +
    delta.warningDelta * 2 +
    delta.totalIssueDelta;
  if (weighted > 0) {
    return 'Regressed';
  }
  if (weighted < 0) {
    return 'Improved';
  }
  return 'Unchanged';
};

const isValidTimestamp = (value: string): boolean => !Number.isNaN(new Date(value).getTime());

const isValidIntegrityFingerprint = (value: string): boolean => {
  const [target, issueType, affectedRecord, severity, ...rest] = value.split('|');
  if (rest.length > 0) {
    return false;
  }
  if (target !== 'active-trip' && target !== 'snapshot-history') {
    return false;
  }
  if (typeof issueType !== 'string' || issueType.trim().length === 0) {
    return false;
  }
  if (typeof affectedRecord !== 'string' || affectedRecord.trim().length === 0) {
    return false;
  }
  return severity === 'warning' || severity === 'repairable-error' || severity === 'blocking-error';
};

const createDefaultRuntimeMetricStats = (): IntegrityRuntimeMetricStats => ({
  latestDurationMs: 0,
  fastestDurationMs: 0,
  slowestDurationMs: 0,
  averageDurationMs: 0,
  sampleCount: 0,
});

const isIsoDateLike = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value);

const normalizeDateUnambiguous = (value: string): string | null => {
  const trimmed = value.trim();
  if (isIsoDateLike(trimmed)) {
    return trimmed;
  }
  const asDate = new Date(trimmed);
  if (Number.isNaN(asDate.getTime())) {
    return null;
  }
  return asDate.toISOString().slice(0, 10);
};

const normalizeTimeUnambiguous = (value: string): string | null => {
  const trimmed = value.trim();
  const hhmm = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(trimmed);
  if (hhmm) {
    return `${hhmm[1].padStart(2, '0')}:${hhmm[2]}`;
  }
  return null;
};

const timeToMinutes = (value: string): number | null => {
  const normalized = normalizeTimeUnambiguous(value);
  if (!normalized) {
    return null;
  }
  const [hours, minutes] = normalized.split(':').map((part) => Number(part));
  return hours * 60 + minutes;
};

const readJsonStorage = (key: string): unknown => {
  const raw = safeReadStorageValue(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export function useTripStore() {
  const initialActiveTripStorage = parsePersistedTripStorage(safeReadStorageValue(LOCAL_STORAGE_KEY));
  const initialSnapshotStorage = parsePersistedSnapshotStorage(safeReadStorageValue(LOCAL_SNAPSHOT_STORAGE_KEY));
  const initialIntegrityHistoryHydration = parsePersistedIntegrityHistoryRuns(
    safeReadStorageValue(INTEGRITY_HISTORY_STORAGE_KEY),
  );
  const initialIntegrityBaselineRunId = parsePersistedIntegrityBaselineId(
    safeReadStorageValue(INTEGRITY_HISTORY_BASELINE_STORAGE_KEY),
    initialIntegrityHistoryHydration.runs,
  );
  const initialVault = migrateVaultState(readJsonStorage(VAULT_STORAGE_KEY), initialActiveTripStorage.trip);
  const initialActiveVaultTrip = getActiveVaultTrip(initialVault);
  const [history, setHistory] = useState<HistoryState>(() => ({
    past: [],
    present: initialActiveVaultTrip,
    future: [],
  }));
  const [vault, setVault] = useState<TripVaultState>(() => initialVault);
  const [templates, setTemplates] = useState<TripTemplate[]>(() => migrateTemplates(readJsonStorage(TEMPLATE_STORAGE_KEY)));
  const [vaultQuery, setVaultQuery] = useState('');
  const [vaultFilter, setVaultFilter] = useState<VaultFilterKey>('all');
  const [vaultSort, setVaultSort] = useState<VaultSortKey>('lastOpened');
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [authState, setAuthState] = useState<AuthShellState>(() => {
    const loaded = loadAuthState();
    // Cloud env present: never boot into demo-local (hydrate will refine session next).
    if (isSupabaseConfigured() && loaded.mode === 'demo-local') {
      return {
        ...loaded,
        mode: 'signed-out',
        user: null,
        screen: 'sign-in',
        message: 'Cloud Auth ready. Sign in to sync trips.',
        resetToken: null,
        updatedAt: new Date().toISOString(),
      };
    }
    return loaded;
  });
  const [authProvider, setAuthProvider] = useState<'supabase' | 'local-demo'>(() =>
    isSupabaseConfigured() ? 'supabase' : 'local-demo',
  );
  const [emailVerified, setEmailVerified] = useState<boolean | null>(null);
  const [syncState, setSyncState] = useState<SyncEngineState>(() => loadSyncState());
  const syncStateRef = useRef(syncState);
  syncStateRef.current = syncState;
  const [notificationState, setNotificationState] = useState<NotificationCentreState>(() => loadNotificationState());
  const [accountSettings, setAccountSettings] = useState<AccountSettings>(() => loadAccountSettings());
  const accountSettingsRef = useRef(accountSettings);
  accountSettingsRef.current = accountSettings;
  const [cloudMigrationMessage, setCloudMigrationMessage] = useState<string | null>(null);
  const [cloudPersistMessage, setCloudPersistMessage] = useState<string | null>(null);
  const vaultRef = useRef(vault);
  vaultRef.current = vault;
  const [onboardingState, setOnboardingState] = useState<OnboardingState>(() => loadOnboardingState());
  const [dealEngineState, setDealEngineState] = useState<DealEngineState>(() => loadDealEngineState());
  const [finalisationState, setFinalisationState] = useState<FinalisationState>(() => loadFinalisationState());
  const repositories = useMemo(
    () => (isSupabaseConfigured() ? createSupabaseDataRepositories() : createLocalDataRepositories()),
    [],
  );
  const cloudRuntime = useMemo(() => getCloudRuntimeStatus(), []);
  const [snapshots, setSnapshots] = useState<BackupSnapshot[]>(() => initialSnapshotStorage.snapshots);
  const [activeTripParseStatus, setActiveTripParseStatus] = useState<StorageParseStatus>(initialActiveTripStorage.parseStatus);
  const [snapshotHistoryParseStatus, setSnapshotHistoryParseStatus] = useState<StorageParseStatus>(
    initialSnapshotStorage.parseStatus,
  );
  const [activeTripCorruption, setActiveTripCorruption] = useState<StorageCorruptionState | null>(
    initialActiveTripStorage.corruption,
  );
  const [snapshotHistoryCorruption, setSnapshotHistoryCorruption] = useState<StorageCorruptionState | null>(
    initialSnapshotStorage.corruption,
  );
  const [activeTripRawPayloadSize, setActiveTripRawPayloadSize] = useState<number>(initialActiveTripStorage.rawPayloadSize);
  const [snapshotHistoryRawPayloadSize, setSnapshotHistoryRawPayloadSize] = useState<number>(
    initialSnapshotStorage.rawPayloadSize,
  );
  const [activeTripPersistenceError, setActiveTripPersistenceError] = useState<PersistenceErrorInfo | null>(null);
  const [snapshotHistoryPersistenceError, setSnapshotHistoryPersistenceError] = useState<PersistenceErrorInfo | null>(null);
  const [lastSuccessfulPersistenceAt, setLastSuccessfulPersistenceAt] = useState<string | null>(null);
  const [integrityAuditReport, setIntegrityAuditReport] = useState<IntegrityAuditReport | null>(null);
  const [integrityAuditRuns, setIntegrityAuditRuns] = useState<IntegrityAuditRun[]>(
    initialIntegrityHistoryHydration.runs,
  );
  const [integrityHistoryParseStatus, setIntegrityHistoryParseStatus] = useState<
    IntegrityHistoryHydrationResult['parseStatus']
  >(initialIntegrityHistoryHydration.parseStatus);
  const [selectedIntegrityBaselineRunId, setSelectedIntegrityBaselineRunId] = useState<string | null>(
    initialIntegrityBaselineRunId,
  );
  const [lastIntegrityRepairSimulation, setLastIntegrityRepairSimulation] = useState<IntegrityRepairSimulationSummary | null>(
    null,
  );
  const [lastIntegritySimulationAccuracy, setLastIntegritySimulationAccuracy] =
    useState<IntegritySimulationAccuracySummary | null>(null);
  const [integrityDiagnosticsSummary, setIntegrityDiagnosticsSummary] = useState<IntegrityDiagnosticsSummary | null>(null);
  const [integrityRuntimeMetrics, setIntegrityRuntimeMetrics] = useState<
    Partial<Record<IntegrityRuntimeMetricName, IntegrityRuntimeMetricStats>>
  >({});
  const integrityRepairOperationsRef = useRef<
    Map<string, (context: { activeTripDraft: Record<string, unknown> | null; snapshotDraft: unknown[] | null }) => void>
  >(new Map());

  const recordIntegrityRuntimeMetric = (metric: IntegrityRuntimeMetricName, durationMs: number) => {
    const normalizedDuration = Math.max(0, Math.round(durationMs));
    setIntegrityRuntimeMetrics((currentMetrics) => {
      const current = currentMetrics[metric] ?? createDefaultRuntimeMetricStats();
      const nextSampleCount = current.sampleCount + 1;
      const nextFastest = current.sampleCount === 0 ? normalizedDuration : Math.min(current.fastestDurationMs, normalizedDuration);
      const nextSlowest = current.sampleCount === 0 ? normalizedDuration : Math.max(current.slowestDurationMs, normalizedDuration);
      const nextAverage =
        current.sampleCount === 0
          ? normalizedDuration
          : roundToTwo((current.averageDurationMs * current.sampleCount + normalizedDuration) / nextSampleCount);
      return {
        ...currentMetrics,
        [metric]: {
          latestDurationMs: normalizedDuration,
          fastestDurationMs: nextFastest,
          slowestDurationMs: nextSlowest,
          averageDurationMs: nextAverage,
          sampleCount: nextSampleCount,
        },
      };
    });
  };

  const persistActiveTrip = (trip: TripData): boolean => {
    if (activeTripCorruption) {
      setActiveTripPersistenceError((currentError) =>
        currentError ??
        {
          target: 'active-trip',
          message: 'Cannot persist active trip while active-trip storage is marked as corrupted. Use Diagnostics & Recovery.',
          occurredAt: new Date().toISOString(),
        },
      );
      return false;
    }
    const serializedTrip = JSON.stringify(trip);
    try {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, serializedTrip);
      setActiveTripPersistenceError(null);
      setLastSuccessfulPersistenceAt(new Date().toISOString());
      setActiveTripParseStatus('valid');
      setActiveTripRawPayloadSize(bytesInString(serializedTrip));
      return true;
    } catch (error) {
      setActiveTripPersistenceError({
        target: 'active-trip',
        message: getPersistenceErrorMessage(error, 'active-trip'),
        occurredAt: new Date().toISOString(),
      });
      return false;
    }
  };

  const persistSnapshotHistory = (nextSnapshots: BackupSnapshot[]): boolean => {
    if (snapshotHistoryCorruption) {
      setSnapshotHistoryPersistenceError((currentError) =>
        currentError ??
        {
          target: 'snapshot-history',
          message: 'Cannot persist snapshot history while snapshot storage is marked as corrupted. Use Diagnostics & Recovery.',
          occurredAt: new Date().toISOString(),
        },
      );
      return false;
    }
    const serializedSnapshots = JSON.stringify(nextSnapshots);
    try {
      window.localStorage.setItem(LOCAL_SNAPSHOT_STORAGE_KEY, serializedSnapshots);
      setSnapshotHistoryPersistenceError(null);
      setLastSuccessfulPersistenceAt(new Date().toISOString());
      setSnapshotHistoryParseStatus('valid');
      setSnapshotHistoryRawPayloadSize(bytesInString(serializedSnapshots));
      return true;
    } catch (error) {
      setSnapshotHistoryPersistenceError({
        target: 'snapshot-history',
        message: getPersistenceErrorMessage(error, 'snapshot-history'),
        occurredAt: new Date().toISOString(),
      });
      return false;
    }
  };

  useEffect(() => {
    persistActiveTrip(history.present);
  }, [history.present]);
  useEffect(() => {
    setVault((current) => {
      const next = syncActiveTripIntoVault(current, history.present);
      try {
        window.localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Preserve in-memory vault if quota blocks persistence; diagnostics remain available.
      }
      return next;
    });
  }, [history.present]);
  useEffect(() => {
    try {
      window.localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(templates));
    } catch {
      // Ignore template persistence quota failures; templates remain in memory.
    }
  }, [templates]);
  useEffect(() => {
    persistAuthState(authState);
  }, [authState]);
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let cancelled = false;
    void hydrateAuthFromSession(loadAuthState()).then((result) => {
      if (cancelled) return;
      setAuthState((current) => {
        // Do not clobber a sign-in that completed while getSession was in flight.
        if (current.mode === 'signed-in' && current.user) return current;
        return result.state;
      });
      setAuthProvider((current) => (current === 'supabase' ? current : result.provider));
      setEmailVerified((current) => current ?? result.emailVerified);
    });

    const client = getSupabaseClient();
    const subscription = client?.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === 'SIGNED_OUT' || !session?.user) {
        setAuthState((current) => ({
          ...current,
          mode: 'signed-out',
          user: null,
          screen: 'sign-in',
          message: event === 'SIGNED_OUT' ? 'Signed out.' : current.message,
          updatedAt: new Date().toISOString(),
        }));
        setEmailVerified(null);
        return;
      }
      if (
        event === 'SIGNED_IN' ||
        event === 'TOKEN_REFRESHED' ||
        event === 'USER_UPDATED' ||
        event === 'INITIAL_SESSION'
      ) {
        const user = session.user;
        setAuthProvider('supabase');
        setEmailVerified(Boolean(user.email_confirmed_at));
        setAuthState((current) => ({
          ...current,
          mode: 'signed-in',
          user: {
            id: user.id,
            email: user.email ?? '',
            displayName:
              (user.user_metadata?.display_name as string | undefined)?.trim() ||
              (user.email ? user.email.split('@')[0] : 'Traveller') ||
              'Traveller',
          },
          screen: 'session',
          message:
            event === 'TOKEN_REFRESHED'
              ? 'Session refreshed.'
              : current.message || 'Signed in with Supabase Auth.',
          updatedAt: new Date().toISOString(),
        }));
      }
    });

    return () => {
      cancelled = true;
      subscription?.data.subscription.unsubscribe();
    };
  }, []);

  // When signed in, hydrate vault from cloud once per session transition.
  useEffect(() => {
    if (
      !shouldAutoPersistToCloud({
        supabaseConfigured: isSupabaseConfigured(),
        authMode: authState.mode,
        remoteMigrationsApplied: cloudRuntime.remoteMigrationsApplied,
      })
    ) {
      return;
    }
    let cancelled = false;
    void hydrateVaultFromRepositories(repositories, vaultRef.current).then((next) => {
      if (cancelled) return;
      if (next.trips.length === 0) return;
      setVault(next);
      const active = getActiveVaultTrip(next);
      if (active) {
        setHistory({ past: [], present: active, future: [] });
      }
      setCloudPersistMessage(`Hydrated ${next.trips.length} trip(s) from cloud.`);
    });
    return () => {
      cancelled = true;
    };
    // Intentionally only re-run when auth mode flips to signed-in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authState.mode]);

  // Debounced cloud persist of vault when authenticated.
  useEffect(() => {
    if (
      !shouldAutoPersistToCloud({
        supabaseConfigured: isSupabaseConfigured(),
        authMode: authState.mode,
        remoteMigrationsApplied: cloudRuntime.remoteMigrationsApplied,
      })
    ) {
      return;
    }
    const timer = window.setTimeout(() => {
      void persistVaultToRepositories(repositories, vault).then((result) => {
        setCloudPersistMessage(result.ok ? result.message : `Cloud persist: ${result.message}`);
        if (result.ok) {
          const active = getActiveVaultTrip(vault);
          if (active) {
            setSyncState((current) =>
              enqueueChange(current, {
                entityType: 'trip',
                entityId: active.id,
                tripId: active.id,
                revision: Date.now(),
                payload: { tripName: active.tripName },
              }),
            );
          }
        }
      });
    }, 800);
    return () => window.clearTimeout(timer);
  }, [vault, authState.mode, repositories, cloudRuntime.remoteMigrationsApplied]);
  useEffect(() => {
    persistSyncState(syncState);
  }, [syncState]);
  useEffect(() => {
    persistOnboardingState(onboardingState);
  }, [onboardingState]);
  useEffect(() => {
    persistDealEngineState(dealEngineState);
  }, [dealEngineState]);
  useEffect(() => {
    persistFinalisationState(finalisationState);
  }, [finalisationState]);
  useEffect(() => {
    const onOnline = () =>
      setFinalisationState((current) => ({
        ...current,
        offline: applyNetworkChange(current.offline, 'online'),
      }));
    const onOffline = () =>
      setFinalisationState((current) => ({
        ...current,
        offline: applyNetworkChange(current.offline, 'offline'),
      }));
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);
  useEffect(() => {
    setFinalisationState((current) => ({
      ...current,
      offline: attachConflictSummaries(
        current.offline,
        syncState.conflicts.map((conflict) => conflict.message),
      ),
    }));
  }, [syncState.conflicts]);
  useEffect(() => {
    setNotificationState((current) => {
      const next = buildNotificationsFromTrips(vault.trips, current);
      persistNotificationState(next);
      return next;
    });
  }, [vault.trips]);
  useEffect(() => {
    const onOnline = () => setSyncState((current) => setNetworkState(current, 'online'));
    const onOffline = () => setSyncState((current) => setNetworkState(current, 'offline'));
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);
  useEffect(() => {
    persistSnapshotHistory(snapshots);
  }, [snapshots]);
  useEffect(() => {
    if (integrityHistoryParseStatus === 'corrupted') {
      return;
    }
    window.localStorage.setItem(INTEGRITY_HISTORY_STORAGE_KEY, JSON.stringify(integrityAuditRuns));
  }, [integrityAuditRuns, integrityHistoryParseStatus]);
  useEffect(() => {
    // Persist selected baseline only. Do not auto-delete storage when selection is null so
    // orphaned/corrupt baseline references remain available for diagnostics and validation.
    if (selectedIntegrityBaselineRunId) {
      window.localStorage.setItem(
        INTEGRITY_HISTORY_BASELINE_STORAGE_KEY,
        JSON.stringify(selectedIntegrityBaselineRunId),
      );
    }
  }, [selectedIntegrityBaselineRunId]);
  useEffect(() => {
    if (!selectedIntegrityBaselineRunId) {
      return;
    }
    if (!integrityAuditRuns.some((run) => run.id === selectedIntegrityBaselineRunId)) {
      setSelectedIntegrityBaselineRunId(null);
    }
  }, [integrityAuditRuns, selectedIntegrityBaselineRunId]);

  const searchIndex = useMemo(() => buildSearchIndex(history.present), [history.present]);

  const pushSnapshot = (trip: TripData, linkedRecordCount: number | null = null) => {
    const snapshot = makeSnapshot(trip, linkedRecordCount);
    setSnapshots((currentSnapshots) => applySnapshotRetention([snapshot, ...currentSnapshots]));
  };

  const updateTrip = (
    updater: (current: TripData) => TripData,
    options?: { createSnapshot?: boolean; snapshotLinkedRecordCount?: number | null },
  ) => {
    const shouldCreateSnapshot = options?.createSnapshot ?? false;
    const snapshotLinkedRecordCount = options?.snapshotLinkedRecordCount ?? null;
    setHistory((currentHistory) => {
      const nextTrip = sanitizeTrip(updater(currentHistory.present));
      if (tripSignature(nextTrip) === tripSignature(currentHistory.present)) {
        return currentHistory;
      }
      if (shouldCreateSnapshot) {
        pushSnapshot(nextTrip, snapshotLinkedRecordCount);
      }
      return updateHistory(currentHistory, nextTrip);
    });
  };

  const replaceTrip = (
    trip: TripData,
    options?: { createSnapshot?: boolean; clearHistory?: boolean; snapshotLinkedRecordCount?: number | null },
  ) => {
    const shouldCreateSnapshot = options?.createSnapshot ?? false;
    const shouldClearHistory = options?.clearHistory ?? false;
    const snapshotLinkedRecordCount = options?.snapshotLinkedRecordCount ?? null;
    setHistory((currentHistory) => {
      const nextTrip = sanitizeTrip(trip);
      if (tripSignature(nextTrip) === tripSignature(currentHistory.present)) {
        return currentHistory;
      }
      if (shouldCreateSnapshot) {
        pushSnapshot(nextTrip, snapshotLinkedRecordCount);
      }
      if (shouldClearHistory) {
        return { past: [], present: nextTrip, future: [] };
      }
      return updateHistory(currentHistory, nextTrip);
    });
  };

  const undo = () => {
    setHistory((currentHistory) => {
      const previous = currentHistory.past.at(-1);
      if (!previous) {
        return currentHistory;
      }
      return {
        past: currentHistory.past.slice(0, -1),
        present: previous,
        future: [currentHistory.present, ...currentHistory.future],
      };
    });
  };

  const redo = () => {
    setHistory((currentHistory) => {
      const next = currentHistory.future[0];
      if (!next) {
        return currentHistory;
      }
      return {
        past: [...currentHistory.past, currentHistory.present].slice(-HISTORY_LIMIT),
        present: next,
        future: currentHistory.future.slice(1),
      };
    });
  };

  const moveStop = (stopId: string, direction: 'up' | 'down') => {
    updateTrip((trip) => {
      const stops = sortStops(trip.stops);
      const target = stops.find((stop) => stop.id === stopId);
      if (!target) {
        return trip;
      }
      const sameDayStops = stops.filter((stop) => stop.day === target.day);
      const currentIndex = sameDayStops.findIndex((stop) => stop.id === stopId);
      const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (swapIndex < 0 || swapIndex >= sameDayStops.length) {
        return trip;
      }

      const currentStop = sameDayStops[currentIndex];
      const swapStop = sameDayStops[swapIndex];
      return {
        ...trip,
        stops: stops.map((stop) => {
          if (stop.id === currentStop.id) {
            return { ...stop, order: swapStop.order };
          }
          if (stop.id === swapStop.id) {
            return { ...stop, order: currentStop.order };
          }
          return stop;
        }),
      };
    }, { createSnapshot: true });
  };

  const addStop = (partial?: Partial<TripStop>) => {
    updateTrip((trip) => {
      const maxDay = trip.stops.reduce((max, stop) => Math.max(max, stop.day), 1);
      const day = partial?.day ?? maxDay;
      const nextOrder = trip.stops.filter((stop) => stop.day === day).length + 1;
      const date =
        partial?.date ||
        trip.departureDate ||
        trip.stops.find((stop) => stop.day === day)?.date ||
        '';
      return appendActivity(
        {
          ...trip,
          stops: [
            ...trip.stops,
            {
              id: `s-${crypto.randomUUID()}`,
              title: partial?.title?.trim() || 'New itinerary item',
              day,
              order: partial?.order ?? nextOrder,
              notes: partial?.notes ?? '',
              date,
              startTime: partial?.startTime ?? '',
              endTime: partial?.endTime ?? '',
              location: partial?.location ?? '',
              category: partial?.category ?? 'other',
              cost: partial?.cost ?? 0,
              currency: partial?.currency ?? trip.currency,
              bookingReference: partial?.bookingReference ?? '',
              locked: partial?.locked ?? false,
              travellerIds: partial?.travellerIds ?? [],
              itemStatus: partial?.itemStatus ?? 'planned',
              latitude: partial?.latitude ?? '',
              longitude: partial?.longitude ?? '',
              supplierDetails: partial?.supplierDetails ?? '',
              reminderAt: partial?.reminderAt ?? '',
              aiGenerated: partial?.aiGenerated ?? false,
            },
          ],
        },
        'Added itinerary item.',
      );
    }, { createSnapshot: true });
  };

  const editStop = (stopId: string, title: string, notes: string) => {
    updateTrip((trip) =>
      appendActivity(
        {
          ...trip,
          stops: trip.stops.map((stop) => (stop.id === stopId ? { ...stop, title, notes } : stop)),
        },
        'Updated itinerary item.',
      ),
    { createSnapshot: true });
  };

  const updateStopDetails = (stopId: string, updates: Partial<TripStop>) => {
    updateTrip((trip) => {
      const existing = trip.stops.find((stop) => stop.id === stopId);
      if (!existing) return trip;
      if (existing.locked) {
        const keys = Object.keys(updates);
        const unlocking = updates.locked === false && keys.every((key) => key === 'locked');
        if (!unlocking) {
          return appendActivity(trip, 'Blocked edit: itinerary item is locked.');
        }
      }
      return appendActivity(
        {
          ...trip,
          stops: trip.stops.map((stop) => (stop.id === stopId ? { ...stop, ...updates, id: stop.id } : stop)),
        },
        'Updated itinerary item details.',
      );
    }, { createSnapshot: true });
  };

  const deleteStop = (stopId: string) => {
    updateTrip((trip) => {
      const existing = trip.stops.find((stop) => stop.id === stopId);
      if (existing?.locked) {
        return appendActivity(trip, 'Blocked delete: itinerary item is locked.');
      }
      return appendActivity(
        {
          ...trip,
          stops: trip.stops.filter((stop) => stop.id !== stopId),
        },
        'Deleted itinerary item.',
      );
    }, { createSnapshot: true });
  };

  const duplicateStop = (stopId: string) => {
    updateTrip((trip) => {
      const stops = sortStops(trip.stops);
      const target = stops.find((stop) => stop.id === stopId);
      if (!target) {
        return trip;
      }
      const dayStops = stops.filter((stop) => stop.day === target.day);
      const maxOrder = dayStops.reduce((max, stop) => Math.max(max, stop.order), 0);
      return appendActivity(
        {
          ...trip,
          stops: [
            ...trip.stops,
            {
              ...target,
              id: `s-${crypto.randomUUID()}`,
              order: maxOrder + 1,
              title: `${target.title} (copy)`,
              locked: false,
            },
          ],
        },
        'Duplicated itinerary item.',
      );
    }, { createSnapshot: true });
  };

  const toggleStopLock = (stopId: string) => {
    updateTrip((trip) => {
      const existing = trip.stops.find((stop) => stop.id === stopId);
      if (!existing) return trip;
      return appendActivity(
        {
          ...trip,
          stops: trip.stops.map((stop) =>
            stop.id === stopId ? { ...stop, locked: !stop.locked } : stop,
          ),
        },
        existing.locked ? 'Unlocked itinerary item.' : 'Locked itinerary item.',
      );
    }, { createSnapshot: true });
  };

  const saveItineraryVersion = (label?: string, source: 'manual' | 'ai' | 'restore' = 'manual') => {
    updateTrip((trip) => {
      const version = {
        id: crypto.randomUUID(),
        label: label?.trim() || `Version ${trip.itineraryVersions.length + 1}`,
        createdAt: new Date().toISOString(),
        source,
        stops: trip.stops.map((stop) => ({ ...stop })),
        notes: '',
      };
      return appendActivity(
        {
          ...trip,
          itineraryVersions: [version, ...trip.itineraryVersions].slice(0, 20),
        },
        `Saved itinerary version: ${version.label}.`,
      );
    }, { createSnapshot: true });
  };

  const restoreItineraryVersion = (versionId: string) => {
    updateTrip((trip) => {
      const version = trip.itineraryVersions.find((entry) => entry.id === versionId);
      if (!version) return trip;
      const snapshot = {
        id: crypto.randomUUID(),
        label: `Before restore ${new Date().toLocaleString()}`,
        createdAt: new Date().toISOString(),
        source: 'restore' as const,
        stops: trip.stops.map((stop) => ({ ...stop })),
        notes: `Auto-saved before restoring ${version.label}`,
      };
      return appendActivity(
        {
          ...trip,
          stops: version.stops.map((stop) => ({ ...stop, id: stop.id || crypto.randomUUID() })),
          itineraryVersions: [snapshot, ...trip.itineraryVersions].slice(0, 20),
        },
        `Restored itinerary version: ${version.label}.`,
      );
    }, { createSnapshot: true });
  };

  const upsertSavedSearch = (search: TripData['savedSearches'][number]) => {
    updateTrip((trip) => {
      const exists = trip.savedSearches.some((entry) => entry.id === search.id);
      return appendActivity(
        {
          ...trip,
          savedSearches: exists
            ? trip.savedSearches.map((entry) => (entry.id === search.id ? search : entry))
            : [search, ...trip.savedSearches].slice(0, 50),
        },
        exists ? 'Updated saved search.' : 'Saved search.',
      );
    }, { createSnapshot: true });
  };

  const deleteSavedSearch = (searchId: string) => {
    updateTrip((trip) =>
      appendActivity(
        {
          ...trip,
          savedSearches: trip.savedSearches.filter((entry) => entry.id !== searchId),
        },
        'Deleted saved search.',
      ),
    { createSnapshot: true });
  };

  const reorderStop = (stopId: string, direction: 'up' | 'down') => {
    moveStop(stopId, direction);
  };

  const saveTripSetup = (input: TripSetupInput): { ok: boolean; errors: ReturnType<typeof validateTripSetup> } => {
    const errors = validateTripSetup(input);
    if (Object.keys(errors).length > 0) {
      return { ok: false, errors };
    }
    updateTrip(
      (trip) =>
        appendActivity(
          {
            ...trip,
            tripName: input.tripName.trim(),
            destination: input.destination.trim(),
            destinationsList: input.destinationsList ?? trip.destinationsList,
            departureDate: input.departureDate,
            returnDate: input.returnDate,
            travellerCount: input.travellerCount,
            purpose: input.purpose,
            travelStyle: input.travelStyle ?? trip.travelStyle,
            budget: input.budget,
            currency: input.currency.trim().toUpperCase(),
            notes: input.notes.trim(),
            tags: input.tags ?? trip.tags,
            coverImageUrl: input.coverImageUrl ?? trip.coverImageUrl,
            status: input.status ?? trip.status,
          },
          'Saved trip setup.',
        ),
      { createSnapshot: true },
    );
    return { ok: true, errors: {} };
  };

  const createDraftTrip = (input: TripSetupInput) => saveTripSetup({ ...input, status: 'draft' });

  const updatePlannedBudget = (budget: number, currency?: string) => {
    if (!Number.isFinite(budget) || budget < 0) {
      return { ok: false as const, message: 'Budget must be zero or greater.' };
    }
    updateTrip(
      (trip) =>
        appendActivity(
          {
            ...trip,
            budget,
            currency: (currency ?? trip.currency).trim().toUpperCase() || trip.currency,
          },
          'Updated planned budget.',
        ),
      { createSnapshot: true },
    );
    return { ok: true as const, message: 'Planned budget updated.' };
  };

  const upsertBooking = (booking: Booking) => {
    updateTrip((trip) => {
      const exists = trip.bookings.some((item) => item.id === booking.id);
      return appendActivity(
        {
          ...trip,
          bookings: exists
            ? trip.bookings.map((item) => (item.id === booking.id ? booking : item))
            : [...trip.bookings, booking],
        },
        exists ? 'Updated booking.' : 'Added booking.',
      );
    }, { createSnapshot: true });
  };

  const deleteBooking = (bookingId: string) => {
    updateTrip(
      (trip) =>
        appendActivity(
          {
            ...trip,
            bookings: trip.bookings.filter((booking) => booking.id !== bookingId),
          },
          'Deleted booking.',
        ),
      { createSnapshot: true },
    );
  };

  const upsertCollectionItem = <T extends { id: string }>(
    key:
      | 'destinations'
      | 'flights'
      | 'stays'
      | 'groundTransport'
      | 'savedPlaces'
      | 'dailyRoutes'
      | 'checklistItems'
      | 'journalEntries',
    item: T,
    sanitize: (value: Partial<T>) => T,
    message: string,
  ) => {
    const clean = sanitize(item);
    updateTrip((trip) => {
      const list = [...((trip[key] as T[] | undefined) ?? [])];
      const exists = list.some((entry) => entry.id === clean.id);
      const nextList = exists ? list.map((entry) => (entry.id === clean.id ? clean : entry)) : [...list, clean];
      return appendActivity({ ...trip, [key]: nextList }, exists ? `Updated ${message}.` : `Added ${message}.`);
    }, { createSnapshot: true });
  };

  const deleteCollectionItem = (
    key:
      | 'destinations'
      | 'flights'
      | 'stays'
      | 'groundTransport'
      | 'savedPlaces'
      | 'dailyRoutes'
      | 'checklistItems'
      | 'journalEntries',
    id: string,
    message: string,
  ) => {
    updateTrip(
      (trip) =>
        appendActivity(
          {
            ...trip,
            [key]: ((trip[key] as Array<{ id: string }> | undefined) ?? []).filter((entry) => entry.id !== id),
          },
          `Deleted ${message}.`,
        ),
      { createSnapshot: true },
    );
  };

  const upsertDestination = (destination: DestinationProfile) =>
    upsertCollectionItem('destinations', destination, sanitizeDestination, 'destination');
  const deleteDestination = (id: string) => deleteCollectionItem('destinations', id, 'destination');
  const upsertFlight = (flight: FlightSegment) => upsertCollectionItem('flights', flight, sanitizeFlight, 'flight');
  const deleteFlight = (id: string) => deleteCollectionItem('flights', id, 'flight');
  const upsertStay = (stay: AccommodationStay) => upsertCollectionItem('stays', stay, sanitizeStay, 'stay');
  const deleteStay = (id: string) => deleteCollectionItem('stays', id, 'stay');
  const upsertGroundTransport = (transport: GroundTransport) =>
    upsertCollectionItem('groundTransport', transport, sanitizeGroundTransport, 'ground transport');
  const deleteGroundTransport = (id: string) => deleteCollectionItem('groundTransport', id, 'ground transport');
  const upsertSavedPlace = (place: SavedPlace) => upsertCollectionItem('savedPlaces', place, sanitizeSavedPlace, 'saved place');
  const deleteSavedPlace = (id: string) => deleteCollectionItem('savedPlaces', id, 'saved place');
  const upsertDailyRoute = (route: DailyRoute) => upsertCollectionItem('dailyRoutes', route, sanitizeDailyRoute, 'daily route');
  const deleteDailyRoute = (id: string) => deleteCollectionItem('dailyRoutes', id, 'daily route');
  const upsertChecklistItem = (item: ChecklistItem) =>
    upsertCollectionItem('checklistItems', item, sanitizeChecklistItem, 'checklist item');
  const deleteChecklistItem = (id: string) => deleteCollectionItem('checklistItems', id, 'checklist item');
  const upsertJournalEntry = (entry: JournalEntry) =>
    upsertCollectionItem('journalEntries', entry, sanitizeJournalEntry, 'journal entry');
  const deleteJournalEntry = (id: string) => deleteCollectionItem('journalEntries', id, 'journal entry');

  const applyPreDepartureChecklistTemplate = () => {
    const template = DEFAULT_CHECKLIST_TEMPLATES[0];
    if (!template) return;
    updateTrip((trip) => {
      const next = applyChecklistTemplate(trip.checklistItems ?? [], template, trip.departureDate);
      return appendActivity({ ...trip, checklistItems: next }, `Applied checklist template: ${template.name}.`);
    }, { createSnapshot: true });
  };

  const updateEmergencyCentre = (emergency: EmergencyCentre) => {
    updateTrip(
      (trip) =>
        appendActivity(
          { ...trip, emergency: sanitizeEmergencyCentre(emergency) },
          'Updated emergency centre.',
        ),
      { createSnapshot: true },
    );
  };

  const startLostPassportWorkflow = () => {
    updateTrip((trip) => {
      const emergency = sanitizeEmergencyCentre(trip.emergency);
      const workflow = createLostPassportWorkflow();
      return appendActivity(
        { ...trip, emergency: { ...emergency, workflows: [workflow, ...emergency.workflows] } },
        'Started lost passport workflow.',
      );
    }, { createSnapshot: true });
  };

  const startLostLuggageWorkflow = () => {
    updateTrip((trip) => {
      const emergency = sanitizeEmergencyCentre(trip.emergency);
      const workflow = createLostLuggageWorkflow();
      return appendActivity(
        { ...trip, emergency: { ...emergency, workflows: [workflow, ...emergency.workflows] } },
        'Started lost luggage workflow.',
      );
    }, { createSnapshot: true });
  };

  const upsertExpense = (expense: Expense) => {
    updateTrip((trip) => {
      const exists = trip.expenses.some((item) => item.id === expense.id);
      return appendActivity(
        {
          ...trip,
          expenses: exists
            ? trip.expenses.map((item) => (item.id === expense.id ? expense : item))
            : [...trip.expenses, expense],
        },
        exists ? 'Updated expense.' : 'Added expense.',
      );
    }, { createSnapshot: true });
  };

  const deleteExpense = (expenseId: string) => {
    updateTrip(
      (trip) =>
        appendActivity(
          {
            ...trip,
            expenses: trip.expenses.filter((expense) => expense.id !== expenseId),
          },
          'Deleted expense.',
        ),
      { createSnapshot: true },
    );
  };

  const upsertPackingList = (list: PackingList) => {
    updateTrip((trip) => {
      const exists = trip.packingLists.some((item) => item.id === list.id);
      return appendActivity(
        {
          ...trip,
          packingLists: exists
            ? trip.packingLists.map((item) => (item.id === list.id ? list : item))
            : [...trip.packingLists, list],
        },
        exists ? 'Updated packing list.' : 'Added packing list.',
      );
    }, { createSnapshot: true });
  };

  const deletePackingList = (listId: string) => {
    updateTrip((trip) => {
      const remaining = trip.packingLists.filter((list) => list.id !== listId);
      return appendActivity(
        {
          ...trip,
          packingLists: remaining.length > 0 ? remaining : [createDefaultPackingList()],
        },
        'Deleted packing list.',
      );
    }, { createSnapshot: true });
  };

  const upsertPackingItem = (listId: string, item: PackingItem) => {
    updateTrip((trip) =>
      appendActivity(
        {
          ...trip,
          packingLists: trip.packingLists.map((list) => {
            if (list.id !== listId) {
              return list;
            }
            const exists = list.items.some((entry) => entry.id === item.id);
            return {
              ...list,
              items: exists
                ? list.items.map((entry) => (entry.id === item.id ? item : entry))
                : [...list.items, item],
            };
          }),
        },
        'Updated packing item.',
      ),
    { createSnapshot: true });
  };

  const deletePackingItem = (listId: string, itemId: string) => {
    updateTrip((trip) =>
      appendActivity(
        {
          ...trip,
          packingLists: trip.packingLists.map((list) =>
            list.id === listId
              ? { ...list, items: list.items.filter((item) => item.id !== itemId) }
              : list,
          ),
        },
        'Deleted packing item.',
      ),
    { createSnapshot: true });
  };

  const applyPackingTemplate = (listId: string, templateKey: string) => {
    const template = DEFAULT_PACKING_TEMPLATES.find((entry) => entry.key === templateKey);
    if (!template) {
      return;
    }
    updateTrip((trip) =>
      appendActivity(
        {
          ...trip,
          packingLists: trip.packingLists.map((list) => {
            if (list.id !== listId) {
              return list;
            }
            return {
              ...list,
              name: list.name || template.name,
              templateKey,
              items: [
                ...list.items,
                ...template.items.map((item) => ({
                  id: crypto.randomUUID(),
                  name: item.name,
                  category: item.category,
                  customCategory: '',
                  quantity: item.quantity,
                  packed: false,
                  assignedTravellerId: null,
                })),
              ],
            };
          }),
        },
        `Applied packing template: ${template.name}.`,
      ),
    { createSnapshot: true });
  };

  const upsertTraveller = (traveller: Traveller) => {
    updateTrip((trip) => {
      const exists = trip.travellers.some((item) => item.id === traveller.id);
      return appendActivity(
        {
          ...trip,
          travellers: exists
            ? trip.travellers.map((item) => (item.id === traveller.id ? traveller : item))
            : [...trip.travellers, traveller],
          travellerCount: Math.max(trip.travellerCount, exists ? trip.travellerCount : trip.travellers.length + 1),
        },
        exists ? 'Updated traveller profile.' : 'Added traveller profile.',
      );
    }, { createSnapshot: true });
  };

  const deleteTraveller = (travellerId: string) => {
    updateTrip(
      (trip) =>
        appendActivity(
          {
            ...trip,
            travellers: trip.travellers.filter((traveller) => traveller.id !== travellerId),
            packingLists: trip.packingLists.map((list) => ({
              ...list,
              items: list.items.map((item) =>
                item.assignedTravellerId === travellerId ? { ...item, assignedTravellerId: null } : item,
              ),
            })),
          },
          'Deleted traveller profile.',
        ),
      { createSnapshot: true },
    );
  };

  const startNewTripDraft = () => {
    const draft = createVaultTrip({ status: 'draft', activityLog: [] });
    setVault((current) => ({
      ...current,
      activeTripId: draft.id,
      trips: [...current.trips, draft],
    }));
    replaceTrip(draft, {
      clearHistory: true,
      createSnapshot: true,
    });
  };

  const openVaultTrip = (tripId: string) => {
    const target = vault.trips.find((trip) => trip.id === tripId);
    if (!target) {
      return { ok: false as const, message: 'Trip not found in vault.' };
    }
    const opened = { ...target, lastOpenedAt: new Date().toISOString() };
    setVault((current) => ({
      ...current,
      activeTripId: tripId,
      trips: current.trips.map((trip) => (trip.id === tripId ? opened : trip)),
    }));
    replaceTrip(opened, { clearHistory: true, createSnapshot: false });
    return { ok: true as const, message: `Opened ${opened.tripName}.` };
  };

  const createVaultTripEntry = (overrides: Partial<VaultTrip> = {}) => {
    const trip = createVaultTrip(overrides);
    setVault((current) => ({
      ...current,
      activeTripId: trip.id,
      trips: [...current.trips, trip],
    }));
    replaceTrip(trip, { clearHistory: true, createSnapshot: true });
    return trip;
  };

  const archiveVaultTrip = (tripId: string) => {
    setVault((current) => ({
      ...current,
      trips: current.trips.map((trip) =>
        trip.id === tripId ? { ...trip, status: 'archived', updatedAt: new Date().toISOString() } : trip,
      ),
    }));
    if (history.present && (history.present as VaultTrip).id === tripId) {
      updateTrip((trip) => ({ ...trip, status: 'archived' }), { createSnapshot: true });
    }
  };

  const restoreVaultTrip = (tripId: string) => {
    setVault((current) => ({
      ...current,
      trips: current.trips.map((trip) =>
        trip.id === tripId
          ? { ...trip, status: trip.departureDate ? 'upcoming' : 'draft', updatedAt: new Date().toISOString() }
          : trip,
      ),
    }));
    if (history.present && (history.present as VaultTrip).id === tripId) {
      updateTrip(
        (trip) => ({ ...trip, status: trip.departureDate ? 'upcoming' : 'draft' }),
        { createSnapshot: true },
      );
    }
  };

  const updateVaultTripMeta = (
    tripId: string,
    patch: Partial<Pick<VaultTrip, 'tags' | 'coverImageUrl' | 'travelStyle' | 'destinationsList' | 'status' | 'notes'>>,
  ) => {
    setVault((current) => ({
      ...current,
      trips: current.trips.map((trip) =>
        trip.id === tripId ? { ...trip, ...patch, updatedAt: new Date().toISOString() } : trip,
      ),
    }));
    if (history.present && (history.present as VaultTrip).id === tripId) {
      updateTrip((trip) => ({ ...trip, ...patch }), { createSnapshot: true });
    }
  };

  const duplicateVaultTrip = (tripId: string) => {
    const source = vault.trips.find((trip) => trip.id === tripId);
    if (!source) {
      return { ok: false as const, message: 'Trip not found.' };
    }
    const duplicated = cloneVaultTrip(source, { newId: true });
    setVault((current) => ({
      ...current,
      activeTripId: duplicated.id,
      trips: [...current.trips, duplicated],
    }));
    replaceTrip(duplicated, { clearHistory: true, createSnapshot: true });
    return { ok: true as const, message: `Duplicated ${source.tripName}.`, trip: duplicated };
  };

  const deleteVaultTrip = (tripId: string) => {
    if (vault.trips.length <= 1) {
      return { ok: false as const, message: 'Cannot delete the last trip in the vault.' };
    }
    const remaining = vault.trips.filter((trip) => trip.id !== tripId);
    const nextActive =
      vault.activeTripId === tripId
        ? remaining[0]!
        : remaining.find((trip) => trip.id === vault.activeTripId) ?? remaining[0]!;
    setVault({
      version: vault.version,
      activeTripId: nextActive.id,
      trips: remaining,
    });
    if (vault.activeTripId === tripId) {
      replaceTrip({ ...nextActive, lastOpenedAt: new Date().toISOString() }, { clearHistory: true, createSnapshot: false });
    }
    return { ok: true as const, message: 'Trip deleted from vault.' };
  };

  const toggleVaultFavourite = (tripId: string) => {
    setVault((current) => ({
      ...current,
      trips: current.trips.map((trip) =>
        trip.id === tripId ? { ...trip, favourite: !trip.favourite, updatedAt: new Date().toISOString() } : trip,
      ),
    }));
    if ((history.present as VaultTrip).id === tripId) {
      updateTrip((trip) => ({ ...trip, favourite: !(trip as VaultTrip).favourite } as TripData), {
        createSnapshot: false,
      });
    }
  };

  const saveTripAsTemplate = (name: string, description = '') => {
    const template = templateFromTrip(toVaultTrip(history.present), name, description);
    setTemplates((current) => [...current, template]);
    return template;
  };

  const createTripFromTemplate = (templateId: string, name?: string) => {
    const template = templates.find((entry) => entry.id === templateId);
    if (!template) {
      return { ok: false as const, message: 'Template not found.' };
    }
    const trip = tripFromTemplate(template, name);
    setVault((current) => ({
      ...current,
      activeTripId: trip.id,
      trips: [...current.trips, trip],
    }));
    replaceTrip(trip, { clearHistory: true, createSnapshot: true });
    return { ok: true as const, message: `Created trip from ${template.name}.`, trip };
  };

  const deleteTripTemplate = (templateId: string) => {
    const target = templates.find((entry) => entry.id === templateId);
    if (!target) {
      return { ok: false as const, message: 'Template not found.' };
    }
    if (target.isDefault) {
      return { ok: false as const, message: 'Default templates cannot be deleted.' };
    }
    setTemplates((current) => current.filter((entry) => entry.id !== templateId));
    return { ok: true as const, message: 'Template deleted.' };
  };

  const upsertDocument = (document: TripDocument) => {
    updateTrip(
      (trip) => {
        const vaultTrip = toVaultTrip(trip);
        const exists = vaultTrip.documents.some((entry) => entry.id === document.id);
        const documents = exists
          ? vaultTrip.documents.map((entry) => (entry.id === document.id ? document : entry))
          : [...vaultTrip.documents, document];
        return appendActivity({ ...vaultTrip, documents }, `Updated document: ${document.title}.`);
      },
      { createSnapshot: true },
    );
  };

  const deleteDocument = (documentId: string) => {
    updateTrip(
      (trip) => {
        const vaultTrip = toVaultTrip(trip);
        const documents = vaultTrip.documents.filter((entry) => entry.id !== documentId);
        return appendActivity({ ...vaultTrip, documents }, 'Deleted document metadata.');
      },
      { createSnapshot: true },
    );
  };

  const applyDraftPlanToActiveTrip = (
    plan: DraftPlan,
    brief: TripBriefInput,
  ): { ok: true; message: string } => {
    const durationDays = plan.durationDays || getTripDurationDays(brief.startDate, brief.endDate);
    updateTrip(
      (trip) => {
        const vaultTrip = toVaultTrip(trip);
        const stops = plan.suggestedDays.map((title, index) => {
          const day = index + 1;
          const date = brief.startDate
            ? new Date(`${brief.startDate}T00:00:00`)
            : new Date();
          date.setDate(date.getDate() + index);
          const iso = date.toISOString().slice(0, 10);
          return {
            id: crypto.randomUUID(),
            title,
            day,
            order: index,
            notes: plan.tripPillars.join(' · '),
            date: iso,
            startTime: day === 1 ? '14:00' : '09:00',
            endTime: day === durationDays ? '12:00' : '17:00',
            location: plan.destination,
            category: index === 0 ? ('travel' as const) : ('activity' as const),
            cost: 0,
            currency: vaultTrip.currency || 'USD',
            bookingReference: '',

            locked: false,
            travellerIds: [],
            itemStatus: 'planned' as const,
            latitude: '',
            longitude: '',
            supplierDetails: '',
            reminderAt: '',
            aiGenerated: false,
          };
        });
        const next = {
          ...vaultTrip,
          tripName: vaultTrip.tripName?.trim() || plan.title,
          destination: plan.destination,
          departureDate: brief.startDate || vaultTrip.departureDate,
          returnDate: brief.endDate || vaultTrip.returnDate,
          travellerCount: plan.travelers,
          notes: [vaultTrip.notes, brief.notes, `Draft pace: ${plan.dailyPace}`, ...plan.assumptions]
            .filter(Boolean)
            .join('\n'),
          status: vaultTrip.status === 'archived' ? vaultTrip.status : ('draft' as const),
          stops: stops.length > 0 ? stops : vaultTrip.stops,
        };
        return appendActivity(next, `Applied draft plan: ${plan.title}.`);
      },
      { createSnapshot: true },
    );
    return { ok: true, message: `Applied draft plan to active trip (${plan.suggestedDays.length} day(s)).` };
  };

  const generateAndPreviewAiPlan = (mode: AiPlanMode = 'complete'): AiTravelPlan =>
    generateAiTravelPlan(history.present ?? createEmptyTrip(), mode);

  const applyAiTravelPlan = (
    plan: AiTravelPlan,
    options: { replaceUnlocked?: boolean; saveVersion?: boolean } = {},
  ) => {
    const replaceUnlocked = options.replaceUnlocked ?? true;
    const saveVersion = options.saveVersion ?? true;
    updateTrip((trip) => {
      const generated = aiPlanToStops(plan, trip.currency);
      const lockedStops = trip.stops.filter((stop) => stop.locked);
      const nextStops = replaceUnlocked
        ? [...lockedStops, ...generated.filter((stop) => !lockedStops.some((locked) => locked.id === stop.id))]
        : [...trip.stops, ...generated];
      const version = saveVersion
        ? {
            id: crypto.randomUUID(),
            label: `AI ${plan.label}`,
            createdAt: new Date().toISOString(),
            source: 'ai' as const,
            stops: nextStops.map((stop) => ({ ...stop })),
            notes: plan.disclaimer,
          }
        : null;
      return appendActivity(
        {
          ...trip,
          stops: nextStops.map((stop, index) => ({ ...stop, order: index + 1 })),
          itineraryVersions: version
            ? [version, ...trip.itineraryVersions].slice(0, 20)
            : trip.itineraryVersions,
          budget: trip.budget > 0 ? trip.budget : plan.budgetSuggestion.amount,
        },
        `Applied AI plan (${plan.mode}) — mock guidance, not live inventory.`,
      );
    }, { createSnapshot: true });
    return { ok: true as const, message: `Applied ${plan.label}. Locked items were preserved.` };
  };

  const currentUserRole: CollaborationRole = 'owner';

  const queueEntityChange = (
    entityType: SyncEntityType,
    entityId: string,
    payload: unknown,
    tripId: string | null = null,
    revision = Date.now(),
  ) => {
    setSyncState((current) =>
      enqueueChange(current, {
        entityType,
        entityId,
        tripId,
        revision,
        payload,
      }),
    );
  };

  const inviteCollaborator = (input: { name: string; email: string; role: CollaborationRole }) => {
    if (input.role === 'owner') {
      return { ok: false as const, message: 'Owner role cannot be assigned via invite.' };
    }
    const member: CollaborationMember = {
      id: crypto.randomUUID(),
      name: input.name.trim() || 'Invitee',
      email: input.email.trim(),
      role: input.role,
      invitedAt: new Date().toISOString(),
      status: 'pending',
    };
    const permission = assertCanManageMembers(currentUserRole);
    if (!permission.ok) {
      return { ok: false as const, message: permission.message };
    }
    updateTrip(
      (trip) => {
        const vaultTrip = toVaultTrip(trip);
        const collaboration = {
          ...vaultTrip.collaboration,
          members: [...vaultTrip.collaboration.members, member],
          auditHistory: [
            {
              id: crypto.randomUUID(),
              at: new Date().toISOString(),
              actorName: vaultTrip.collaboration.ownerName,
              action: 'invite',
              details: `Invited ${member.name} as ${member.role} (pending, local-only).`,
            },
            ...vaultTrip.collaboration.auditHistory,
          ].slice(0, 100),
        };
        return appendActivity({ ...vaultTrip, collaboration }, `Invited collaborator ${member.name}.`);
      },
      { createSnapshot: true },
    );
    queueEntityChange('collaboration', member.id, member, (history.present as VaultTrip).id);
    return { ok: true as const, message: `Invited ${member.name}.` };
  };

  const applyCollaboratorInvitationAction = (memberId: string, action: InvitationAction) => {
    const permission = assertCanManageMembers(currentUserRole);
    if (!permission.ok && action !== 'accept') {
      return { ok: false as const, message: permission.message };
    }
    updateTrip(
      (trip) => {
        const vaultTrip = toVaultTrip(trip);
        const collaboration = applyInvitationAction(
          vaultTrip.collaboration,
          memberId,
          action,
          vaultTrip.collaboration.ownerName,
        );
        return appendActivity({ ...vaultTrip, collaboration }, `Collaboration invitation ${action}.`);
      },
      { createSnapshot: true },
    );
    return { ok: true as const, message: `Invitation ${action} applied.` };
  };

  const updateCollaboratorRole = (memberId: string, role: CollaborationRole) => {
    updateTrip(
      (trip) => {
        const vaultTrip = toVaultTrip(trip);
        const collaboration = {
          ...vaultTrip.collaboration,
          members: vaultTrip.collaboration.members.map((member) =>
            member.id === memberId && member.role !== 'owner' ? { ...member, role } : member,
          ),
          auditHistory: [
            {
              id: crypto.randomUUID(),
              at: new Date().toISOString(),
              actorName: vaultTrip.collaboration.ownerName,
              action: 'role-change',
              details: `Updated role for ${memberId} to ${role}.`,
            },
            ...vaultTrip.collaboration.auditHistory,
          ].slice(0, 100),
        };
        return { ...vaultTrip, collaboration };
      },
      { createSnapshot: true },
    );
  };

  const revokeCollaborator = (memberId: string) => {
    updateTrip(
      (trip) => {
        const vaultTrip = toVaultTrip(trip);
        const collaboration = {
          ...vaultTrip.collaboration,
          members: vaultTrip.collaboration.members.map((member) =>
            member.id === memberId && member.role !== 'owner' ? { ...member, status: 'revoked' as const } : member,
          ),
          auditHistory: [
            {
              id: crypto.randomUUID(),
              at: new Date().toISOString(),
              actorName: vaultTrip.collaboration.ownerName,
              action: 'revoke',
              details: `Revoked access for ${memberId}.`,
            },
            ...vaultTrip.collaboration.auditHistory,
          ].slice(0, 100),
        };
        return appendActivity({ ...vaultTrip, collaboration }, 'Revoked collaborator access.');
      },
      { createSnapshot: true },
    );
  };

  const importVaultBackup = (rawValue: string, mode: 'replace' | 'merge' = 'merge') => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawValue);
    } catch {
      return { ok: false as const, message: 'Import file is not valid JSON.' };
    }
    const validated = validateVaultImportPayload(parsed);
    if (!validated.ok) {
      return { ok: false as const, message: validated.message };
    }
    const incoming = validated.vault.trips.map((trip) => toVaultTrip(trip));
    if (incoming.length === 0) {
      return { ok: false as const, message: 'Import contained no trips.' };
    }
    if (mode === 'replace') {
      const next = {
        version: vault.version,
        activeTripId: incoming[0]!.id,
        trips: incoming,
      };
      setVault(next);
      replaceTrip(incoming[0]!, { clearHistory: true, createSnapshot: true });
      return { ok: true as const, message: 'Vault replaced from import.' };
    }
    const mergedTrips = [...vault.trips];
    for (const trip of incoming) {
      if (!mergedTrips.some((entry) => entry.id === trip.id)) {
        mergedTrips.push(trip);
      } else {
        mergedTrips.push({ ...trip, id: crypto.randomUUID(), tripName: `${trip.tripName} (imported)` });
      }
    }
    setVault({ ...vault, trips: mergedTrips });
    return {
      ok: true as const,
      message: `Merged ${incoming.length} trip(s) into vault.`,
    };
  };

  const importTemplatesBackup = (rawValue: string) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawValue);
    } catch {
      return { ok: false as const, message: 'Template import is not valid JSON.' };
    }
    const list =
      parsed && typeof parsed === 'object' && Array.isArray((parsed as { templates?: unknown }).templates)
        ? (parsed as { templates: unknown[] }).templates
        : Array.isArray(parsed)
          ? parsed
          : null;
    if (!list) {
      return { ok: false as const, message: 'Template import must include a templates array.' };
    }
    const next = migrateTemplates([...templates.filter((entry) => entry.isDefault), ...list]);
    setTemplates(next);
    return { ok: true as const, message: `Imported templates (${next.length} total).` };
  };

  const toVaultBackupJson = (): string =>
    JSON.stringify(
      {
        schema: 'travel-buddy-vault-backup',
        backupVersion: BACKUP_VERSION,
        applicationVersion: APPLICATION_VERSION,
        exportedAt: new Date().toISOString(),
        vault,
        templates,
      },
      null,
      2,
    );

  const rescheduleStopDate = (stopId: string, date: string) => {
    updateTrip(
      (trip) => ({
        ...trip,
        stops: trip.stops.map((stop) => (stop.id === stopId ? { ...stop, date } : stop)),
      }),
      { createSnapshot: true },
    );
  };

  const searchStops = (query: string): string[] => {
    const tokens = query.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    if (tokens.length === 0) {
      return history.present.stops.map((stop) => stop.id);
    }

    const tokenMatches = tokens.map((token) => searchIndex.get(token) ?? []);
    if (tokenMatches.some((matches) => matches.length === 0)) {
      return [];
    }

    return tokenMatches.reduce((accumulator, matches) => accumulator.filter((id) => matches.includes(id)));
  };

  const toBackupJson = (): string => {
    const now = new Date();
    const backup: TripBackup = {
      schema: 'travel-buddy-backup',
      backupVersion: BACKUP_VERSION,
      applicationVersion: APPLICATION_VERSION,
      exportedAt: now.toISOString(),
      tripTitle: history.present.tripName,
      trip: history.present,
      vault,
      templates,
      dealEngine: dealEngineState,
    };
    return JSON.stringify(backup, null, 2);
  };

  const backupFileName = (): string => `travel-buddy-${formatBackupTimestamp(new Date())}.json`;

  const toSnapshotHistoryJson = (): string => {
    const payload: SnapshotHistoryBackup = {
      schema: 'travel-buddy-snapshot-history',
      snapshotHistoryVersion: SNAPSHOT_HISTORY_VERSION,
      applicationVersion: APPLICATION_VERSION,
      exportedAt: new Date().toISOString(),
      totalSnapshotCount: snapshots.length,
      snapshots,
    };
    return JSON.stringify(payload, null, 2);
  };

  const snapshotHistoryFileName = (): string =>
    `travel-buddy-snapshots-${formatSnapshotHistoryTimestamp(new Date())}.json`;

  const resetTrip = () => {
    replaceTrip(cloneTrip(seededTrip), { clearHistory: true, createSnapshot: true });
  };

  const clearLocalData = () => {
    window.localStorage.removeItem(LOCAL_STORAGE_KEY);
    window.localStorage.removeItem(LOCAL_SNAPSHOT_STORAGE_KEY);
    window.localStorage.removeItem(VAULT_STORAGE_KEY);
    window.localStorage.removeItem(TEMPLATE_STORAGE_KEY);
    window.localStorage.removeItem(STORAGE_KEYS.dealEngine);
    window.localStorage.removeItem(STORAGE_KEYS.finalisation);
    setActiveTripParseStatus('missing');
    setSnapshotHistoryParseStatus('missing');
    setActiveTripCorruption(null);
    setSnapshotHistoryCorruption(null);
    setActiveTripRawPayloadSize(0);
    setSnapshotHistoryRawPayloadSize(0);
    setSnapshots([]);
    setDealEngineState(createEmptyDealEngineState());
    setFinalisationState(loadFinalisationState());
    const resetVault = migrateVaultState(null, cloneTrip(seededTrip));
    setVault(resetVault);
    setTemplates(migrateTemplates(null));
    setHistory({
      past: [],
      present: getActiveVaultTrip(resetVault),
      future: [],
    });
  };

  const importTrip = (trip: TripData, linkedRecordCount: number | null = null) => {
    const vaultTrip = toVaultTrip(trip);
    setVault((current) => ({
      ...current,
      activeTripId: vaultTrip.id,
      trips: current.trips.some((entry) => entry.id === vaultTrip.id)
        ? current.trips.map((entry) => (entry.id === vaultTrip.id ? vaultTrip : entry))
        : [...current.trips, vaultTrip],
    }));
    replaceTrip(vaultTrip, { createSnapshot: true, snapshotLinkedRecordCount: linkedRecordCount });
  };

  const restoreSnapshot = (snapshotId: string) => {
    const snapshot = snapshots.find((item) => item.id === snapshotId);
    if (!snapshot) {
      throw new Error('Snapshot not found.');
    }
    replaceTrip(snapshot.trip, { createSnapshot: false });
  };

  const deleteSnapshot = (snapshotId: string) => {
    setSnapshots((currentSnapshots) => currentSnapshots.filter((snapshot) => snapshot.id !== snapshotId));
  };

  const updateSnapshotDetails = (snapshotId: string, label: string, notes: string) => {
    setSnapshots((currentSnapshots) =>
      currentSnapshots.map((snapshot) => {
        if (snapshot.id !== snapshotId) {
          return snapshot;
        }
        return {
          ...snapshot,
          label: label.trim().slice(0, SNAPSHOT_LABEL_LIMIT),
          notes: notes.trim().slice(0, SNAPSHOT_NOTES_LIMIT),
        };
      }),
    );
  };

  const setSnapshotPinned = (snapshotId: string, pinned: boolean) => {
    setSnapshots((currentSnapshots) =>
      applySnapshotRetention(
        currentSnapshots.map((snapshot) => {
          if (snapshot.id !== snapshotId) {
            return snapshot;
          }
          return {
            ...snapshot,
            pinned,
          };
        }),
      ),
    );
  };

  const importSnapshotHistory = (nextSnapshots: BackupSnapshot[]) => {
    setSnapshots(applySnapshotRetention(nextSnapshots));
  };

  const getCleanupPreviewCount = (mode: SnapshotCleanupMode): number =>
    getSnapshotsMatchingCleanup(snapshots, mode).length;

  const cleanupSnapshots = (mode: SnapshotCleanupMode): number => {
    const toDelete = getSnapshotsMatchingCleanup(snapshots, mode);
    if (toDelete.length === 0) {
      return 0;
    }
    const deleteIds = new Set(toDelete.map((snapshot) => snapshot.id));
    setSnapshots((currentSnapshots) => currentSnapshots.filter((snapshot) => !deleteIds.has(snapshot.id)));
    return toDelete.length;
  };

  const retryPersistActiveTrip = (): boolean => persistActiveTrip(history.present);
  const retryPersistSnapshotHistory = (): boolean => persistSnapshotHistory(snapshots);
  const retryPersistAll = (): boolean => retryPersistActiveTrip() && retryPersistSnapshotHistory();

  const runIntegrityAudit = (runType: IntegrityAuditRunType = 'manual-audit'): IntegrityAuditReport => {
    const auditStartedAt = performance.now();
    const issueList: IntegrityIssue[] = [];
    const repairOperations = new Map<
      string,
      (context: { activeTripDraft: Record<string, unknown> | null; snapshotDraft: unknown[] | null }) => void
    >();
    let issueIndex = 0;
    const nextIssueId = (prefix: string): string => `${prefix}-${issueIndex++}`;

    const registerIssue = (
      issue: Omit<IntegrityIssue, 'id'>,
      repairOperation?: (context: { activeTripDraft: Record<string, unknown> | null; snapshotDraft: unknown[] | null }) => void,
    ) => {
      const id = nextIssueId(issue.target);
      issueList.push({ id, ...issue });
      if (repairOperation) {
        repairOperations.set(id, repairOperation);
      }
    };

    const activeRawValue = safeReadStorageValue(LOCAL_STORAGE_KEY);
    let activeTripDraft: Record<string, unknown> | null = null;
    if (activeRawValue !== null) {
      try {
        const parsed = JSON.parse(activeRawValue);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          activeTripDraft = parsed as Record<string, unknown>;
        } else {
          registerIssue({
            target: 'active-trip',
            issueType: 'invalid-active-trip-structure',
            severity: 'blocking-error',
            affectedRecord: 'root',
            description: 'Active trip root payload is not an object.',
            proposedRepair: 'No automatic repair. Use recovery tools.',
            automaticRepairAvailable: false,
          });
        }
      } catch {
        registerIssue({
          target: 'active-trip',
          issueType: 'malformed-active-trip-json',
          severity: 'blocking-error',
          affectedRecord: 'root',
          description: 'Active trip payload is malformed JSON.',
          proposedRepair: 'No automatic repair. Use recovery tools.',
          automaticRepairAvailable: false,
        });
      }
    }

    if (activeTripDraft) {
      if (typeof activeTripDraft.tripName !== 'string' || activeTripDraft.tripName.trim().length === 0) {
        registerIssue(
          {
            target: 'active-trip',
            issueType: 'missing-trip-title',
            severity: 'repairable-error',
            affectedRecord: 'tripName',
            description: 'Trip title is missing or invalid.',
            proposedRepair: 'Set trip title to "Untitled Trip".',
            automaticRepairAvailable: true,
          },
          ({ activeTripDraft: draft }) => {
            if (draft) {
              draft.tripName = 'Untitled Trip';
            }
          },
        );
      }

      const rawStops = Array.isArray(activeTripDraft.stops) ? activeTripDraft.stops : null;
      if (!rawStops) {
        registerIssue({
          target: 'active-trip',
          issueType: 'missing-stops-array',
          severity: 'blocking-error',
          affectedRecord: 'stops',
          description: 'Stops array is missing or invalid.',
          proposedRepair: 'No automatic repair. Use recovery tools.',
          automaticRepairAvailable: false,
        });
      } else {
        const idOccurrences = new Map<string, number[]>();
        for (let stopIndex = 0; stopIndex < rawStops.length; stopIndex += 1) {
          const stop = rawStops[stopIndex];
          if (!stop || typeof stop !== 'object' || Array.isArray(stop)) {
            registerIssue({
              target: 'active-trip',
              issueType: 'invalid-stop-record',
              severity: 'blocking-error',
              affectedRecord: `stops[${stopIndex}]`,
              description: 'Stop record is malformed.',
              proposedRepair: 'No automatic repair for malformed stop object.',
              automaticRepairAvailable: false,
            });
            continue;
          }
          const stopRecord = stop as Record<string, unknown>;

          if (typeof stopRecord.id !== 'string' || stopRecord.id.trim().length === 0) {
            registerIssue(
              {
                target: 'active-trip',
                issueType: 'missing-stop-id',
                severity: 'repairable-error',
                affectedRecord: `stops[${stopIndex}].id`,
                description: 'Stop ID is missing or invalid.',
                proposedRepair: 'Generate a new unique stop ID.',
                automaticRepairAvailable: true,
              },
              ({ activeTripDraft: draft }) => {
                const draftStops = draft?.stops;
                if (Array.isArray(draftStops) && draftStops[stopIndex] && typeof draftStops[stopIndex] === 'object') {
                  (draftStops[stopIndex] as Record<string, unknown>).id = `s-${crypto.randomUUID()}`;
                }
              },
            );
          } else {
            const existing = idOccurrences.get(stopRecord.id) ?? [];
            idOccurrences.set(stopRecord.id, [...existing, stopIndex]);
          }

          if (typeof stopRecord.title !== 'string' || stopRecord.title.trim().length === 0) {
            registerIssue(
              {
                target: 'active-trip',
                issueType: 'missing-stop-title',
                severity: 'repairable-error',
                affectedRecord: `stops[${stopIndex}].title`,
                description: 'Stop title is missing or invalid.',
                proposedRepair: 'Set safe default title.',
                automaticRepairAvailable: true,
              },
              ({ activeTripDraft: draft }) => {
                const draftStops = draft?.stops;
                if (Array.isArray(draftStops) && draftStops[stopIndex] && typeof draftStops[stopIndex] === 'object') {
                  (draftStops[stopIndex] as Record<string, unknown>).title = 'Untitled itinerary item';
                }
              },
            );
          }

          if (typeof stopRecord.notes !== 'string') {
            registerIssue(
              {
                target: 'active-trip',
                issueType: 'invalid-stop-notes-type',
                severity: 'repairable-error',
                affectedRecord: `stops[${stopIndex}].notes`,
                description: 'Notes field has invalid type.',
                proposedRepair: 'Replace notes with an empty string.',
                automaticRepairAvailable: true,
              },
              ({ activeTripDraft: draft }) => {
                const draftStops = draft?.stops;
                if (Array.isArray(draftStops) && draftStops[stopIndex] && typeof draftStops[stopIndex] === 'object') {
                  (draftStops[stopIndex] as Record<string, unknown>).notes = '';
                }
              },
            );
          }

          const dateValue = stopRecord.date;
          if (dateValue === undefined || dateValue === null || String(dateValue).trim().length === 0) {
            registerIssue({
              target: 'active-trip',
              issueType: 'missing-date',
              severity: 'warning',
              affectedRecord: `stops[${stopIndex}].date`,
              description: 'Date is missing.',
              proposedRepair: 'No automatic repair for missing date.',
              automaticRepairAvailable: false,
            });
          } else if (typeof dateValue !== 'string') {
            registerIssue({
              target: 'active-trip',
              issueType: 'invalid-date-type',
              severity: 'blocking-error',
              affectedRecord: `stops[${stopIndex}].date`,
              description: 'Date field type is invalid.',
              proposedRepair: 'No automatic repair for ambiguous date type.',
              automaticRepairAvailable: false,
            });
          } else {
            const normalizedDate = normalizeDateUnambiguous(dateValue);
            if (!normalizedDate) {
              registerIssue({
                target: 'active-trip',
                issueType: 'invalid-date-format',
                severity: 'blocking-error',
                affectedRecord: `stops[${stopIndex}].date`,
                description: 'Date format is invalid or ambiguous.',
                proposedRepair: 'No automatic repair for ambiguous date format.',
                automaticRepairAvailable: false,
              });
            } else if (normalizedDate !== dateValue.trim()) {
              registerIssue(
                {
                  target: 'active-trip',
                  issueType: 'normalizable-date-format',
                  severity: 'repairable-error',
                  affectedRecord: `stops[${stopIndex}].date`,
                  description: 'Date can be normalized to canonical format.',
                  proposedRepair: `Normalize date to ${normalizedDate}.`,
                  automaticRepairAvailable: true,
                },
                ({ activeTripDraft: draft }) => {
                  const draftStops = draft?.stops;
                  if (Array.isArray(draftStops) && draftStops[stopIndex] && typeof draftStops[stopIndex] === 'object') {
                    (draftStops[stopIndex] as Record<string, unknown>).date = normalizedDate;
                  }
                },
              );
            }
          }

          const startTimeValue = stopRecord.startTime;
          const endTimeValue = stopRecord.endTime;
          const normalizedStartTime =
            typeof startTimeValue === 'string' ? normalizeTimeUnambiguous(startTimeValue) : null;
          const normalizedEndTime = typeof endTimeValue === 'string' ? normalizeTimeUnambiguous(endTimeValue) : null;

          if (startTimeValue !== undefined && startTimeValue !== null) {
            if (typeof startTimeValue !== 'string') {
              registerIssue({
                target: 'active-trip',
                issueType: 'invalid-start-time-type',
                severity: 'blocking-error',
                affectedRecord: `stops[${stopIndex}].startTime`,
                description: 'Start time type is invalid.',
                proposedRepair: 'No automatic repair for non-string start time.',
                automaticRepairAvailable: false,
              });
            } else if (!normalizedStartTime) {
              registerIssue({
                target: 'active-trip',
                issueType: 'invalid-start-time-format',
                severity: 'blocking-error',
                affectedRecord: `stops[${stopIndex}].startTime`,
                description: 'Start time format is invalid or ambiguous.',
                proposedRepair: 'No automatic repair for ambiguous time format.',
                automaticRepairAvailable: false,
              });
            } else if (normalizedStartTime !== startTimeValue.trim()) {
              registerIssue(
                {
                  target: 'active-trip',
                  issueType: 'normalizable-start-time',
                  severity: 'repairable-error',
                  affectedRecord: `stops[${stopIndex}].startTime`,
                  description: 'Start time can be normalized.',
                  proposedRepair: `Normalize start time to ${normalizedStartTime}.`,
                  automaticRepairAvailable: true,
                },
                ({ activeTripDraft: draft }) => {
                  const draftStops = draft?.stops;
                  if (Array.isArray(draftStops) && draftStops[stopIndex] && typeof draftStops[stopIndex] === 'object') {
                    (draftStops[stopIndex] as Record<string, unknown>).startTime = normalizedStartTime;
                  }
                },
              );
            }
          }

          if (endTimeValue !== undefined && endTimeValue !== null) {
            if (typeof endTimeValue !== 'string') {
              registerIssue({
                target: 'active-trip',
                issueType: 'invalid-end-time-type',
                severity: 'blocking-error',
                affectedRecord: `stops[${stopIndex}].endTime`,
                description: 'End time type is invalid.',
                proposedRepair: 'No automatic repair for non-string end time.',
                automaticRepairAvailable: false,
              });
            } else if (!normalizedEndTime) {
              registerIssue({
                target: 'active-trip',
                issueType: 'invalid-end-time-format',
                severity: 'blocking-error',
                affectedRecord: `stops[${stopIndex}].endTime`,
                description: 'End time format is invalid or ambiguous.',
                proposedRepair: 'No automatic repair for ambiguous time format.',
                automaticRepairAvailable: false,
              });
            } else if (normalizedEndTime !== endTimeValue.trim()) {
              registerIssue(
                {
                  target: 'active-trip',
                  issueType: 'normalizable-end-time',
                  severity: 'repairable-error',
                  affectedRecord: `stops[${stopIndex}].endTime`,
                  description: 'End time can be normalized.',
                  proposedRepair: `Normalize end time to ${normalizedEndTime}.`,
                  automaticRepairAvailable: true,
                },
                ({ activeTripDraft: draft }) => {
                  const draftStops = draft?.stops;
                  if (Array.isArray(draftStops) && draftStops[stopIndex] && typeof draftStops[stopIndex] === 'object') {
                    (draftStops[stopIndex] as Record<string, unknown>).endTime = normalizedEndTime;
                  }
                },
              );
            }
          }

          if (normalizedStartTime && normalizedEndTime) {
            const startMinutes = timeToMinutes(normalizedStartTime);
            const endMinutes = timeToMinutes(normalizedEndTime);
            if (startMinutes !== null && endMinutes !== null && endMinutes < startMinutes) {
              registerIssue({
                target: 'active-trip',
                issueType: 'end-time-before-start-time',
                severity: 'blocking-error',
                affectedRecord: `stops[${stopIndex}]`,
                description: 'End time is earlier than start time.',
                proposedRepair: 'No automatic repair for ambiguous schedule intent.',
                automaticRepairAvailable: false,
              });
            }
          }

          const linkedFields = [
            'linkedReferences',
            'linkedReferenceIds',
            'linkedDocs',
            'linkedDocuments',
            'vaultReferences',
            'linkedVault',
          ];
          for (const linkedField of linkedFields) {
            if (!(linkedField in stopRecord)) {
              continue;
            }
            const linkedValue = stopRecord[linkedField];
            if (!Array.isArray(linkedValue)) {
              registerIssue(
                {
                  target: 'active-trip',
                  issueType: 'malformed-linked-reference-array',
                  severity: 'repairable-error',
                  affectedRecord: `stops[${stopIndex}].${linkedField}`,
                  description: 'Linked-reference field is not an array.',
                  proposedRepair: `Replace ${linkedField} with an empty array.`,
                  automaticRepairAvailable: true,
                },
                ({ activeTripDraft: draft }) => {
                  const draftStops = draft?.stops;
                  if (Array.isArray(draftStops) && draftStops[stopIndex] && typeof draftStops[stopIndex] === 'object') {
                    (draftStops[stopIndex] as Record<string, unknown>)[linkedField] = [];
                  }
                },
              );
              continue;
            }
            const validEntries = linkedValue.filter((entry) => typeof entry === 'string' && entry.trim().length > 0);
            if (validEntries.length !== linkedValue.length) {
              registerIssue(
                {
                  target: 'active-trip',
                  issueType: 'malformed-linked-reference-entry',
                  severity: 'repairable-error',
                  affectedRecord: `stops[${stopIndex}].${linkedField}`,
                  description: 'Linked-reference array contains malformed entries.',
                  proposedRepair: `Remove malformed entries in ${linkedField}.`,
                  automaticRepairAvailable: true,
                },
                ({ activeTripDraft: draft }) => {
                  const draftStops = draft?.stops;
                  if (Array.isArray(draftStops) && draftStops[stopIndex] && typeof draftStops[stopIndex] === 'object') {
                    const currentValue = (draftStops[stopIndex] as Record<string, unknown>)[linkedField];
                    if (Array.isArray(currentValue)) {
                      (draftStops[stopIndex] as Record<string, unknown>)[linkedField] = currentValue.filter(
                        (entry) => typeof entry === 'string' && entry.trim().length > 0,
                      );
                    }
                  }
                },
              );
            }
          }
        }

        for (const [stopId, indexes] of idOccurrences.entries()) {
          if (indexes.length <= 1) {
            continue;
          }
          indexes.slice(1).forEach((duplicateIndex) => {
            registerIssue(
              {
                target: 'active-trip',
                issueType: 'duplicate-stop-id',
                severity: 'repairable-error',
                affectedRecord: `stops[${duplicateIndex}].id`,
                description: `Duplicate stop ID detected (${stopId}).`,
                proposedRepair: 'Replace duplicate stop ID with a new unique ID.',
                automaticRepairAvailable: true,
              },
              ({ activeTripDraft: draft }) => {
                const draftStops = draft?.stops;
                if (Array.isArray(draftStops) && draftStops[duplicateIndex] && typeof draftStops[duplicateIndex] === 'object') {
                  (draftStops[duplicateIndex] as Record<string, unknown>).id = `s-${crypto.randomUUID()}`;
                }
              },
            );
          });
        }
      }
    }

    const snapshotRawValue = safeReadStorageValue(LOCAL_SNAPSHOT_STORAGE_KEY);
    let snapshotDraft: unknown[] | null = null;
    if (snapshotRawValue !== null) {
      try {
        const parsed = JSON.parse(snapshotRawValue);
        if (Array.isArray(parsed)) {
          snapshotDraft = parsed;
        } else {
          registerIssue({
            target: 'snapshot-history',
            issueType: 'invalid-snapshot-root',
            severity: 'blocking-error',
            affectedRecord: 'root',
            description: 'Snapshot history root payload is not an array.',
            proposedRepair: 'No automatic repair. Use recovery tools.',
            automaticRepairAvailable: false,
          });
        }
      } catch {
        registerIssue({
          target: 'snapshot-history',
          issueType: 'malformed-snapshot-json',
          severity: 'blocking-error',
          affectedRecord: 'root',
          description: 'Snapshot history payload is malformed JSON.',
          proposedRepair: 'No automatic repair. Use recovery tools.',
          automaticRepairAvailable: false,
        });
      }
    }

    if (snapshotDraft) {
      const snapshotIdOccurrences = new Map<string, number[]>();
      for (let snapshotIndex = 0; snapshotIndex < snapshotDraft.length; snapshotIndex += 1) {
        const snapshot = snapshotDraft[snapshotIndex];
        if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
          registerIssue({
            target: 'snapshot-history',
            issueType: 'invalid-snapshot-record',
            severity: 'blocking-error',
            affectedRecord: `snapshots[${snapshotIndex}]`,
            description: 'Snapshot record is malformed.',
            proposedRepair: 'No automatic repair for malformed snapshot object.',
            automaticRepairAvailable: false,
          });
          continue;
        }
        const snapshotRecord = snapshot as Record<string, unknown>;

        if (typeof snapshotRecord.id !== 'string' || snapshotRecord.id.trim().length === 0) {
          registerIssue(
            {
              target: 'snapshot-history',
              issueType: 'missing-snapshot-id',
              severity: 'repairable-error',
              affectedRecord: `snapshots[${snapshotIndex}].id`,
              description: 'Snapshot ID is missing or invalid.',
              proposedRepair: 'Generate a new unique snapshot ID.',
              automaticRepairAvailable: true,
            },
            ({ snapshotDraft: draft }) => {
              if (draft && draft[snapshotIndex] && typeof draft[snapshotIndex] === 'object') {
                (draft[snapshotIndex] as Record<string, unknown>).id = crypto.randomUUID();
              }
            },
          );
        } else {
          const existing = snapshotIdOccurrences.get(snapshotRecord.id) ?? [];
          snapshotIdOccurrences.set(snapshotRecord.id, [...existing, snapshotIndex]);
        }

        if (typeof snapshotRecord.createdAt !== 'string' || Number.isNaN(new Date(snapshotRecord.createdAt).getTime())) {
          registerIssue(
            {
              target: 'snapshot-history',
              issueType: 'invalid-snapshot-timestamp',
              severity: 'repairable-error',
              affectedRecord: `snapshots[${snapshotIndex}].createdAt`,
              description: 'Snapshot timestamp is missing or invalid.',
              proposedRepair: 'Replace with current ISO timestamp.',
              automaticRepairAvailable: true,
            },
            ({ snapshotDraft: draft }) => {
              if (draft && draft[snapshotIndex] && typeof draft[snapshotIndex] === 'object') {
                (draft[snapshotIndex] as Record<string, unknown>).createdAt = new Date().toISOString();
              }
            },
          );
        }

        if (typeof snapshotRecord.pinned !== 'boolean' && snapshotRecord.pinned !== undefined) {
          registerIssue(
            {
              target: 'snapshot-history',
              issueType: 'invalid-pinned-value',
              severity: 'repairable-error',
              affectedRecord: `snapshots[${snapshotIndex}].pinned`,
              description: 'Pinned value is not a boolean.',
              proposedRepair: 'Normalize pinned to false.',
              automaticRepairAvailable: true,
            },
            ({ snapshotDraft: draft }) => {
              if (draft && draft[snapshotIndex] && typeof draft[snapshotIndex] === 'object') {
                (draft[snapshotIndex] as Record<string, unknown>).pinned = false;
              }
            },
          );
        }

        if (typeof snapshotRecord.label === 'string' && snapshotRecord.label.length > SNAPSHOT_LABEL_LIMIT) {
          registerIssue(
            {
              target: 'snapshot-history',
              issueType: 'oversized-snapshot-label',
              severity: 'repairable-error',
              affectedRecord: `snapshots[${snapshotIndex}].label`,
              description: 'Snapshot label exceeds maximum length.',
              proposedRepair: `Truncate label to ${SNAPSHOT_LABEL_LIMIT} characters.`,
              automaticRepairAvailable: true,
            },
            ({ snapshotDraft: draft }) => {
              if (draft && draft[snapshotIndex] && typeof draft[snapshotIndex] === 'object') {
                const record = draft[snapshotIndex] as Record<string, unknown>;
                if (typeof record.label === 'string') {
                  record.label = record.label.slice(0, SNAPSHOT_LABEL_LIMIT);
                }
              }
            },
          );
        }

        if (typeof snapshotRecord.notes === 'string' && snapshotRecord.notes.length > SNAPSHOT_NOTES_LIMIT) {
          registerIssue(
            {
              target: 'snapshot-history',
              issueType: 'oversized-snapshot-notes',
              severity: 'repairable-error',
              affectedRecord: `snapshots[${snapshotIndex}].notes`,
              description: 'Snapshot notes exceed maximum length.',
              proposedRepair: `Truncate notes to ${SNAPSHOT_NOTES_LIMIT} characters.`,
              automaticRepairAvailable: true,
            },
            ({ snapshotDraft: draft }) => {
              if (draft && draft[snapshotIndex] && typeof draft[snapshotIndex] === 'object') {
                const record = draft[snapshotIndex] as Record<string, unknown>;
                if (typeof record.notes === 'string') {
                  record.notes = record.notes.slice(0, SNAPSHOT_NOTES_LIMIT);
                }
              }
            },
          );
        }

        if (typeof snapshotRecord.trip === 'object' && snapshotRecord.trip && !Array.isArray(snapshotRecord.trip)) {
          const tripRecord = snapshotRecord.trip as Record<string, unknown>;
          const tripStops = Array.isArray(tripRecord.stops) ? tripRecord.stops : [];
          const expectedCount = tripStops.length;
          if (typeof snapshotRecord.itineraryItemCount !== 'number' || snapshotRecord.itineraryItemCount !== expectedCount) {
            registerIssue(
              {
                target: 'snapshot-history',
                issueType: 'snapshot-item-count-mismatch',
                severity: 'repairable-error',
                affectedRecord: `snapshots[${snapshotIndex}].itineraryItemCount`,
                description: 'Snapshot item count does not match trip payload.',
                proposedRepair: `Recalculate itineraryItemCount to ${expectedCount}.`,
                automaticRepairAvailable: true,
              },
              ({ snapshotDraft: draft }) => {
                if (draft && draft[snapshotIndex] && typeof draft[snapshotIndex] === 'object') {
                  (draft[snapshotIndex] as Record<string, unknown>).itineraryItemCount = expectedCount;
                }
              },
            );
          }
        }
      }

      for (const [snapshotId, indexes] of snapshotIdOccurrences.entries()) {
        if (indexes.length <= 1) {
          continue;
        }
        indexes.slice(1).forEach((duplicateIndex) => {
          registerIssue(
            {
              target: 'snapshot-history',
              issueType: 'duplicate-snapshot-id',
              severity: 'repairable-error',
              affectedRecord: `snapshots[${duplicateIndex}].id`,
              description: `Duplicate snapshot ID detected (${snapshotId}).`,
              proposedRepair: 'Replace duplicate snapshot ID with a new unique ID.',
              automaticRepairAvailable: true,
            },
            ({ snapshotDraft: draft }) => {
              if (draft && draft[duplicateIndex] && typeof draft[duplicateIndex] === 'object') {
                (draft[duplicateIndex] as Record<string, unknown>).id = crypto.randomUUID();
              }
            },
          );
        });
      }
    }

    integrityRepairOperationsRef.current = repairOperations;

    const warningCount = issueList.filter((issue) => issue.severity === 'warning').length;
    const repairableErrorCount = issueList.filter((issue) => issue.severity === 'repairable-error').length;
    const blockingErrorCount = issueList.filter((issue) => issue.severity === 'blocking-error').length;
    const repairableIssueIds = issueList
      .filter((issue) => issue.automaticRepairAvailable)
      .map((issue) => issue.id);

    const report: IntegrityAuditReport = {
      generatedAt: new Date().toISOString(),
      applicationVersion: APPLICATION_VERSION,
      backupVersion: BACKUP_VERSION,
      snapshotHistoryVersion: SNAPSHOT_HISTORY_VERSION,
      issueCount: issueList.length,
      warningCount,
      repairableErrorCount,
      blockingErrorCount,
      repairableIssueIds,
      issues: issueList,
    };
    const activeTripIssueCount = issueList.filter((issue) => issue.target === 'active-trip').length;
    const snapshotHistoryIssueCount = issueList.filter((issue) => issue.target === 'snapshot-history').length;
    const runMetadata: IntegrityAuditRun = {
      id: crypto.randomUUID(),
      generatedAt: report.generatedAt,
      applicationVersion: report.applicationVersion,
      backupVersion: report.backupVersion,
      snapshotHistoryVersion: report.snapshotHistoryVersion,
      totalIssueCount: report.issueCount,
      warningCount: report.warningCount,
      repairableErrorCount: report.repairableErrorCount,
      blockingErrorCount: report.blockingErrorCount,
      repairableIssueCount: report.repairableIssueIds.length,
      unresolvedIssueCount: report.issueCount,
      activeTripIssueCount,
      snapshotHistoryIssueCount,
      durationMs: Math.max(0, Math.round(performance.now() - auditStartedAt)),
      issueFingerprints: issueList.map(buildIntegrityIssueFingerprint),
      runType,
    };
    recordIntegrityRuntimeMetric('integrity-audit', runMetadata.durationMs);
    setIntegrityHistoryParseStatus('valid');
    setIntegrityAuditRuns((currentRuns) =>
      trimIntegrityHistoryRuns(sortIntegrityHistoryRuns([runMetadata, ...currentRuns])),
    );
    setIntegrityAuditReport(report);
    return report;
  };

  const integrityAuditFileName = (): string =>
    `travel-buddy-integrity-audit-${formatDiagnosticsTimestamp(new Date())}.json`;

  const toIntegrityAuditJson = (): string => {
    if (!integrityAuditReport) {
      throw new Error('Run integrity audit before exporting.');
    }
    return JSON.stringify(
      {
        generatedAt: integrityAuditReport.generatedAt,
        applicationVersion: integrityAuditReport.applicationVersion,
        backupVersion: integrityAuditReport.backupVersion,
        snapshotHistoryVersion: integrityAuditReport.snapshotHistoryVersion,
        issueCount: integrityAuditReport.issueCount,
        warningCount: integrityAuditReport.warningCount,
        repairableErrorCount: integrityAuditReport.repairableErrorCount,
        blockingErrorCount: integrityAuditReport.blockingErrorCount,
        issues: integrityAuditReport.issues.map((issue) => ({
          id: issue.id,
          target: issue.target,
          issueType: issue.issueType,
          severity: issue.severity,
          affectedRecord: issue.affectedRecord,
          description: issue.description,
          proposedRepair: issue.proposedRepair,
          automaticRepairAvailable: issue.automaticRepairAvailable,
        })),
      },
      null,
      2,
    );
  };

  const integrityHistoryFileName = (): string =>
    `travel-buddy-integrity-history-${formatDiagnosticsTimestamp(new Date())}.json`;

  const latestVsBaselineChangeSummary = useMemo<IntegrityHistoryChangeSummary | null>(() => {
    if (!selectedIntegrityBaselineRunId || integrityAuditRuns.length === 0) {
      return null;
    }
    const latestRun = integrityAuditRuns[0];
    const baselineRun = integrityAuditRuns.find((run) => run.id === selectedIntegrityBaselineRunId);
    if (!baselineRun) {
      return null;
    }
    const latestFingerprints = new Set(latestRun.issueFingerprints);
    const baselineFingerprints = new Set(baselineRun.issueFingerprints);
    const newlyIntroducedFingerprints = [...latestFingerprints].filter(
      (fingerprint) => !baselineFingerprints.has(fingerprint),
    );
    const resolvedFingerprints = [...baselineFingerprints].filter(
      (fingerprint) => !latestFingerprints.has(fingerprint),
    );
    const unchangedFingerprints = [...latestFingerprints].filter((fingerprint) =>
      baselineFingerprints.has(fingerprint),
    );
    const totalIssueDelta = latestRun.totalIssueCount - baselineRun.totalIssueCount;
    const warningDelta = latestRun.warningCount - baselineRun.warningCount;
    const repairableErrorDelta = latestRun.repairableErrorCount - baselineRun.repairableErrorCount;
    const blockingErrorDelta = latestRun.blockingErrorCount - baselineRun.blockingErrorCount;
    const activeTripIssueDelta = latestRun.activeTripIssueCount - baselineRun.activeTripIssueCount;
    const snapshotHistoryIssueDelta = latestRun.snapshotHistoryIssueCount - baselineRun.snapshotHistoryIssueCount;
    return {
      baselineRunId: baselineRun.id,
      latestRunId: latestRun.id,
      totalIssueDelta,
      warningDelta,
      repairableErrorDelta,
      blockingErrorDelta,
      activeTripIssueDelta,
      snapshotHistoryIssueDelta,
      newlyIntroducedFingerprints,
      resolvedFingerprints,
      unchangedFingerprints,
      result: classifyIntegrityHistoryChange({
        totalIssueDelta,
        warningDelta,
        repairableErrorDelta,
        blockingErrorDelta,
      }),
    };
  }, [integrityAuditRuns, selectedIntegrityBaselineRunId]);

  const getRepairImpactAnalysis = (selectedIssueIds: string[]): IntegrityRepairImpactSummary | null => {
    const startedAt = performance.now();
    if (!integrityAuditReport) {
      return null;
    }
    const selectedSet = new Set(selectedIssueIds);
    const selectedIssues = integrityAuditReport.issues.filter((issue) => selectedSet.has(issue.id));
    const selectedRepairableIssues = selectedIssues.filter((issue) => issue.automaticRepairAvailable);
    const unresolvedSelectedIssueCount = selectedIssues.length - selectedRepairableIssues.length;
    const estimatedIssuesResolved = selectedRepairableIssues.length;
    const estimatedIssuesRemaining = Math.max(0, integrityAuditReport.issueCount - estimatedIssuesResolved);
    const estimatedWarningsRemaining = Math.max(
      0,
      integrityAuditReport.warningCount -
        selectedRepairableIssues.filter((issue) => issue.severity === 'warning').length,
    );
    const estimatedRepairableErrorsRemaining = Math.max(
      0,
      integrityAuditReport.repairableErrorCount -
        selectedRepairableIssues.filter((issue) => issue.severity === 'repairable-error').length,
    );
    const estimatedBlockingErrorsRemaining = Math.max(
      0,
      integrityAuditReport.blockingErrorCount -
        selectedRepairableIssues.filter((issue) => issue.severity === 'blocking-error').length,
    );
    const activeTripRecordsAffected = new Set(
      selectedRepairableIssues
        .filter((issue) => issue.target === 'active-trip')
        .map((issue) => issue.affectedRecord),
    ).size;
    const snapshotHistoryRecordsAffected = new Set(
      selectedRepairableIssues
        .filter((issue) => issue.target === 'snapshot-history')
        .map((issue) => issue.affectedRecord),
    ).size;
    const nonRepairableIssuesRemaining = integrityAuditReport.issues.filter((issue) => !issue.automaticRepairAvailable).length;
    const expectedHealthScoreBefore = calculateIntegrityHealthScoreFromCounts({
      warningCount: integrityAuditReport.warningCount,
      repairableErrorCount: integrityAuditReport.repairableErrorCount,
      blockingErrorCount: integrityAuditReport.blockingErrorCount,
      unresolvedIssueCount: integrityAuditReport.issueCount,
    });
    const expectedHealthScoreAfter = calculateIntegrityHealthScoreFromCounts({
      warningCount: estimatedWarningsRemaining,
      repairableErrorCount: estimatedRepairableErrorsRemaining,
      blockingErrorCount: estimatedBlockingErrorsRemaining,
      unresolvedIssueCount: estimatedIssuesRemaining,
    });
    const result: IntegrityRepairImpactSummary = {
      selectedRepairCount: selectedIssues.length,
      unresolvedSelectedIssueCount,
      estimatedIssuesResolved,
      estimatedIssuesRemaining,
      estimatedWarningsRemaining,
      estimatedRepairableErrorsRemaining,
      estimatedBlockingErrorsRemaining,
      activeTripRecordsAffected,
      snapshotHistoryRecordsAffected,
      nonRepairableIssuesRemaining,
      expectedHealthScoreBefore,
      expectedHealthScoreAfter,
      expectedHealthScoreDelta: expectedHealthScoreAfter - expectedHealthScoreBefore,
    };
    recordIntegrityRuntimeMetric('repair-impact-analysis', performance.now() - startedAt);
    return result;
  };

  const simulateSelectedRepairs = (selectedIssueIds: string[]): IntegrityRepairSimulationSummary | null => {
    const startedAt = performance.now();
    if (!integrityAuditReport) {
      return null;
    }
    const selectedSet = new Set(selectedIssueIds);
    const beforeIssues = integrityAuditReport.issues;
    const selectedRepairableIssues = beforeIssues.filter(
      (issue) => selectedSet.has(issue.id) && issue.automaticRepairAvailable,
    );

    // Clone local storage payloads in memory and execute repair operations on the clone only.
    const activeRawValue = safeReadStorageValue(LOCAL_STORAGE_KEY);
    const snapshotRawValue = safeReadStorageValue(LOCAL_SNAPSHOT_STORAGE_KEY);
    let activeTripDraft: Record<string, unknown> | null = null;
    let snapshotDraft: unknown[] | null = null;
    if (activeRawValue !== null) {
      try {
        const parsed = JSON.parse(activeRawValue);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          activeTripDraft = structuredClone(parsed) as Record<string, unknown>;
        }
      } catch {
        activeTripDraft = null;
      }
    }
    if (snapshotRawValue !== null) {
      try {
        const parsed = JSON.parse(snapshotRawValue);
        if (Array.isArray(parsed)) {
          snapshotDraft = structuredClone(parsed);
        }
      } catch {
        snapshotDraft = null;
      }
    }
    selectedRepairableIssues.forEach((issue) => {
      const operation = integrityRepairOperationsRef.current.get(issue.id);
      if (operation) {
        operation({ activeTripDraft, snapshotDraft });
      }
    });

    const removedIssueIds = new Set(selectedRepairableIssues.map((issue) => issue.id));
    const afterIssues = beforeIssues.filter((issue) => !removedIssueIds.has(issue.id));
    const beforeFingerprints = new Set(beforeIssues.map(buildIntegrityIssueFingerprint));
    const afterFingerprints = new Set(afterIssues.map(buildIntegrityIssueFingerprint));
    const resolvedFingerprints = [...beforeFingerprints].filter((fingerprint) => !afterFingerprints.has(fingerprint));
    const unchangedFingerprints = [...afterFingerprints].filter((fingerprint) => beforeFingerprints.has(fingerprint));
    const introducedFingerprints = [...afterFingerprints].filter((fingerprint) => !beforeFingerprints.has(fingerprint));
    const expectedHealthScoreBefore = calculateIntegrityHealthScoreFromCounts({
      warningCount: integrityAuditReport.warningCount,
      repairableErrorCount: integrityAuditReport.repairableErrorCount,
      blockingErrorCount: integrityAuditReport.blockingErrorCount,
      unresolvedIssueCount: integrityAuditReport.issueCount,
    });
    const warningCountAfter = afterIssues.filter((issue) => issue.severity === 'warning').length;
    const repairableErrorCountAfter = afterIssues.filter((issue) => issue.severity === 'repairable-error').length;
    const blockingErrorCountAfter = afterIssues.filter((issue) => issue.severity === 'blocking-error').length;
    const expectedHealthScoreAfter = calculateIntegrityHealthScoreFromCounts({
      warningCount: warningCountAfter,
      repairableErrorCount: repairableErrorCountAfter,
      blockingErrorCount: blockingErrorCountAfter,
      unresolvedIssueCount: afterIssues.length,
    });
    const baselineRun = selectedIntegrityBaselineRunId
      ? integrityAuditRuns.find((run) => run.id === selectedIntegrityBaselineRunId)
      : null;
    const baselineTotals = baselineRun
      ? {
          totalIssueCount: baselineRun.totalIssueCount,
          warningCount: baselineRun.warningCount,
          repairableErrorCount: baselineRun.repairableErrorCount,
          blockingErrorCount: baselineRun.blockingErrorCount,
        }
      : {
          totalIssueCount: integrityAuditReport.issueCount,
          warningCount: integrityAuditReport.warningCount,
          repairableErrorCount: integrityAuditReport.repairableErrorCount,
          blockingErrorCount: integrityAuditReport.blockingErrorCount,
        };
    const expectedLatestVsBaselineResult = classifyIntegrityHistoryChange({
      totalIssueDelta: afterIssues.length - baselineTotals.totalIssueCount,
      warningDelta: warningCountAfter - baselineTotals.warningCount,
      repairableErrorDelta: repairableErrorCountAfter - baselineTotals.repairableErrorCount,
      blockingErrorDelta: blockingErrorCountAfter - baselineTotals.blockingErrorCount,
    });
    const simulation: IntegrityRepairSimulationSummary = {
      selectedRepairIssueIds: selectedIssueIds,
      issueTotalsBefore: integrityAuditReport.issueCount,
      issueTotalsAfter: afterIssues.length,
      warningCountBefore: integrityAuditReport.warningCount,
      warningCountAfter,
      repairableErrorCountBefore: integrityAuditReport.repairableErrorCount,
      repairableErrorCountAfter,
      blockingErrorCountBefore: integrityAuditReport.blockingErrorCount,
      blockingErrorCountAfter,
      introducedFingerprints,
      resolvedFingerprints,
      unchangedFingerprints,
      unresolvedFingerprints: [...afterFingerprints],
      expectedHealthScoreBefore,
      expectedHealthScoreAfter,
      expectedHealthScoreDelta: expectedHealthScoreAfter - expectedHealthScoreBefore,
      expectedLatestVsBaselineResult,
      simulationDurationMs: Math.max(0, Math.round(performance.now() - startedAt)),
    };
    setLastIntegrityRepairSimulation(simulation);
    recordIntegrityRuntimeMetric('repair-simulation', performance.now() - startedAt);
    return simulation;
  };

  const integrityHealthScore = useMemo(() => {
    const latestRun = integrityAuditRuns[0];
    if (!latestRun) {
      return 100;
    }
    /**
     * Deterministic health score formula (metadata only):
     * score = 100
     *   - 25 * blocking errors
     *   - 12 * repairable errors
     *   - 4  * warnings
     *   - 2  * unresolved issues
     * Final score is clamped to [0, 100].
     */
    return calculateIntegrityHealthScoreFromCounts({
      warningCount: latestRun.warningCount,
      repairableErrorCount: latestRun.repairableErrorCount,
      blockingErrorCount: latestRun.blockingErrorCount,
      unresolvedIssueCount: latestRun.unresolvedIssueCount,
    });
  }, [integrityAuditRuns]);

  const integrityHealthSummary = useMemo(() => {
    const latestRun = integrityAuditRuns[0];
    if (!latestRun) {
      return 'Integrity Healthy';
    }
    if (latestRun.blockingErrorCount > 0 || integrityHealthScore < 45) {
      return 'Critical Attention Required';
    }
    if (latestRun.repairableErrorCount > 0 || integrityHealthScore < 70) {
      return 'Repairs Recommended';
    }
    if (latestRun.warningCount > 0 || integrityHealthScore < 90) {
      return 'Minor Issues Detected';
    }
    return 'Integrity Healthy';
  }, [integrityAuditRuns, integrityHealthScore]);

  const integrityTrendSummaries = useMemo((): Record<IntegrityTrendWindow, IntegrityTrendSummary> => {
    const buildSummary = (window: IntegrityTrendWindow): IntegrityTrendSummary => {
      const windowRuns = getTrendWindowRuns(integrityAuditRuns, window);
      return {
        window,
        sampleSize: windowRuns.length,
        direction: classifyTrendDirection(windowRuns),
        averageIssueCount: roundToTwo(average(windowRuns.map((run) => run.totalIssueCount))),
        averageBlockingErrorCount: roundToTwo(average(windowRuns.map((run) => run.blockingErrorCount))),
        averageRepairableErrorCount: roundToTwo(average(windowRuns.map((run) => run.repairableErrorCount))),
        averageWarningCount: roundToTwo(average(windowRuns.map((run) => run.warningCount))),
      };
    };
    return {
      'latest-5': buildSummary('latest-5'),
      'latest-10': buildSummary('latest-10'),
      'all-retained': buildSummary('all-retained'),
    };
  }, [integrityAuditRuns]);

  const integrityAuditStatistics = useMemo<IntegrityAuditStatistics>(() => {
    if (integrityAuditRuns.length === 0) {
      return {
        totalAuditRuns: 0,
        firstAuditAt: null,
        latestAuditAt: null,
        averageDurationMs: 0,
        fastestDurationMs: 0,
        slowestDurationMs: 0,
        averageIssueCount: 0,
        highestIssueCount: 0,
        lowestIssueCount: 0,
      };
    }
    const durations = integrityAuditRuns.map((run) => run.durationMs);
    const issueCounts = integrityAuditRuns.map((run) => run.totalIssueCount);
    return {
      totalAuditRuns: integrityAuditRuns.length,
      firstAuditAt: integrityAuditRuns[integrityAuditRuns.length - 1]?.generatedAt ?? null,
      latestAuditAt: integrityAuditRuns[0]?.generatedAt ?? null,
      averageDurationMs: roundToTwo(average(durations)),
      fastestDurationMs: Math.min(...durations),
      slowestDurationMs: Math.max(...durations),
      averageIssueCount: roundToTwo(average(issueCounts)),
      highestIssueCount: Math.max(...issueCounts),
      lowestIssueCount: Math.min(...issueCounts),
    };
  }, [integrityAuditRuns]);

  const integritySeverityTotals = useMemo<IntegritySeverityTotals>(
    () => ({
      warningCount: integrityAuditRuns.reduce((sum, run) => sum + run.warningCount, 0),
      repairableErrorCount: integrityAuditRuns.reduce((sum, run) => sum + run.repairableErrorCount, 0),
      blockingErrorCount: integrityAuditRuns.reduce((sum, run) => sum + run.blockingErrorCount, 0),
    }),
    [integrityAuditRuns],
  );

  const integrityStreakSummary = useMemo<IntegrityStreakSummary>(() => {
    if (integrityAuditRuns.length < 2) {
      return {
        currentImprovementStreak: 0,
        longestImprovementStreak: 0,
        currentRegressionStreak: 0,
        currentStableStreak: 0,
      };
    }
    const transitions = integrityAuditRuns.slice(0, -1).map((run, index) => {
      const olderRun = integrityAuditRuns[index + 1];
      const delta = getRunSeverityWeight(run) - getRunSeverityWeight(olderRun);
      if (delta < 0) {
        return 'improving' as const;
      }
      if (delta > 0) {
        return 'regression' as const;
      }
      return 'stable' as const;
    });
    const countPrefix = (value: (typeof transitions)[number]) => {
      let count = 0;
      for (const transition of transitions) {
        if (transition !== value) {
          break;
        }
        count += 1;
      }
      return count;
    };
    const longest = (value: (typeof transitions)[number]) => {
      let longestCount = 0;
      let currentCount = 0;
      for (const transition of transitions) {
        if (transition === value) {
          currentCount += 1;
          longestCount = Math.max(longestCount, currentCount);
        } else {
          currentCount = 0;
        }
      }
      return longestCount;
    };
    return {
      currentImprovementStreak: countPrefix('improving'),
      longestImprovementStreak: longest('improving'),
      currentRegressionStreak: countPrefix('regression'),
      currentStableStreak: countPrefix('stable'),
    };
  }, [integrityAuditRuns]);

  const integrityStorageUsage = useMemo<IntegrityStorageUsageSummary>(() => {
    const tripStateRaw = safeReadStorageValue(LOCAL_STORAGE_KEY) ?? '';
    const snapshotStateRaw = safeReadStorageValue(LOCAL_SNAPSHOT_STORAGE_KEY) ?? '';
    const integrityHistoryRaw = safeReadStorageValue(INTEGRITY_HISTORY_STORAGE_KEY) ?? '';
    let totalUsedBytes = 0;
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key) {
        continue;
      }
      const value = window.localStorage.getItem(key) ?? '';
      totalUsedBytes += bytesInString(key) + bytesInString(value);
    }
    const estimatedRemainingBytes = Math.max(0, DEFAULT_LOCAL_STORAGE_CAPACITY_BYTES - totalUsedBytes);
    const usedRatio = totalUsedBytes / DEFAULT_LOCAL_STORAGE_CAPACITY_BYTES;
    const warningLevel: IntegrityStorageWarningLevel =
      usedRatio >= 0.92 ? 'Critical' : usedRatio >= 0.8 ? 'Warning' : 'Informational';
    return {
      totalUsedBytes,
      estimatedRemainingBytes,
      integrityHistoryBytes: bytesInString(integrityHistoryRaw),
      snapshotHistoryBytes: bytesInString(snapshotStateRaw),
      tripStateBytes: bytesInString(tripStateRaw),
      warningLevel,
    };
  }, [integrityAuditRuns, snapshots, history.present]);

  const integrityHistoryValidation = useMemo<IntegrityHistoryValidationSummary>(() => {
    const rawRuns = safeReadStorageValue(INTEGRITY_HISTORY_STORAGE_KEY);
    const rawBaseline = safeReadStorageValue(INTEGRITY_HISTORY_BASELINE_STORAGE_KEY);
    const duplicateRunIds = new Set<string>();
    const invalidTimestampRunIds: string[] = [];
    const malformedFingerprintRunIds: string[] = [];
    let malformedRunCount = 0;
    let unsupportedVersion = false;
    let missingMetadata = false;
    const validRuns: IntegrityAuditRun[] = [];
    if (rawRuns) {
      try {
        const parsed: unknown = JSON.parse(rawRuns);
        if (!Array.isArray(parsed)) {
          malformedRunCount += 1;
        } else {
          const seenIds = new Set<string>();
          parsed.forEach((entry) => {
            if (!isIntegrityAuditRun(entry)) {
              malformedRunCount += 1;
              return;
            }
            if (!isValidTimestamp(entry.generatedAt)) {
              invalidTimestampRunIds.push(entry.id);
            }
            if (!entry.issueFingerprints.every(isValidIntegrityFingerprint)) {
              malformedFingerprintRunIds.push(entry.id);
            }
            if (seenIds.has(entry.id)) {
              duplicateRunIds.add(entry.id);
            } else {
              seenIds.add(entry.id);
            }
            validRuns.push(entry);
          });
        }
      } catch {
        malformedRunCount += 1;
      }
    }
    let rawBaselineId: string | null = null;
    if (rawBaseline) {
      try {
        const parsedBaseline: unknown = JSON.parse(rawBaseline);
        if (typeof parsedBaseline === 'string') {
          rawBaselineId = parsedBaseline;
        } else if (parsedBaseline !== null) {
          missingMetadata = true;
        }
      } catch {
        missingMetadata = true;
      }
    }
    const invalidBaselineReference =
      (selectedIntegrityBaselineRunId !== null &&
        !validRuns.some((run) => run.id === selectedIntegrityBaselineRunId)) ||
      (rawBaselineId !== null && !validRuns.some((run) => run.id === rawBaselineId));
    if (integrityAuditRuns.some((run) => run.snapshotHistoryVersion !== SNAPSHOT_HISTORY_VERSION)) {
      unsupportedVersion = true;
    }
    const status: IntegrityHistoryValidationSummary['status'] =
      malformedRunCount > 0 || unsupportedVersion
        ? 'Critical'
        : duplicateRunIds.size > 0 ||
            invalidTimestampRunIds.length > 0 ||
            malformedFingerprintRunIds.length > 0 ||
            invalidBaselineReference ||
            missingMetadata
          ? 'Attention Required'
          : 'Healthy';
    return {
      duplicateRunIds: [...duplicateRunIds],
      malformedRunCount,
      invalidTimestampRunIds,
      malformedFingerprintRunIds,
      invalidBaselineReference,
      unsupportedVersion,
      missingMetadata,
      status,
    };
  }, [integrityAuditRuns, selectedIntegrityBaselineRunId]);

  const integrityHistoryCompactionPreview = useMemo<IntegrityHistoryCompactionPreview>(() => {
    const rawRuns = safeReadStorageValue(INTEGRITY_HISTORY_STORAGE_KEY);
    const candidates: IntegrityAuditRun[] = [];
    let malformedRunsRemoved = 0;
    let invalidTimestampRunsRemoved = 0;
    let malformedFingerprintRunsRemoved = 0;
    if (rawRuns) {
      try {
        const parsed: unknown = JSON.parse(rawRuns);
        if (Array.isArray(parsed)) {
          parsed.forEach((entry) => {
            if (!isIntegrityAuditRun(entry)) {
              malformedRunsRemoved += 1;
              return;
            }
            if (!isValidTimestamp(entry.generatedAt)) {
              invalidTimestampRunsRemoved += 1;
              return;
            }
            if (!entry.issueFingerprints.every(isValidIntegrityFingerprint)) {
              malformedFingerprintRunsRemoved += 1;
              return;
            }
            candidates.push(entry);
          });
        } else {
          malformedRunsRemoved += 1;
        }
      } catch {
        malformedRunsRemoved += 1;
      }
    }
    const ordered = sortIntegrityHistoryRuns(candidates);
    const seenIds = new Set<string>();
    const deduped: IntegrityAuditRun[] = [];
    let duplicateRunsRemoved = 0;
    for (const run of ordered) {
      if (seenIds.has(run.id)) {
        duplicateRunsRemoved += 1;
        continue;
      }
      seenIds.add(run.id);
      deduped.push(run);
    }
    const trimmed = trimIntegrityHistoryRuns(deduped);
    const runsTrimmedByRetention = Math.max(0, deduped.length - trimmed.length);
    const resultingBaselineRunId =
      selectedIntegrityBaselineRunId && trimmed.some((run) => run.id === selectedIntegrityBaselineRunId)
        ? selectedIntegrityBaselineRunId
        : null;
    return {
      duplicateRunsRemoved,
      malformedRunsRemoved,
      invalidTimestampRunsRemoved,
      malformedFingerprintRunsRemoved,
      runsTrimmedByRetention,
      baselineCleared: selectedIntegrityBaselineRunId !== null && resultingBaselineRunId === null,
      resultingRunCount: trimmed.length,
      resultingBaselineRunId,
    };
  }, [integrityAuditRuns, selectedIntegrityBaselineRunId]);

  useEffect(() => {
    const startedAt = performance.now();
    void latestVsBaselineChangeSummary;
    recordIntegrityRuntimeMetric('history-comparison', performance.now() - startedAt);
  }, [latestVsBaselineChangeSummary]);

  useEffect(() => {
    const startedAt = performance.now();
    void integrityHealthScore;
    void integrityHealthSummary;
    void integrityTrendSummaries;
    void integrityAuditStatistics;
    void integritySeverityTotals;
    void integrityStreakSummary;
    recordIntegrityRuntimeMetric('analytics-calculation', performance.now() - startedAt);
  }, [
    integrityHealthScore,
    integrityHealthSummary,
    integrityTrendSummaries,
    integrityAuditStatistics,
    integritySeverityTotals,
    integrityStreakSummary,
  ]);

  useEffect(() => {
    const startedAt = performance.now();
    void integrityStorageUsage;
    void integrityHistoryValidation;
    recordIntegrityRuntimeMetric('storage-validation', performance.now() - startedAt);
  }, [integrityStorageUsage, integrityHistoryValidation]);

  useEffect(() => {
    const startedAt = performance.now();
    void integrityHistoryCompactionPreview;
    recordIntegrityRuntimeMetric('compaction-preview', performance.now() - startedAt);
  }, [integrityHistoryCompactionPreview]);

  const toIntegrityHistoryJson = (): string => {
    const payload: IntegrityHistoryBackup = {
      schema: 'travel-buddy-integrity-history',
      integrityHistoryVersion: INTEGRITY_HISTORY_VERSION,
      exportedAt: new Date().toISOString(),
      selectedBaselineRunId: selectedIntegrityBaselineRunId,
      runs: integrityAuditRuns.map((run) => ({
        id: run.id,
        generatedAt: run.generatedAt,
        applicationVersion: run.applicationVersion,
        backupVersion: run.backupVersion,
        snapshotHistoryVersion: run.snapshotHistoryVersion,
        totalIssueCount: run.totalIssueCount,
        warningCount: run.warningCount,
        repairableErrorCount: run.repairableErrorCount,
        blockingErrorCount: run.blockingErrorCount,
        repairableIssueCount: run.repairableIssueCount,
        unresolvedIssueCount: run.unresolvedIssueCount,
        activeTripIssueCount: run.activeTripIssueCount,
        snapshotHistoryIssueCount: run.snapshotHistoryIssueCount,
        durationMs: run.durationMs,
        issueFingerprints: run.issueFingerprints,
        runType: run.runType,
      })),
    };
    return JSON.stringify(
      {
        ...payload,
        latestVsBaselineChangeSummary,
      },
      null,
      2,
    );
  };

  const parseIntegrityHistoryBackup = (
    rawValue: string,
  ): { preview: IntegrityHistoryImportPreview; runs: IntegrityAuditRun[]; baselineRunId: string | null } => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawValue);
    } catch {
      throw new Error('Integrity history file is not valid JSON.');
    }
    const parsedRecord = assertRecord(parsed, 'Integrity history file must contain an object.');
    if (parsedRecord.schema !== 'travel-buddy-integrity-history') {
      throw new Error('Integrity history schema is unsupported.');
    }
    const historyVersion = ensureNumber(
      parsedRecord.integrityHistoryVersion,
      'Integrity history version is missing or invalid.',
    );
    if (!Number.isInteger(historyVersion)) {
      throw new Error('Integrity history version must be an integer.');
    }
    if (historyVersion !== INTEGRITY_HISTORY_VERSION) {
      throw new Error(`Integrity history version ${historyVersion} is not supported by this app.`);
    }
    const exportedAt = ensureString(parsedRecord.exportedAt, 'Integrity history export timestamp is missing.');
    if (!isValidTimestamp(exportedAt)) {
      throw new Error('Integrity history export timestamp is invalid.');
    }
    if (!Object.prototype.hasOwnProperty.call(parsedRecord, 'selectedBaselineRunId')) {
      throw new Error('Integrity history baseline field is required.');
    }
    if (!(typeof parsedRecord.selectedBaselineRunId === 'string' || parsedRecord.selectedBaselineRunId === null)) {
      throw new Error('Integrity history baseline field must be a string or null.');
    }
    if (!Array.isArray(parsedRecord.runs)) {
      throw new Error('Integrity history runs array is missing.');
    }
    const typedRuns: IntegrityAuditRun[] = [];
    for (const candidate of parsedRecord.runs) {
      if (!isIntegrityAuditRun(candidate)) {
        throw new Error('Integrity history backup contains malformed run metadata or fingerprints.');
      }
      if (!isValidTimestamp(candidate.generatedAt)) {
        throw new Error(`Invalid run timestamp: ${candidate.id}`);
      }
      if (
        candidate.totalIssueCount < 0 ||
        candidate.warningCount < 0 ||
        candidate.repairableErrorCount < 0 ||
        candidate.blockingErrorCount < 0 ||
        candidate.repairableIssueCount < 0 ||
        candidate.unresolvedIssueCount < 0
      ) {
        throw new Error(`Negative issue counts: ${candidate.id}`);
      }
      if (!candidate.issueFingerprints.every(isValidIntegrityFingerprint)) {
        throw new Error(`Malformed fingerprint format in run ${candidate.id}.`);
      }
      typedRuns.push(candidate);
    }
    const runs = trimIntegrityHistoryRuns(sortIntegrityHistoryRuns(typedRuns));
    const baselineCandidate =
      typeof parsedRecord.selectedBaselineRunId === 'string' ? parsedRecord.selectedBaselineRunId : null;
    const baselineRunId = baselineCandidate && runs.some((run) => run.id === baselineCandidate) ? baselineCandidate : null;
    return {
      preview: {
        historyVersion,
        exportedAt,
        totalRunCount: parsedRecord.runs.length,
        importedRunCount: runs.length,
        baselineRunId,
      },
      runs,
      baselineRunId,
    };
  };

  const importIntegrityHistory = (runs: IntegrityAuditRun[], baselineRunId: string | null) => {
    const normalizedRuns = trimIntegrityHistoryRuns(sortIntegrityHistoryRuns(runs));
    const nextBaseline =
      baselineRunId && normalizedRuns.some((run) => run.id === baselineRunId) ? baselineRunId : null;
    setIntegrityHistoryParseStatus('valid');
    setIntegrityAuditRuns(normalizedRuns);
    setSelectedIntegrityBaselineRunId(nextBaseline);
    if (!nextBaseline) {
      window.localStorage.removeItem(INTEGRITY_HISTORY_BASELINE_STORAGE_KEY);
    }
  };

  const setIntegrityBaselineRun = (runId: string) => {
    if (!integrityAuditRuns.some((run) => run.id === runId)) {
      return;
    }
    setSelectedIntegrityBaselineRunId(runId);
  };

  const clearIntegrityBaselineRun = () => {
    setSelectedIntegrityBaselineRunId(null);
    window.localStorage.removeItem(INTEGRITY_HISTORY_BASELINE_STORAGE_KEY);
  };

  const deleteIntegrityRun = (runId: string) => {
    setIntegrityHistoryParseStatus('valid');
    setIntegrityAuditRuns((currentRuns) => currentRuns.filter((run) => run.id !== runId));
    setSelectedIntegrityBaselineRunId((currentBaseline) => {
      if (currentBaseline === runId) {
        window.localStorage.removeItem(INTEGRITY_HISTORY_BASELINE_STORAGE_KEY);
        return null;
      }
      return currentBaseline;
    });
  };

  const clearIntegrityHistory = () => {
    setIntegrityHistoryParseStatus('valid');
    setIntegrityAuditRuns([]);
    setSelectedIntegrityBaselineRunId(null);
    window.localStorage.removeItem(INTEGRITY_HISTORY_BASELINE_STORAGE_KEY);
  };

  const compactIntegrityHistory = (): IntegrityHistoryCompactionPreview => {
    const rawRuns = safeReadStorageValue(INTEGRITY_HISTORY_STORAGE_KEY);
    const candidates: IntegrityAuditRun[] = [];
    let malformedRunsRemoved = 0;
    let invalidTimestampRunsRemoved = 0;
    let malformedFingerprintRunsRemoved = 0;
    if (rawRuns) {
      try {
        const parsed: unknown = JSON.parse(rawRuns);
        if (Array.isArray(parsed)) {
          parsed.forEach((entry) => {
            if (!isIntegrityAuditRun(entry)) {
              malformedRunsRemoved += 1;
              return;
            }
            if (!isValidTimestamp(entry.generatedAt)) {
              invalidTimestampRunsRemoved += 1;
              return;
            }
            if (!entry.issueFingerprints.every(isValidIntegrityFingerprint)) {
              malformedFingerprintRunsRemoved += 1;
              return;
            }
            candidates.push(entry);
          });
        } else {
          malformedRunsRemoved += 1;
        }
      } catch {
        malformedRunsRemoved += 1;
      }
    }
    const ordered = sortIntegrityHistoryRuns(candidates);
    const seenIds = new Set<string>();
    const deduped: IntegrityAuditRun[] = [];
    let duplicateRunsRemoved = 0;
    for (const run of ordered) {
      if (seenIds.has(run.id)) {
        duplicateRunsRemoved += 1;
        continue;
      }
      seenIds.add(run.id);
      deduped.push(run);
    }
    const trimmed = trimIntegrityHistoryRuns(deduped);
    const runsTrimmedByRetention = Math.max(0, deduped.length - trimmed.length);
    const resultingBaselineRunId =
      selectedIntegrityBaselineRunId && trimmed.some((run) => run.id === selectedIntegrityBaselineRunId)
        ? selectedIntegrityBaselineRunId
        : null;
    setIntegrityHistoryParseStatus('valid');
    setIntegrityAuditRuns(trimmed);
    setSelectedIntegrityBaselineRunId(resultingBaselineRunId);
    if (!resultingBaselineRunId) {
      window.localStorage.removeItem(INTEGRITY_HISTORY_BASELINE_STORAGE_KEY);
    }
    return {
      duplicateRunsRemoved,
      malformedRunsRemoved,
      invalidTimestampRunsRemoved,
      malformedFingerprintRunsRemoved,
      runsTrimmedByRetention,
      baselineCleared: selectedIntegrityBaselineRunId !== null && resultingBaselineRunId === null,
      resultingRunCount: trimmed.length,
      resultingBaselineRunId,
    };
  };

  const recordSimulationAccuracy = (
    selectedIssueIds: string[],
    nextReport: IntegrityAuditReport,
    beforeFingerprints: Set<string>,
  ) => {
    if (!lastIntegrityRepairSimulation) {
      return;
    }
    const selectedExpected = [...lastIntegrityRepairSimulation.selectedRepairIssueIds].sort().join(',');
    const selectedActual = [...selectedIssueIds].sort().join(',');
    const afterFingerprints = new Set(nextReport.issues.map(buildIntegrityIssueFingerprint));
    const actualResolvedFingerprintCount = [...beforeFingerprints].filter(
      (fingerprint) => !afterFingerprints.has(fingerprint),
    ).length;
    const predictedResolved = lastIntegrityRepairSimulation.resolvedFingerprints.length;
    const status = classifySimulationAccuracy({
      selectionMatches: selectedExpected === selectedActual,
      predictedIssueTotal: lastIntegrityRepairSimulation.issueTotalsAfter,
      actualIssueTotal: nextReport.issueCount,
      predictedWarningCount: lastIntegrityRepairSimulation.warningCountAfter,
      actualWarningCount: nextReport.warningCount,
      predictedRepairableErrorCount: lastIntegrityRepairSimulation.repairableErrorCountAfter,
      actualRepairableErrorCount: nextReport.repairableErrorCount,
      predictedBlockingErrorCount: lastIntegrityRepairSimulation.blockingErrorCountAfter,
      actualBlockingErrorCount: nextReport.blockingErrorCount,
      predictedResolvedFingerprintCount: predictedResolved,
      actualResolvedFingerprintCount,
    });
    setLastIntegritySimulationAccuracy({
      predictedIssueTotal: lastIntegrityRepairSimulation.issueTotalsAfter,
      actualIssueTotal: nextReport.issueCount,
      predictedWarningCount: lastIntegrityRepairSimulation.warningCountAfter,
      actualWarningCount: nextReport.warningCount,
      predictedRepairableErrorCount: lastIntegrityRepairSimulation.repairableErrorCountAfter,
      actualRepairableErrorCount: nextReport.repairableErrorCount,
      predictedBlockingErrorCount: lastIntegrityRepairSimulation.blockingErrorCountAfter,
      actualBlockingErrorCount: nextReport.blockingErrorCount,
      predictedResolvedFingerprintCount: predictedResolved,
      actualResolvedFingerprintCount,
      status,
    });
  };

  const runIntegrityDiagnostics = (): IntegrityDiagnosticsSummary => {
    const diagnosticsStartedAt = performance.now();

    // Deterministic status rules:
    // - Fail => category has blocking consistency risk or malformed critical metadata.
    // - Warning => category is parseable but has non-blocking inconsistencies.
    // - Pass => no findings.
    // Overall status:
    // - Critical if any category = Fail
    // - Attention Required if no Fail and any category = Warning
    // - Healthy otherwise

    const auditHistoryFindings: string[] = [];
    const seenRunIds = new Set<string>();
    let hasAuditHistoryFail = false;
    for (let index = 0; index < integrityAuditRuns.length; index += 1) {
      const run = integrityAuditRuns[index];
      if (seenRunIds.has(run.id)) {
        auditHistoryFindings.push(`Duplicate run ID: ${run.id}`);
      } else {
        seenRunIds.add(run.id);
      }
      if (!isValidTimestamp(run.generatedAt)) {
        auditHistoryFindings.push(`Invalid run timestamp: ${run.id}`);
        hasAuditHistoryFail = true;
      }
      if (run.totalIssueCount < 0 || run.warningCount < 0 || run.repairableErrorCount < 0 || run.blockingErrorCount < 0) {
        auditHistoryFindings.push(`Negative issue counts: ${run.id}`);
        hasAuditHistoryFail = true;
      }
      if (
        run.warningCount + run.repairableErrorCount + run.blockingErrorCount > run.totalIssueCount ||
        run.repairableIssueCount > run.totalIssueCount ||
        run.unresolvedIssueCount > run.totalIssueCount
      ) {
        auditHistoryFindings.push(`Issue count relationships invalid: ${run.id}`);
      }
      if (run.runType !== 'manual-audit' && run.runType !== 'before-repair' && run.runType !== 'after-repair') {
        auditHistoryFindings.push(`Invalid run type: ${run.id}`);
        hasAuditHistoryFail = true;
      }
      if (index > 0) {
        const previous = integrityAuditRuns[index - 1];
        if (new Date(previous.generatedAt).getTime() < new Date(run.generatedAt).getTime()) {
          auditHistoryFindings.push('Run ordering is not newest-first.');
        }
      }
    }
    if (integrityAuditRuns.length > INTEGRITY_HISTORY_LIMIT) {
      auditHistoryFindings.push(`Retention exceeded: ${integrityAuditRuns.length}/${INTEGRITY_HISTORY_LIMIT}`);
    }
    const auditHistoryConsistency: IntegrityDiagnosticsCategoryResult = {
      status: hasAuditHistoryFail ? 'Fail' : auditHistoryFindings.length > 0 ? 'Warning' : 'Pass',
      findings: auditHistoryFindings,
    };

    const baselineFindings: string[] = [];
    if (selectedIntegrityBaselineRunId && !integrityAuditRuns.some((run) => run.id === selectedIntegrityBaselineRunId)) {
      baselineFindings.push('Selected baseline does not exist in audit history.');
    }
    const rawBaselineValue = safeReadStorageValue(INTEGRITY_HISTORY_BASELINE_STORAGE_KEY);
    if (rawBaselineValue !== null) {
      try {
        const parsedBaseline: unknown = JSON.parse(rawBaselineValue);
        if (typeof parsedBaseline === 'string') {
          const rawHistoryValue = safeReadStorageValue(INTEGRITY_HISTORY_STORAGE_KEY);
          let rawHistoryContainsBaseline = false;
          if (rawHistoryValue) {
            try {
              const parsedHistory: unknown = JSON.parse(rawHistoryValue);
              if (Array.isArray(parsedHistory)) {
                rawHistoryContainsBaseline = parsedHistory.some(
                  (entry) => isIntegrityAuditRun(entry) && entry.id === parsedBaseline,
                );
              }
            } catch {
              rawHistoryContainsBaseline = false;
            }
          }
          if (!rawHistoryContainsBaseline) {
            baselineFindings.push('Invalid baseline reference: Yes');
          }
        }
      } catch {
        baselineFindings.push('Baseline storage has invalid type.');
      }
    }
    if (latestVsBaselineChangeSummary) {
      const baselineRunExists = integrityAuditRuns.some((run) => run.id === latestVsBaselineChangeSummary.baselineRunId);
      const latestRunExists = integrityAuditRuns.some((run) => run.id === latestVsBaselineChangeSummary.latestRunId);
      if (!baselineRunExists || !latestRunExists) {
        baselineFindings.push('Latest-vs-baseline references invalid run IDs.');
      }
    }
    const baselineConsistency: IntegrityDiagnosticsCategoryResult = {
      status: baselineFindings.length > 0 ? 'Warning' : 'Pass',
      findings: baselineFindings,
    };

    const fingerprintFindings: string[] = [];
    let hasFingerprintFail = false;
    integrityAuditRuns.forEach((run) => {
      if (!run.issueFingerprints.every(isValidIntegrityFingerprint)) {
        fingerprintFindings.push(`Malformed fingerprint format in run ${run.id}.`);
        hasFingerprintFail = true;
      }
      const uniqueFingerprints = new Set(run.issueFingerprints);
      if (uniqueFingerprints.size !== run.issueFingerprints.length) {
        fingerprintFindings.push(`Duplicate fingerprints in run ${run.id}.`);
      }
      if (run.issueFingerprints.some((fingerprint) => /(title|note|label|location|linked)/i.test(fingerprint))) {
        fingerprintFindings.push(`Potential prohibited text token in run ${run.id} fingerprint set.`);
      }
    });
    if (latestVsBaselineChangeSummary) {
      const introduced = new Set(latestVsBaselineChangeSummary.newlyIntroducedFingerprints);
      const resolved = new Set(latestVsBaselineChangeSummary.resolvedFingerprints);
      const unchanged = new Set(latestVsBaselineChangeSummary.unchangedFingerprints);
      const overlap =
        [...introduced].some((value) => resolved.has(value) || unchanged.has(value)) ||
        [...resolved].some((value) => unchanged.has(value));
      if (overlap) {
        fingerprintFindings.push('Latest-vs-baseline fingerprint sets overlap.');
      }
    }
    const fingerprintConsistency: IntegrityDiagnosticsCategoryResult = {
      status: hasFingerprintFail ? 'Fail' : fingerprintFindings.length > 0 ? 'Warning' : 'Pass',
      findings: fingerprintFindings,
    };

    const analyticsFindings: string[] = [];
    const recomputedHealth = (() => {
      const latest = integrityAuditRuns[0];
      if (!latest) {
        return 100;
      }
      return calculateIntegrityHealthScoreFromCounts({
        warningCount: latest.warningCount,
        repairableErrorCount: latest.repairableErrorCount,
        blockingErrorCount: latest.blockingErrorCount,
        unresolvedIssueCount: latest.unresolvedIssueCount,
      });
    })();
    if (recomputedHealth !== integrityHealthScore) {
      analyticsFindings.push('Health score mismatch.');
    }
    (['latest-5', 'latest-10', 'all-retained'] as IntegrityTrendWindow[]).forEach((window) => {
      const recomputedDirection = classifyTrendDirection(getTrendWindowRuns(integrityAuditRuns, window));
      if (recomputedDirection !== integrityTrendSummaries[window].direction) {
        analyticsFindings.push(`Trend direction mismatch for ${window}.`);
      }
    });
    const recomputedSeverityTotals = {
      warningCount: integrityAuditRuns.reduce((sum, run) => sum + run.warningCount, 0),
      repairableErrorCount: integrityAuditRuns.reduce((sum, run) => sum + run.repairableErrorCount, 0),
      blockingErrorCount: integrityAuditRuns.reduce((sum, run) => sum + run.blockingErrorCount, 0),
    };
    if (
      recomputedSeverityTotals.warningCount !== integritySeverityTotals.warningCount ||
      recomputedSeverityTotals.repairableErrorCount !== integritySeverityTotals.repairableErrorCount ||
      recomputedSeverityTotals.blockingErrorCount !== integritySeverityTotals.blockingErrorCount
    ) {
      analyticsFindings.push('Severity totals mismatch.');
    }
    const analyticsConsistency: IntegrityDiagnosticsCategoryResult = {
      status: analyticsFindings.length > 0 ? 'Warning' : 'Pass',
      findings: analyticsFindings,
    };

    const storageFindings: string[] = [];
    const rawHistory = safeReadStorageValue(INTEGRITY_HISTORY_STORAGE_KEY);
    const rawBaseline = safeReadStorageValue(INTEGRITY_HISTORY_BASELINE_STORAGE_KEY);
    if (rawHistory !== null) {
      try {
        const parsed = JSON.parse(rawHistory);
        if (!Array.isArray(parsed)) {
          storageFindings.push('Audit history storage is not an array.');
        }
      } catch {
        storageFindings.push('Audit history storage is malformed JSON.');
      }
    }
    if (rawBaseline !== null) {
      try {
        const parsed = JSON.parse(rawBaseline);
        if (!(typeof parsed === 'string' || parsed === null)) {
          storageFindings.push('Baseline storage has invalid type.');
        }
      } catch {
        storageFindings.push('Baseline storage is malformed JSON.');
      }
    }
    const reproducibleTotal =
      integrityStorageUsage.totalUsedBytes >=
      integrityStorageUsage.integrityHistoryBytes + integrityStorageUsage.snapshotHistoryBytes + integrityStorageUsage.tripStateBytes;
    if (!reproducibleTotal) {
      storageFindings.push('Storage size calculations are not reproducible.');
    }
    const storageConsistency: IntegrityDiagnosticsCategoryResult = {
      status: storageFindings.some((finding) => /malformed|not an array/i.test(finding)) ? 'Fail' : storageFindings.length > 0 ? 'Warning' : 'Pass',
      findings: storageFindings,
    };

    const categoryResults = [
      auditHistoryConsistency.status,
      baselineConsistency.status,
      fingerprintConsistency.status,
      analyticsConsistency.status,
      storageConsistency.status,
    ];
    const overallStatus: IntegrityDiagnosticsSummary['overallStatus'] = categoryResults.includes('Fail')
      ? 'Critical'
      : categoryResults.includes('Warning')
        ? 'Attention Required'
        : 'Healthy';
    const recommendedManualActions: string[] = [];
    if (auditHistoryConsistency.status !== 'Pass') {
      recommendedManualActions.push('Run manual history compaction and verify retention ordering.');
    }
    if (baselineConsistency.status !== 'Pass') {
      recommendedManualActions.push('Re-select a valid baseline run.');
    }
    if (fingerprintConsistency.status !== 'Pass') {
      recommendedManualActions.push('Re-run audit and export history for manual review.');
    }
    if (storageConsistency.status !== 'Pass') {
      recommendedManualActions.push('Use Diagnostics & Recovery to inspect local storage payloads.');
    }
    const generatedAt = new Date().toISOString();
    const diagnostics: IntegrityDiagnosticsSummary = {
      overallStatus,
      auditHistoryConsistency,
      baselineConsistency,
      fingerprintConsistency,
      analyticsConsistency,
      storageConsistency,
      runtimeTimings: integrityRuntimeMetrics,
      recommendedManualActions,
      generatedAt,
    };
    setIntegrityDiagnosticsSummary(diagnostics);
    recordIntegrityRuntimeMetric('diagnostics-run', performance.now() - diagnosticsStartedAt);
    return diagnostics;
  };

  const integrityDiagnosticsFileName = (): string =>
    `travel-buddy-integrity-diagnostics-${formatDiagnosticsTimestamp(new Date())}.json`;

  const toIntegrityDiagnosticsJson = (): string => {
    const diagnostics = integrityDiagnosticsSummary ?? runIntegrityDiagnostics();
    const payload = JSON.stringify(
      {
        schema: 'travel-buddy-integrity-diagnostics',
        version: 1,
        generatedAt: new Date().toISOString(),
        overallStatus: diagnostics.overallStatus,
        categoryResults: {
          auditHistoryConsistency: diagnostics.auditHistoryConsistency,
          baselineConsistency: diagnostics.baselineConsistency,
          fingerprintConsistency: diagnostics.fingerprintConsistency,
          analyticsConsistency: diagnostics.analyticsConsistency,
          storageConsistency: diagnostics.storageConsistency,
        },
        runtimeTimings: diagnostics.runtimeTimings,
        storageSummary: integrityStorageUsage,
        historyValidationSummary: integrityHistoryValidation,
        recommendedManualActions: diagnostics.recommendedManualActions,
      },
      null,
      2,
    );
    return payload;
  };

  const integrityReportFileName = (): string =>
    `travel-buddy-integrity-report-${formatDiagnosticsTimestamp(new Date())}.json`;

  const toIntegrityReportJson = (options: {
    selectedTrendWindow: IntegrityTrendWindow;
    repairImpactSummary: IntegrityRepairImpactSummary | null;
    simulationSummary: IntegrityRepairSimulationSummary | null;
  }): string => {
    const startedAt = performance.now();
    const latestRun = integrityAuditRuns[0] ?? null;
    const selectedTrendSummary = integrityTrendSummaries[options.selectedTrendWindow];
    const baselineRun =
      selectedIntegrityBaselineRunId !== null
        ? integrityAuditRuns.find((run) => run.id === selectedIntegrityBaselineRunId) ?? null
        : null;
    const unresolvedIssueSummary = {
      totalUnresolvedIssues: latestRun?.unresolvedIssueCount ?? 0,
      blockingIssues: latestRun?.blockingErrorCount ?? 0,
      repairableIssues: latestRun?.repairableErrorCount ?? 0,
      warningIssues: latestRun?.warningCount ?? 0,
    };
    const diagnostics = integrityDiagnosticsSummary ?? runIntegrityDiagnostics();
    const payload = JSON.stringify(
      {
        schema: 'travel-buddy-integrity-report',
        version: 1,
        generatedAt: new Date().toISOString(),
        applicationVersion: APPLICATION_VERSION,
        currentHealthScore: integrityHealthScore,
        healthSummary: integrityHealthSummary,
        selectedTrendWindow: options.selectedTrendWindow,
        trendSummary: selectedTrendSummary,
        latestAuditMetadata: latestRun
          ? {
              id: latestRun.id,
              generatedAt: latestRun.generatedAt,
              runType: latestRun.runType,
              totalIssueCount: latestRun.totalIssueCount,
              warningCount: latestRun.warningCount,
              repairableErrorCount: latestRun.repairableErrorCount,
              blockingErrorCount: latestRun.blockingErrorCount,
              unresolvedIssueCount: latestRun.unresolvedIssueCount,
              durationMs: latestRun.durationMs,
            }
          : null,
        baselineMetadata: baselineRun
          ? {
              id: baselineRun.id,
              generatedAt: baselineRun.generatedAt,
              runType: baselineRun.runType,
            }
          : null,
        latestVsBaselineSummary: latestVsBaselineChangeSummary,
        severityDistribution: integritySeverityTotals,
        auditStatistics: integrityAuditStatistics,
        streakStatistics: integrityStreakSummary,
        unresolvedIssueSummary,
        repairImpactSummary: options.repairImpactSummary,
        simulationSummary: options.simulationSummary,
        simulationAccuracySummary: lastIntegritySimulationAccuracy,
        storageSummary: integrityStorageUsage,
        historyValidationSummary: integrityHistoryValidation,
        diagnosticsSummary: diagnostics,
        runtimeTimingSummary: integrityRuntimeMetrics,
        privacyExclusions: {
          excludedFields: [
            'trip payloads',
            'snapshot payloads',
            'trip/itinerary titles',
            'notes',
            'labels',
            'locations',
            'linked-document names',
            'user-entered free text',
          ],
        },
      },
      null,
      2,
    );
    recordIntegrityRuntimeMetric('integrity-report-generation', performance.now() - startedAt);
    return payload;
  };

  const integrityOverview = useMemo<IntegrityOverviewSummary>(() => {
    const latestRun = integrityAuditRuns[0] ?? null;
    return {
      currentHealthScore: integrityHealthScore,
      healthSummary: integrityHealthSummary,
      latestAuditTimestamp: latestRun?.generatedAt ?? null,
      latestRunType: latestRun?.runType ?? null,
      selectedBaselineRunId: selectedIntegrityBaselineRunId,
      latestVsBaselineResult: latestVsBaselineChangeSummary?.result ?? null,
      unresolvedIssueCount: latestRun?.unresolvedIssueCount ?? 0,
      blockingIssueCount: latestRun?.blockingErrorCount ?? 0,
      repairableIssueCount: latestRun?.repairableErrorCount ?? 0,
      storageWarning: integrityStorageUsage.warningLevel,
      historyValidationStatus: integrityHistoryValidation.status,
      diagnosticsStatus: integrityDiagnosticsSummary?.overallStatus ?? 'Not Run',
    };
  }, [
    integrityAuditRuns,
    integrityHealthScore,
    integrityHealthSummary,
    selectedIntegrityBaselineRunId,
    latestVsBaselineChangeSummary,
    integrityStorageUsage.warningLevel,
    integrityHistoryValidation.status,
    integrityDiagnosticsSummary,
  ]);

  const appendInternalRepairBackup = (target: StorageTarget, rawValue: string) => {
    const current = safeReadStorageValue(INTEGRITY_REPAIR_BACKUP_STORAGE_KEY);
    let existing: Array<{ id: string; target: StorageTarget; createdAt: string; rawValue: string }> = [];
    if (current) {
      try {
        const parsed = JSON.parse(current);
        if (Array.isArray(parsed)) {
          existing = parsed.filter((entry) => entry && typeof entry === 'object') as Array<{
            id: string;
            target: StorageTarget;
            createdAt: string;
            rawValue: string;
          }>;
        }
      } catch {
        existing = [];
      }
    }
    const next = [
      {
        id: crypto.randomUUID(),
        target,
        createdAt: new Date().toISOString(),
        rawValue,
      },
      ...existing,
    ].slice(0, 20);
    window.localStorage.setItem(INTEGRITY_REPAIR_BACKUP_STORAGE_KEY, JSON.stringify(next));
  };

  const applyIntegrityRepairs = (
    selectedIssueIds: string[],
  ): {
    ok: boolean;
    message: string;
    appliedCount: number;
    unresolvedCount: number;
  } => {
    if (selectedIssueIds.length === 0) {
      const beforeFingerprints = new Set(
        integrityAuditReport?.issues.map(buildIntegrityIssueFingerprint) ?? [],
      );
      const nextReport = integrityAuditReport ?? runIntegrityAudit('after-repair');
      recordSimulationAccuracy([], nextReport, beforeFingerprints);
      return {
        ok: false,
        message: 'No repairable issues selected.',
        appliedCount: 0,
        unresolvedCount: nextReport.issueCount,
      };
    }
    runIntegrityAudit('before-repair');

    const operations = integrityRepairOperationsRef.current;
    const activeRawValue = safeReadStorageValue(LOCAL_STORAGE_KEY);
    const snapshotRawValue = safeReadStorageValue(LOCAL_SNAPSHOT_STORAGE_KEY);
    let activeTripDraft: Record<string, unknown> | null = null;
    let snapshotDraft: unknown[] | null = null;
    if (activeRawValue) {
      try {
        const parsed = JSON.parse(activeRawValue);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          activeTripDraft = parsed as Record<string, unknown>;
        }
      } catch {
        activeTripDraft = null;
      }
    }
    if (snapshotRawValue) {
      try {
        const parsed = JSON.parse(snapshotRawValue);
        if (Array.isArray(parsed)) {
          snapshotDraft = parsed;
        }
      } catch {
        snapshotDraft = null;
      }
    }

    const selectedSet = new Set(selectedIssueIds);
    const selectedIssues =
      integrityAuditReport?.issues.filter((issue) => selectedSet.has(issue.id) && issue.automaticRepairAvailable) ?? [];
    const activeTripWillChange = selectedIssues.some((issue) => issue.target === 'active-trip');
    const snapshotsWillChange = selectedIssues.some((issue) => issue.target === 'snapshot-history');

    if (activeTripWillChange) {
      const preRepairSnapshot = {
        ...makeSnapshot(history.present),
        pinned: true,
        label: 'Pre-repair active trip',
        notes: 'Auto-created before integrity repairs.',
      };
      setSnapshots((currentSnapshots) => applySnapshotRetention([preRepairSnapshot, ...currentSnapshots]));
    }

    if (snapshotsWillChange && snapshotRawValue !== null) {
      appendInternalRepairBackup('snapshot-history', snapshotRawValue);
    }

    let appliedCount = 0;
    for (const issueId of selectedIssueIds) {
      const operation = operations.get(issueId);
      if (!operation) {
        continue;
      }
      operation({ activeTripDraft, snapshotDraft });
      appliedCount += 1;
    }

    if (activeTripWillChange && activeTripDraft) {
      const serialized = JSON.stringify(activeTripDraft);
      window.localStorage.setItem(LOCAL_STORAGE_KEY, serialized);
      const reparsed = parsePersistedTripStorage(serialized);
      setHistory({
        past: [],
        present: reparsed.trip,
        future: [],
      });
      setActiveTripCorruption(reparsed.corruption);
      setActiveTripParseStatus(reparsed.parseStatus);
      setActiveTripRawPayloadSize(reparsed.rawPayloadSize);
      setActiveTripPersistenceError(null);
    }

    if (snapshotsWillChange && snapshotDraft) {
      const serialized = JSON.stringify(snapshotDraft);
      window.localStorage.setItem(LOCAL_SNAPSHOT_STORAGE_KEY, serialized);
      const reparsed = parsePersistedSnapshotStorage(serialized);
      setSnapshots(reparsed.snapshots);
      setSnapshotHistoryCorruption(reparsed.corruption);
      setSnapshotHistoryParseStatus(reparsed.parseStatus);
      setSnapshotHistoryRawPayloadSize(reparsed.rawPayloadSize);
      setSnapshotHistoryPersistenceError(null);
    }

    setLastSuccessfulPersistenceAt(new Date().toISOString());
    const beforeRepairFingerprints = new Set(
      integrityAuditReport?.issues.map(buildIntegrityIssueFingerprint) ?? [],
    );
    const nextReport = runIntegrityAudit('after-repair');
    recordSimulationAccuracy(selectedIssueIds, nextReport, beforeRepairFingerprints);
    return {
      ok: true,
      message: `Applied ${appliedCount} repair${appliedCount === 1 ? '' : 's'}.`,
      appliedCount,
      unresolvedCount: nextReport.issueCount,
    };
  };

  const clearIntegrityAudit = () => {
    setIntegrityAuditReport(null);
    setLastIntegrityRepairSimulation(null);
    setLastIntegritySimulationAccuracy(null);
    integrityRepairOperationsRef.current = new Map();
  };

  const retryParseActiveTripStorage = (): { ok: boolean; message: string } => {
    const parsedResult = parsePersistedTripStorage(safeReadStorageValue(LOCAL_STORAGE_KEY));
    setActiveTripRawPayloadSize(parsedResult.rawPayloadSize);
    setActiveTripParseStatus(parsedResult.parseStatus);
    if (parsedResult.corruption) {
      setActiveTripCorruption(parsedResult.corruption);
      return { ok: false, message: parsedResult.corruption.message };
    }
    setActiveTripCorruption(null);
    setActiveTripPersistenceError(null);
    setHistory({
      past: [],
      present: parsedResult.trip,
      future: [],
    });
    return { ok: true, message: 'Active trip storage parsed successfully.' };
  };

  const retryParseSnapshotHistoryStorage = (): { ok: boolean; message: string } => {
    const parsedResult = parsePersistedSnapshotStorage(safeReadStorageValue(LOCAL_SNAPSHOT_STORAGE_KEY));
    setSnapshotHistoryRawPayloadSize(parsedResult.rawPayloadSize);
    setSnapshotHistoryParseStatus(parsedResult.parseStatus);
    if (parsedResult.corruption) {
      setSnapshotHistoryCorruption(parsedResult.corruption);
      return { ok: false, message: parsedResult.corruption.message };
    }
    setSnapshotHistoryCorruption(null);
    setSnapshotHistoryPersistenceError(null);
    setSnapshots(parsedResult.snapshots);
    return { ok: true, message: 'Snapshot history storage parsed successfully.' };
  };

  const resetCorruptedActiveTrip = (): { ok: boolean; message: string } => {
    const seeded = cloneTrip(seededTrip);
    const serialized = JSON.stringify(seeded);
    window.localStorage.setItem(LOCAL_STORAGE_KEY, serialized);
    setHistory({
      past: [],
      present: seeded,
      future: [],
    });
    setActiveTripCorruption(null);
    setActiveTripParseStatus('valid');
    setActiveTripRawPayloadSize(bytesInString(serialized));
    setActiveTripPersistenceError(null);
    setLastSuccessfulPersistenceAt(new Date().toISOString());
    return { ok: true, message: 'Corrupted active trip reset to seeded trip.' };
  };

  const clearCorruptedSnapshotHistory = (): { ok: boolean; message: string } => {
    window.localStorage.removeItem(LOCAL_SNAPSHOT_STORAGE_KEY);
    setSnapshots([]);
    setSnapshotHistoryCorruption(null);
    setSnapshotHistoryParseStatus('missing');
    setSnapshotHistoryRawPayloadSize(0);
    setSnapshotHistoryPersistenceError(null);
    setLastSuccessfulPersistenceAt(new Date().toISOString());
    return { ok: true, message: 'Corrupted snapshot history has been cleared.' };
  };

  const buildCorruptedRawPayloadExport = (target: StorageTarget): string => {
    const key = target === 'active-trip' ? LOCAL_STORAGE_KEY : LOCAL_SNAPSHOT_STORAGE_KEY;
    const rawValue = safeReadStorageValue(key);
    if (rawValue === null) {
      throw new Error(`No raw payload found for ${target}.`);
    }
    return JSON.stringify(
      {
        target,
        storageKey: key,
        exportedAt: new Date().toISOString(),
        rawValue,
      },
      null,
      2,
    );
  };

  const corruptedRawPayloadFileName = (target: StorageTarget): string =>
    target === 'active-trip'
      ? `travel-buddy-corrupt-trip-${formatDiagnosticsTimestamp(new Date())}.json`
      : `travel-buddy-corrupt-snapshots-${formatDiagnosticsTimestamp(new Date())}.json`;

  const mostRecentPersistenceError = useMemo(() => {
    if (!activeTripPersistenceError && !snapshotHistoryPersistenceError) {
      return null;
    }
    if (!activeTripPersistenceError) {
      return snapshotHistoryPersistenceError;
    }
    if (!snapshotHistoryPersistenceError) {
      return activeTripPersistenceError;
    }
    return new Date(activeTripPersistenceError.occurredAt) >= new Date(snapshotHistoryPersistenceError.occurredAt)
      ? activeTripPersistenceError
      : snapshotHistoryPersistenceError;
  }, [activeTripPersistenceError, snapshotHistoryPersistenceError]);

  const storageHealth = useMemo<StorageHealthSummary>(() => {
    const pinnedSnapshotCount = snapshots.filter((snapshot) => snapshot.pinned).length;
    const unpinnedSnapshotCount = snapshots.length - pinnedSnapshotCount;
    return {
      activeTripStorageStatus: activeTripPersistenceError || activeTripCorruption ? 'error' : 'healthy',
      snapshotHistoryStorageStatus: snapshotHistoryPersistenceError || snapshotHistoryCorruption ? 'error' : 'healthy',
      totalSnapshotCount: snapshots.length,
      pinnedSnapshotCount,
      unpinnedSnapshotCount,
      estimatedStoredBytes: bytesInString(JSON.stringify(history.present)) + bytesInString(JSON.stringify(snapshots)),
      lastSuccessfulPersistenceAt,
      mostRecentPersistenceError,
      activeTripPersistenceError,
      snapshotHistoryPersistenceError,
    };
  }, [
    activeTripCorruption,
    activeTripPersistenceError,
    history.present,
    lastSuccessfulPersistenceAt,
    mostRecentPersistenceError,
    snapshotHistoryCorruption,
    snapshotHistoryPersistenceError,
    snapshots,
  ]);

  const storageDiagnostics = useMemo<StorageDiagnosticsSummary>(() => {
    const pinnedSnapshotCount = snapshots.filter((snapshot) => snapshot.pinned).length;
    const unpinnedSnapshotCount = snapshots.length - pinnedSnapshotCount;
    return {
      applicationVersion: APPLICATION_VERSION,
      backupVersion: BACKUP_VERSION,
      snapshotHistoryVersion: SNAPSHOT_HISTORY_VERSION,
      activeTripStorageKey: LOCAL_STORAGE_KEY,
      snapshotHistoryStorageKey: LOCAL_SNAPSHOT_STORAGE_KEY,
      activeTripRawPayloadSize,
      snapshotHistoryRawPayloadSize,
      totalEstimatedStoredSize: activeTripRawPayloadSize + snapshotHistoryRawPayloadSize,
      activeTripParseStatus,
      snapshotHistoryParseStatus,
      lastSuccessfulPersistenceAt,
      latestActiveTripPersistenceError: activeTripPersistenceError,
      latestSnapshotHistoryPersistenceError: snapshotHistoryPersistenceError,
      totalSnapshotCount: snapshots.length,
      pinnedSnapshotCount,
      unpinnedSnapshotCount,
      browserTimestamp: new Date().toISOString(),
    };
  }, [
    activeTripParseStatus,
    activeTripPersistenceError,
    activeTripRawPayloadSize,
    lastSuccessfulPersistenceAt,
    snapshotHistoryParseStatus,
    snapshotHistoryPersistenceError,
    snapshotHistoryRawPayloadSize,
    snapshots,
  ]);

  const diagnosticsFileName = (): string => `travel-buddy-diagnostics-${formatDiagnosticsTimestamp(new Date())}.json`;

  const toDiagnosticsJson = (): string =>
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        applicationVersion: storageDiagnostics.applicationVersion,
        backupVersion: storageDiagnostics.backupVersion,
        snapshotHistoryVersion: storageDiagnostics.snapshotHistoryVersion,
        activeTripStorageKey: storageDiagnostics.activeTripStorageKey,
        snapshotHistoryStorageKey: storageDiagnostics.snapshotHistoryStorageKey,
        activeTripRawPayloadSize: storageDiagnostics.activeTripRawPayloadSize,
        snapshotHistoryRawPayloadSize: storageDiagnostics.snapshotHistoryRawPayloadSize,
        totalEstimatedStoredSize: storageDiagnostics.totalEstimatedStoredSize,
        activeTripParseStatus: storageDiagnostics.activeTripParseStatus,
        snapshotHistoryParseStatus: storageDiagnostics.snapshotHistoryParseStatus,
        lastSuccessfulPersistenceAt: storageDiagnostics.lastSuccessfulPersistenceAt,
        latestActiveTripPersistenceError: storageDiagnostics.latestActiveTripPersistenceError,
        latestSnapshotHistoryPersistenceError: storageDiagnostics.latestSnapshotHistoryPersistenceError,
        totalSnapshotCount: storageDiagnostics.totalSnapshotCount,
        pinnedSnapshotCount: storageDiagnostics.pinnedSnapshotCount,
        unpinnedSnapshotCount: storageDiagnostics.unpinnedSnapshotCount,
        browserTimestamp: storageDiagnostics.browserTimestamp,
      },
      null,
      2,
    );

  const tripOverview = useMemo(() => buildTripOverview(history.present), [history.present]);
  const budgetSummary = useMemo(() => calculateBudgetSummary(history.present), [history.present]);
  const packingProgress = useMemo(
    () => calculatePackingProgress(history.present.packingLists),
    [history.present.packingLists],
  );
  const itineraryDays = useMemo(() => summarizeItineraryByDay(history.present.stops), [history.present.stops]);
  const itineraryConflicts = useMemo(() => detectItineraryConflicts(history.present.stops), [history.present.stops]);
  const itineraryTotalCost = useMemo(
    () => calculateItineraryTotalCost(history.present.stops),
    [history.present.stops],
  );
  const vaultTrips = useMemo(
    () => filterAndSortVaultTrips(vault.trips, { query: vaultQuery, filter: vaultFilter, sort: vaultSort }),
    [vault.trips, vaultQuery, vaultFilter, vaultSort],
  );
  const globalSearchResults = useMemo(
    () => searchVault(vault.trips, globalSearchQuery),
    [vault.trips, globalSearchQuery],
  );
  const documentExpiryReminders = useMemo(
    () => collectDocumentExpiryReminders(vault.trips),
    [vault.trips],
  );
  const visibleTemplates = useMemo(() => filterTemplates(templates, vaultQuery), [templates, vaultQuery]);
  const activeVaultTrip = useMemo(() => toVaultTrip(history.present, vault.activeTripId), [history.present, vault.activeTripId]);
  const exportTripJournalSummary = () =>
    exportJournalSummary(
      activeVaultTrip.tripName,
      activeVaultTrip.destination,
      activeVaultTrip.journalEntries ?? [],
    );
  const smartAssistance = useMemo(() => buildSmartAssistance(activeVaultTrip), [activeVaultTrip]);
  const onboardingProgressValue = useMemo(() => computeOnboardingProgress(onboardingState), [onboardingState]);
  const notifications = useMemo(() => visibleNotifications(notificationState), [notificationState]);
  const unreadNotifications = useMemo(() => unreadNotificationCount(notificationState), [notificationState]);
  const syncSummary = useMemo(() => syncQueueSummary(syncState), [syncState]);
  const commandCentre = useMemo(
    () => buildCommandCentre(vault.trips, vault.activeTripId, notifications),
    [vault.trips, vault.activeTripId, notifications],
  );
  const canEditTrip = assertCanEdit(currentUserRole).ok;
  const canManageMembers = assertCanManageMembers(currentUserRole).ok;

  return {
    trip: history.present,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    sortedStops: sortStops(history.present.stops),
    addStop,
    editStop,
    updateStopDetails,
    deleteStop,
    duplicateStop,
    reorderStop,
    toggleStopLock,
    saveItineraryVersion,
    restoreItineraryVersion,
    upsertSavedSearch,
    deleteSavedSearch,
    generateAndPreviewAiPlan,
    applyAiTravelPlan,
    saveTripSetup,
    createDraftTrip,
    updatePlannedBudget,
    startNewTripDraft,
    upsertBooking,
    deleteBooking,
    upsertExpense,
    deleteExpense,
    upsertPackingList,
    deletePackingList,
    upsertPackingItem,
    deletePackingItem,
    applyPackingTemplate,
    upsertTraveller,
    deleteTraveller,
    tripOverview,
    budgetSummary,
    packingProgress,
    itineraryDays,
    itineraryConflicts,
    itineraryTotalCost,
    packingTemplates: DEFAULT_PACKING_TEMPLATES,
    vault,
    vaultTrips,
    vaultQuery,
    setVaultQuery,
    vaultFilter,
    setVaultFilter,
    vaultSort,
    setVaultSort,
    openVaultTrip,
    createVaultTripEntry,
    archiveVaultTrip,
    restoreVaultTrip,
    updateVaultTripMeta,
    duplicateVaultTrip,
    deleteVaultTrip,
    toggleVaultFavourite,
    templates,
    visibleTemplates,
    saveTripAsTemplate,
    createTripFromTemplate,
    deleteTripTemplate,
    upsertDocument,
    deleteDocument,
    documentExpiryReminders,
    inviteCollaborator,
    updateCollaboratorRole,
    revokeCollaborator,
    applyCollaboratorInvitationAction,
    canPerform,
    currentUserRole,
    canEditTrip,
    canManageMembers,
    globalSearchQuery,
    setGlobalSearchQuery,
    globalSearchResults,
    importVaultBackup,
    importTemplatesBackup,
    toVaultBackupJson,
    rescheduleStopDate,
    activeVaultTrip,
    upsertDestination,
    deleteDestination,
    upsertFlight,
    deleteFlight,
    upsertStay,
    deleteStay,
    upsertGroundTransport,
    deleteGroundTransport,
    upsertSavedPlace,
    deleteSavedPlace,
    upsertDailyRoute,
    deleteDailyRoute,
    upsertChecklistItem,
    deleteChecklistItem,
    applyPreDepartureChecklistTemplate,
    updateEmergencyCentre,
    startLostPassportWorkflow,
    startLostLuggageWorkflow,
    upsertJournalEntry,
    deleteJournalEntry,
    exportTripJournalSummary,
    smartAssistance,
    onboardingState,
    onboardingProgress: onboardingProgressValue,
    completeOnboardingStep: (step: OnboardingStepId) =>
      setOnboardingState((current) => applyCompleteOnboardingStep(current, step)),
    dismissOnboarding: () => setOnboardingState((current) => applyDismissOnboarding(current)),
    resetOnboarding: () => setOnboardingState(createResetOnboardingState()),
    dealEngineState,
    setDealScoringWeights: (weights: Partial<ScoringWeights>) =>
      setDealEngineState((current) => ({
        ...current,
        scoringWeights: { ...current.scoringWeights, ...weights },
      })),
    setActiveDealPreferenceProfile: (id: string | null) =>
      setDealEngineState((current) => ({ ...current, activePreferenceProfileId: id })),
    upsertDealPreferenceProfile: (profile: TravellerPreferenceProfile) =>
      setDealEngineState((current) => {
        const exists = current.preferenceProfiles.some((entry) => entry.id === profile.id);
        return {
          ...current,
          preferenceProfiles: exists
            ? current.preferenceProfiles.map((entry) => (entry.id === profile.id ? profile : entry))
            : [...current.preferenceProfiles, profile],
        };
      }),
    createDealPreferenceProfile: (name: string) => {
      const profile = createDefaultPreferenceProfile({ name, id: `pref-${crypto.randomUUID()}` });
      setDealEngineState((current) => ({
        ...current,
        preferenceProfiles: [...current.preferenceProfiles, profile],
        activePreferenceProfileId: profile.id,
      }));
      return profile;
    },
    overrideActiveDealPreferences: (overrides: Partial<TravellerPreferenceProfile>) =>
      setDealEngineState((current) => {
        const active = current.preferenceProfiles.find(
          (entry) => entry.id === current.activePreferenceProfileId,
        );
        if (!active) return current;
        const next = applyPreferenceOverrides(active, overrides);
        return {
          ...current,
          preferenceProfiles: current.preferenceProfiles.map((entry) =>
            entry.id === next.id ? next : entry,
          ),
        };
      }),
    addDealShortlistItem: (offer: UniversalOffer, notes?: string) =>
      setDealEngineState((current) => {
        const item = createShortlistItem(offer, notes);
        if (current.shortlist.some((entry) => entry.offerId === item.offerId)) return current;
        return { ...current, shortlist: [item, ...current.shortlist] };
      }),
    removeDealShortlistItem: (id: string) =>
      setDealEngineState((current) => ({
        ...current,
        shortlist: current.shortlist.filter((entry) => entry.id !== id),
      })),
    replaceDealShortlist: (items: ShortlistItem[]) =>
      setDealEngineState((current) => ({ ...current, shortlist: items })),
    setDealBookingChecklist: (checklist: DealEngineState['bookingChecklist']) =>
      setDealEngineState((current) => ({ ...current, bookingChecklist: checklist })),
    setDealPriceAlerts: (alerts: DealEngineState['priceAlerts']) =>
      setDealEngineState((current) => ({ ...current, priceAlerts: alerts })),
    appendDealPriceSnapshots: (snapshots: DealEngineState['priceSnapshots']) =>
      setDealEngineState((current) => ({
        ...current,
        priceSnapshots: [...current.priceSnapshots, ...snapshots].slice(-500),
      })),
    appendDealAttributionEvents: (events: DealEngineState['attributionEvents']) =>
      setDealEngineState((current) => ({
        ...current,
        attributionEvents: [...current.attributionEvents, ...events],
      })),
    setDealOnboardingRecords: (records: DealEngineState['onboardingRecords']) =>
      setDealEngineState((current) => ({ ...current, onboardingRecords: records })),
    setDealLastSearchMeta: (meta: DealEngineState['lastSearchMeta']) =>
      setDealEngineState((current) => ({ ...current, lastSearchMeta: meta })),
    importDealEngineState: (raw: unknown) =>
      setDealEngineState(migrateDealEngineState(raw)),
    resetDealEngineState: () => setDealEngineState(createEmptyDealEngineState()),
    finalisationState,
    setPendingImportReview: (draft: ImportReviewDraft | null) =>
      setFinalisationState((current) => ({ ...current, pendingImportReview: draft })),
    commitImportReview: () => {
      const draft = finalisationState.pendingImportReview;
      if (!draft) return { ok: false as const, message: 'No pending import review.' };
      const selected = selectedImportEntities(draft);
      updateTrip((trip) => {
        const nextBookings = [...trip.bookings];
        for (const entity of selected) {
          if (entity.kind === 'traveller') continue;
          nextBookings.push({
            id: crypto.randomUUID(),
            type:
              entity.kind === 'flight'
                ? 'flight'
                : entity.kind === 'accommodation'
                  ? 'hotel'
                  : entity.kind === 'ground_transport'
                    ? 'transport'
                    : entity.kind === 'activity'
                      ? 'activity'
                      : 'other',
            title: entity.title,
            provider: draft.sourceKind,
            confirmationNumber: entity.confirmationNumber ?? '',
            startDate: entity.startDate ?? '',
            endDate: entity.endDate ?? entity.startDate ?? '',
            startTime: entity.startTime ?? '',
            endTime: entity.endTime ?? '',
            location: entity.location ?? '',
            cost: 0,
            currency: trip.currency,
            status: 'planned',
            notes: `Imported via universal import (${entity.confidence}% confidence)`,
            link: '',
            attachmentName: draft.fileName,
            attachmentMimeType: '',
          });
        }
        const nextTravellers = [...trip.travellers];
        for (const entity of selected.filter((item) => item.kind === 'traveller')) {
          nextTravellers.push({
            id: crypto.randomUUID(),
            name: entity.title,
            dateOfBirth: '',
            nationality: '',
            dietaryRequirements: '',
            accessibilityNeeds: '',
            emergencyContactName: '',
            emergencyContactPhone: '',
            loyaltyPrograms: '',
            passportNumberLast4: '',
            passportExpiry: '',
            passportCountry: '',

            preferredName: '',
            countryOfResidence: '',
            homeAirport: '',
            preferredDepartureAirports: '',
            language: 'en',
            currency: 'USD',
            timeZone: '',
            travelPreferences: '',
            seatingPreference: '',
            cabinPreference: '',
            hotelPreferences: '',
            loyaltyMemberships: [],
            companions: [],
            identityDocumentType: '',
            identityDocumentExpiry: '',
          });
        }
        return {
          ...trip,
          bookings: nextBookings,
          travellers: nextTravellers,
        };
      }, { createSnapshot: true });
      setFinalisationState((current) => ({
        ...current,
        pendingImportReview: null,
        importHistory: [...current.importHistory, draft].slice(-50),
        analytics: trackEvent(current.analytics, 'import_completed', {
          saved: selected.length,
          source: draft.sourceKind,
        }),
      }));
      return { ok: true as const, message: `Saved ${selected.length} imported entit(y/ies).` };
    },
    runTripHealthAudit: () => {
      const report = auditTripHealth(history.present);
      setFinalisationState((current) => ({
        ...current,
        lastTripHealth: report,
        analytics: trackEvent(current.analytics, 'feature_opened', { score: report.score }, 'trip-health'),
      }));
      return report;
    },
    trackAnalyticsEvent: (
      name: AnalyticsEventName,
      metadata?: Record<string, string | number | boolean | null>,
      feature?: string,
    ) =>
      setFinalisationState((current) => ({
        ...current,
        analytics: trackEvent(current.analytics, name, metadata, feature),
      })),
    setFeatureFlagEnabled: (id: FeatureFlagId, enabled: boolean) =>
      setFinalisationState((current) => ({
        ...current,
        featureFlags: setFeatureFlag(current.featureFlags, id, enabled),
      })),
    authState,
    authProvider,
    emailVerified,
    authSignIn: async (email: string, password: string) => {
      const result = await liveSignIn(authState, email, password);
      setAuthState(result.state);
      setAuthProvider(result.provider);
      setEmailVerified(result.emailVerified);
      return result;
    },
    authSignUp: async (email: string, password: string, displayName: string) => {
      const result = await liveSignUp(authState, email, password, displayName);
      setAuthState(result.state);
      setAuthProvider(result.provider);
      setEmailVerified(result.emailVerified);
      return result;
    },
    authSignOut: async () => {
      const result = await liveSignOut(authState);
      setAuthState(result.state);
      setAuthProvider(result.provider);
      setEmailVerified(result.emailVerified);
      return result;
    },
    authForgotPassword: async (email: string) => {
      const result = await liveForgotPassword(authState, email);
      setAuthState(result.state);
      setAuthProvider(result.provider);
      return result;
    },
    authResetPassword: async (token: string, password: string) => {
      const result = await liveResetPassword(authState, token, password);
      setAuthState(result.state);
      setAuthProvider(result.provider);
      return result;
    },
    authEnterDemoMode: () => {
      setAuthProvider('local-demo');
      setEmailVerified(null);
      setAuthState(enterDemoMode());
    },
    authSetScreen: (screen: AuthScreen) => setAuthState((current) => setAuthScreen(current, screen)),
    authClearError: () => setAuthState((current) => clearAuthError(current)),
    authHydrateSession: async () => {
      const result = await hydrateAuthFromSession(authState);
      setAuthState(result.state);
      setAuthProvider(result.provider);
      setEmailVerified(result.emailVerified);
      return result;
    },
    syncState,
    syncSummary,
    queueEntityChange,
    runSync: async () => {
      const result = await runCloudSync(syncStateRef.current);
      setSyncState(result.state);
      return result;
    },
    retrySyncFailures: () => setSyncState((current) => retryFailedChanges(current)),
    setSyncNetwork: (network: 'online' | 'offline') => setSyncState((current) => setNetworkState(current, network)),
    migrateLocalToCloud: async () => {
      const result = await migrateLocalVaultToCloud(vault);
      setCloudMigrationMessage(result.ok ? result.value.message : result.message);
      return result;
    },
    cloudMigrationMessage,
    cloudPersistMessage,
    applyDraftPlanToActiveTrip,
    uploadDocumentFile: async (input: {
      tripId: string;
      documentId: string;
      fileName: string;
      mimeType: string;
      sizeBytes: number;
      bytes?: ArrayBuffer | Uint8Array | Blob | null;
    }) => uploadTravelDocument(input),
    createDocumentSignedUrl: async (path: string, expiresInSeconds?: number) =>
      createSignedDocumentUrl(path, expiresInSeconds),
    deleteDocumentFile: async (path: string, documentId?: string) => deleteTravelDocumentFile(path, documentId),
    validateDocumentUpload: validateDocumentFile,
    accountSettings,
    updateAccountSettingsLocal: (
      patch: Parameters<typeof updateAccountSettings>[1],
    ) => {
      setAccountSettings((current) => {
        const next = updateAccountSettings(current, patch);
        persistAccountSettings(next);
        return next;
      });
    },
    syncAccountSettings: async () => {
      const result = await syncAccountSettingsToCloud(accountSettingsRef.current);
      if (result.ok) setAccountSettings(result.value);
      return result;
    },
    exportAccountData: () =>
      exportAccountDataBundle({
        settings: accountSettingsRef.current,
        vaultJson: toVaultBackupJson(),
      }),
    evaluateAccountDeletionGuard: (confirmation: string) =>
      evaluateAccountDeletion({
        confirmation,
        activeTripCount: vault.trips.filter((trip) => trip.status !== 'archived').length,
        hasPendingSync: syncQueueSummary(syncStateRef.current).pending > 0 || syncQueueSummary(syncStateRef.current).failed > 0,
      }),
    requestAccountDeletion: async (confirmation: string) =>
      requestAccountDeletion({
        confirmation,
        activeTripCount: vault.trips.filter((trip) => trip.status !== 'archived').length,
        hasPendingSync: syncQueueSummary(syncStateRef.current).pending > 0 || syncQueueSummary(syncStateRef.current).failed > 0,
      }),
    applyCloudCollaboratorAction: async (memberId: string, action: 'accept' | 'revoke' | 'expire') => {
      const collab = activeVaultTrip.collaboration;
      const result = await applyCloudInvitationAction(collab, memberId, action, activeVaultTrip.id);
      if (result.ok) {
        applyCollaboratorInvitationAction(memberId, action);
      }
      return result;
    },
    persistCollaboratorInvite: async (member: Parameters<typeof persistInvitationToCloud>[1]) =>
      persistInvitationToCloud(activeVaultTrip.id, member),
    notifications,
    unreadNotifications,
    markNotificationRead: (id: string) =>
      setNotificationState((current) => {
        const next = applyMarkNotificationRead(current, id);
        persistNotificationState(next);
        return next;
      }),
    dismissNotification: (id: string) =>
      setNotificationState((current) => {
        const next = applyDismissNotification(current, id);
        persistNotificationState(next);
        return next;
      }),
    markAllNotificationsRead: () =>
      setNotificationState((current) => {
        const next = applyMarkAllNotificationsRead(current);
        persistNotificationState(next);
        return next;
      }),
    commandCentre,
    repositories,
    cloudAdapterPlan: SUPABASE_ADAPTER_PLAN,
    cloudRuntime,
    supabaseTargetVerification: SUPABASE_TARGET_VERIFICATION,
    storageKeyCatalog: STORAGE_KEYS,
    undo,
    redo,
    moveStop,
    searchStops,
    replaceTrip,
    parseTripBackup,
    toBackupJson,
    backupFileName,
    toSnapshotHistoryJson,
    snapshotHistoryFileName,
    resetTrip,
    clearLocalData,
    importTrip,
    parseTripBackupPreview,
    parseSnapshotHistoryBackup,
    snapshots,
    restoreSnapshot,
    deleteSnapshot,
    setSnapshotPinned,
    importSnapshotHistory,
    updateSnapshotDetails,
    getCleanupPreviewCount,
    cleanupSnapshots,
    retryPersistActiveTrip,
    retryPersistSnapshotHistory,
    retryPersistAll,
    retryParseActiveTripStorage,
    retryParseSnapshotHistoryStorage,
    resetCorruptedActiveTrip,
    clearCorruptedSnapshotHistory,
    activeTripCorruption,
    snapshotHistoryCorruption,
    storageDiagnostics,
    toDiagnosticsJson,
    diagnosticsFileName,
    buildCorruptedRawPayloadExport,
    corruptedRawPayloadFileName,
    integrityAuditReport,
    integrityAuditRuns,
    selectedIntegrityBaselineRunId,
    latestVsBaselineChangeSummary,
    integrityHealthScore,
    integrityHealthSummary,
    integrityTrendSummaries,
    integrityAuditStatistics,
    integritySeverityTotals,
    integrityStreakSummary,
    integrityStorageUsage,
    integrityHistoryValidation,
    integrityHistoryCompactionPreview,
    integrityOverview,
    integrityDiagnosticsSummary,
    integrityRuntimeMetrics,
    lastIntegrityRepairSimulation,
    lastIntegritySimulationAccuracy,
    runIntegrityAudit,
    getRepairImpactAnalysis,
    simulateSelectedRepairs,
    applyIntegrityRepairs,
    clearIntegrityAudit,
    toIntegrityAuditJson,
    integrityAuditFileName,
    toIntegrityHistoryJson,
    integrityHistoryFileName,
    parseIntegrityHistoryBackup,
    importIntegrityHistory,
    setIntegrityBaselineRun,
    clearIntegrityBaselineRun,
    deleteIntegrityRun,
    clearIntegrityHistory,
    compactIntegrityHistory,
    runIntegrityDiagnostics,
    integrityDiagnosticsFileName,
    toIntegrityDiagnosticsJson,
    integrityReportFileName,
    toIntegrityReportJson,
    storageHealth,
    storageKeys: STORAGE_KEYS,
    snapshotLabelLimit: SNAPSHOT_LABEL_LIMIT,
    snapshotNotesLimit: SNAPSHOT_NOTES_LIMIT,
    unpinnedSnapshotLimit: UNPINNED_SNAPSHOT_LIMIT,
  };
}

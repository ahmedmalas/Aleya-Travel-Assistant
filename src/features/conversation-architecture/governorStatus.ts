/**
 * Phase 5 — visible governor activation status for Draft preview diagnostics.
 * Does not change conversation behaviour; presentation/telemetry only.
 */

import {
  isArchitectureBehaviourSwitchActive,
  isVercelPreviewBuild,
} from './behaviourSwitch';
import type { DualRunComparison } from './dualRunComparison';

export type GovernorUiStatus = 'active' | 'legacy_fallback';

export type FailedGateDiagnostic = {
  id: string;
  detail: string;
};

export type GovernorTurnDiagnostics = {
  /** Visible label: Governor: active | Governor: legacy fallback */
  status: GovernorUiStatus;
  statusLabel: 'Governor: active' | 'Governor: legacy fallback';
  switchRequested: boolean;
  behaviourSwitchActive: boolean;
  failedGates: FailedGateDiagnostic[];
  /** Human-readable why legacy was used (null when active). */
  fallbackReason: string | null;
};

/**
 * Build visible diagnostics from a turn result comparison.
 */
export function buildGovernorTurnDiagnostics(input: {
  behaviourSwitchActive: boolean;
  dualRunComparison: DualRunComparison;
  switchRequested?: boolean;
}): GovernorTurnDiagnostics {
  const switchRequested =
    input.switchRequested ??
    input.dualRunComparison.behaviourSwitchRequested;
  const failedGates = input.dualRunComparison.gateResults
    .filter((g) => !g.passed)
    .map((g) => ({ id: g.id, detail: g.detail }));

  if (input.behaviourSwitchActive) {
    return {
      status: 'active',
      statusLabel: 'Governor: active',
      switchRequested,
      behaviourSwitchActive: true,
      failedGates: [],
      fallbackReason: null,
    };
  }

  let fallbackReason: string;
  if (!switchRequested) {
    fallbackReason = isVercelPreviewBuild()
      ? 'Behaviour switch not requested (unexpected on Preview)'
      : 'Behaviour switch off (production/local default)';
  } else if (failedGates.length > 0) {
    fallbackReason = `Activation gate(s) blocked: ${failedGates
      .map((g) => g.id)
      .join(', ')}`;
  } else if (!input.dualRunComparison.gatesPassed) {
    fallbackReason = 'Activation gates did not pass';
  } else {
    fallbackReason = 'Legacy path retained (switch inactive for this turn)';
  }

  return {
    status: 'legacy_fallback',
    statusLabel: 'Governor: legacy fallback',
    switchRequested,
    behaviourSwitchActive: false,
    failedGates,
    fallbackReason,
  };
}

/**
 * Idle/boot diagnostics before any turn (shows whether Preview would request switch).
 */
export function buildGovernorBootDiagnostics(
  env?: Record<string, string | boolean | undefined>,
): GovernorTurnDiagnostics {
  const switchRequested = isArchitectureBehaviourSwitchActive(env);
  if (switchRequested) {
    return {
      status: 'active',
      statusLabel: 'Governor: active',
      switchRequested: true,
      behaviourSwitchActive: true,
      failedGates: [],
      fallbackReason: null,
    };
  }
  return {
    status: 'legacy_fallback',
    statusLabel: 'Governor: legacy fallback',
    switchRequested: false,
    behaviourSwitchActive: false,
    failedGates: [],
    fallbackReason: isVercelPreviewBuild(env)
      ? 'Behaviour switch not requested (unexpected on Preview)'
      : 'Behaviour switch off (production/local default)',
  };
}

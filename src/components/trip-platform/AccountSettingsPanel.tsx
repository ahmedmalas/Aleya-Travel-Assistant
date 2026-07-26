import { useState } from 'react';
import { useSharedTripStore } from '../../store/TripStoreContext';
import { Field, Panel, PrimaryButton, SecondaryButton, StatusBanner, inputClassName } from './shared/ui';

export function AccountSettingsPanel() {
  const {
    accountSettings,
    updateAccountSettingsLocal,
    syncAccountSettings,
    exportAccountData,
    evaluateAccountDeletionGuard,
    requestAccountDeletion,
    migrateLocalToCloud,
    cloudMigrationMessage,
    cloudRuntime,
  } = useSharedTripStore();
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const deletion = evaluateAccountDeletionGuard(deleteConfirmation);

  return (
    <Panel
      title="Account & workspace settings"
      description="Profile, preferences, currency, timezone, notifications, data export, and account deletion safeguards."
    >
      {feedback ? <StatusBanner kind="info" message={feedback} /> : null}
      {cloudMigrationMessage ? <StatusBanner kind="info" message={cloudMigrationMessage} /> : null}
      <p className="mt-2 text-sm text-slate-300">
        Cloud runtime: {cloudRuntime.activeProvider} · env {cloudRuntime.env.ok ? 'ready' : 'local-demo'} · remote migrations{' '}
        {cloudRuntime.remoteMigrationsApplied ? 'applied' : 'not applied'}
      </p>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Field label="Display name" htmlFor="settings-name">
          <input
            id="settings-name"
            className={inputClassName}
            value={accountSettings.displayName}
            onChange={(e) => updateAccountSettingsLocal({ displayName: e.target.value })}
          />
        </Field>
        <Field label="Email" htmlFor="settings-email">
          <input
            id="settings-email"
            className={inputClassName}
            value={accountSettings.email}
            onChange={(e) => updateAccountSettingsLocal({ email: e.target.value })}
          />
        </Field>
        <Field label="Currency" htmlFor="settings-currency">
          <input
            id="settings-currency"
            className={inputClassName}
            value={accountSettings.currency}
            onChange={(e) => updateAccountSettingsLocal({ currency: e.target.value.toUpperCase() })}
          />
        </Field>
        <Field label="Time zone" htmlFor="settings-tz">
          <input
            id="settings-tz"
            className={inputClassName}
            value={accountSettings.timezone}
            onChange={(e) => updateAccountSettingsLocal({ timezone: e.target.value })}
          />
        </Field>
      </div>

      <fieldset className="mt-5 space-y-2">
        <legend className="text-sm font-semibold text-white">Notification settings</legend>
        {(Object.keys(accountSettings.notificationPreferences) as Array<keyof typeof accountSettings.notificationPreferences>).map(
          (key) => (
            <label key={key} className="flex items-center gap-2 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={accountSettings.notificationPreferences[key]}
                onChange={(e) =>
                  updateAccountSettingsLocal({
                    notificationPreferences: { [key]: e.target.checked },
                  })
                }
              />
              {key}
            </label>
          ),
        )}
      </fieldset>

      <div className="mt-5 flex flex-wrap gap-2">
        <PrimaryButton
          type="button"
          onClick={() =>
            void syncAccountSettings().then((result) =>
              setFeedback(result.ok ? 'Settings saved (local + cloud when available).' : result.message),
            )
          }
        >
          Save settings
        </PrimaryButton>
        <SecondaryButton
          type="button"
          onClick={() => {
            const blob = new Blob([exportAccountData()], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = 'travel-buddy-account-export.json';
            anchor.click();
            URL.revokeObjectURL(url);
            setFeedback('Account data export downloaded.');
          }}
        >
          Export data
        </SecondaryButton>
        <SecondaryButton
          type="button"
          onClick={() =>
            void migrateLocalToCloud().then((result) =>
              setFeedback(result.ok ? result.value.message : result.message),
            )
          }
        >
          Migrate local → cloud
        </SecondaryButton>
      </div>

      <div className="mt-8 rounded-2xl border border-rose-400/30 bg-rose-950/20 p-4">
        <h3 className="text-sm font-semibold text-rose-100">Account deletion safeguards</h3>
        <p className="mt-1 text-sm text-rose-100/80">
          Type <code>{deletion.confirmationPhrase}</code> after exporting data. Deletion stays blocked while trips or sync
          queues remain.
        </p>
        <Field label="Confirmation" htmlFor="delete-confirm">
          <input
            id="delete-confirm"
            className={inputClassName}
            value={deleteConfirmation}
            onChange={(e) => setDeleteConfirmation(e.target.value)}
          />
        </Field>
        {deletion.blockers.length > 0 ? (
          <ul className="mt-2 list-disc pl-5 text-sm text-rose-100/90">
            {deletion.blockers.map((blocker) => (
              <li key={blocker}>{blocker}</li>
            ))}
          </ul>
        ) : (
          <StatusBanner kind="info" message="Safeguards cleared — remote account deletion still requires a verified Supabase target." />
        )}
        <SecondaryButton
          type="button"
          disabled={!deletion.canDelete}
          className="mt-3"
          onClick={() => {
            void requestAccountDeletion(deleteConfirmation).then((result) => {
              if (!result.ok) {
                setFeedback(result.message);
                return;
              }
              setFeedback(`${result.value.cloudMessage} Shared-trip ownership is preserved for collaborators; transfer ownership before hard-delete when required.`);
            });
          }}
        >
          Request account deletion
        </SecondaryButton>
      </div>
    </Panel>
  );
}

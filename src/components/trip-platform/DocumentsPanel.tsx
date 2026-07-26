import { useState } from 'react';
import { useSharedTripStore } from '../../store/TripStoreContext';
import { DOCUMENT_TYPES, type TripDocument, type TripDocumentType } from '../../store/vaultDomain';
import { EmptyState, Field, Panel, PrimaryButton, SecondaryButton, StatusBanner, inputClassName } from './shared/ui';

const createDocument = (): TripDocument => ({
  id: crypto.randomUUID(),
  type: 'passport',
  title: '',
  holderName: '',
  documentNumberLast4: '',
  issuingCountry: '',
  issueDate: '',
  expiryDate: '',
  notes: '',
  attachmentName: '',
  attachmentMimeType: '',
  storagePath: '',
});

export function DocumentsPanel() {
  const {
    activeVaultTrip,
    upsertDocument,
    deleteDocument,
    documentExpiryReminders,
    uploadDocumentFile,
    deleteDocumentFile,
    validateDocumentUpload,
    createDocumentSignedUrl,
  } = useSharedTripStore();
  const [draft, setDraft] = useState<TripDocument>(createDocument());
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const saveDocument = async () => {
    if (!draft.title.trim()) {
      setFeedback('Document title is required.');
      return;
    }
    setBusy(true);
    try {
      let next = { ...draft };
      if (pendingFile) {
        const validation = validateDocumentUpload({
          fileName: pendingFile.name,
          mimeType: pendingFile.type || 'application/octet-stream',
          sizeBytes: pendingFile.size,
        });
        if (!validation.ok) {
          setFeedback(validation.message);
          return;
        }
        const upload = await uploadDocumentFile({
          tripId: activeVaultTrip.id,
          documentId: next.id,
          fileName: pendingFile.name,
          mimeType: pendingFile.type || 'application/octet-stream',
          sizeBytes: pendingFile.size,
          bytes: pendingFile,
        });
        if (!upload.ok) {
          setFeedback(upload.message);
          return;
        }
        next = {
          ...next,
          attachmentName: pendingFile.name,
          attachmentMimeType: pendingFile.type || 'application/octet-stream',
          storagePath: upload.value.path,
        };
      }
      upsertDocument(next);
      setDraft(createDocument());
      setPendingFile(null);
      setFeedback(
        next.storagePath
          ? `Document saved with storage path ${next.storagePath}.`
          : 'Document metadata saved.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel
      title="Travel documents"
      description="Save metadata and upload files to the private travel-documents bucket when signed in. Local placeholders remain offline."
    >
      {feedback ? <StatusBanner kind="info" message={feedback} /> : null}

      {documentExpiryReminders.length > 0 ? (
        <div className="mt-3 space-y-2">
          {documentExpiryReminders.slice(0, 5).map((reminder) => (
            <StatusBanner
              key={`${reminder.tripId}-${reminder.documentId}`}
              kind={reminder.severity === 'expired' ? 'error' : 'info'}
              message={`${reminder.tripName}: ${reminder.title} ${
                reminder.daysUntilExpiry < 0
                  ? `expired ${Math.abs(reminder.daysUntilExpiry)} day(s) ago`
                  : `expires in ${reminder.daysUntilExpiry} day(s)`
              }`}
            />
          ))}
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Field label="Title" htmlFor="doc-title">
          <input
            id="doc-title"
            className={inputClassName}
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />
        </Field>
        <Field label="Type" htmlFor="doc-type">
          <select
            id="doc-type"
            className={inputClassName}
            value={draft.type}
            onChange={(e) => setDraft({ ...draft, type: e.target.value as TripDocumentType })}
          >
            {DOCUMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Holder name" htmlFor="doc-holder">
          <input
            id="doc-holder"
            className={inputClassName}
            value={draft.holderName}
            onChange={(e) => setDraft({ ...draft, holderName: e.target.value })}
          />
        </Field>
        <Field label="Number last 4" htmlFor="doc-last4">
          <input
            id="doc-last4"
            className={inputClassName}
            value={draft.documentNumberLast4}
            onChange={(e) => setDraft({ ...draft, documentNumberLast4: e.target.value })}
          />
        </Field>
        <Field label="Issuing country" htmlFor="doc-country">
          <input
            id="doc-country"
            className={inputClassName}
            value={draft.issuingCountry}
            onChange={(e) => setDraft({ ...draft, issuingCountry: e.target.value })}
          />
        </Field>
        <Field label="Issue date" htmlFor="doc-issue">
          <input
            id="doc-issue"
            type="date"
            className={inputClassName}
            value={draft.issueDate}
            onChange={(e) => setDraft({ ...draft, issueDate: e.target.value })}
          />
        </Field>
        <Field label="Expiry date" htmlFor="doc-expiry">
          <input
            id="doc-expiry"
            type="date"
            className={inputClassName}
            value={draft.expiryDate}
            onChange={(e) => setDraft({ ...draft, expiryDate: e.target.value })}
          />
        </Field>
        <div className="md:col-span-2 xl:col-span-3">
          <Field label="Notes" htmlFor="doc-notes">
            <textarea
              id="doc-notes"
              rows={2}
              className={inputClassName}
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            />
          </Field>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <Field label="Secure file upload" htmlFor="doc-file">
          <input
            id="doc-file"
            type="file"
            accept=".pdf,image/jpeg,image/png,image/webp,text/plain"
            className={inputClassName}
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              setPendingFile(file);
              if (file) {
                setDraft((current) => ({
                  ...current,
                  attachmentName: file.name,
                  attachmentMimeType: file.type,
                }));
              }
            }}
          />
        </Field>
        <PrimaryButton type="button" disabled={busy} onClick={() => void saveDocument()}>
          {busy ? 'Saving…' : 'Save document'}
        </PrimaryButton>
      </div>
      {pendingFile ? (
        <p className="mt-2 text-xs text-slate-400">
          Selected file will upload when you save: {pendingFile.name}
        </p>
      ) : null}

      <div className="mt-6 space-y-3">
        {activeVaultTrip.documents.length === 0 ? (
          <EmptyState title="No documents yet" body="Add passport/visa/insurance metadata for expiry reminders." />
        ) : (
          activeVaultTrip.documents.map((document) => (
            <article key={document.id} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="text-sm text-slate-300">
                  <p className="text-base font-medium text-white">{document.title}</p>
                  <p className="mt-1 uppercase tracking-[0.18em] text-sky-300">{document.type}</p>
                  <p className="mt-1">
                    {document.holderName || 'No holder'} · ****{document.documentNumberLast4 || '----'} ·{' '}
                    {document.issuingCountry || 'Country n/a'}
                  </p>
                  <p className="mt-1">
                    Expires {document.expiryDate || 'n/a'}
                    {document.attachmentName ? ` · File: ${document.attachmentName}` : ''}
                  </p>
                  {document.storagePath ? (
                    <p className="mt-1 break-all text-xs text-slate-400">Storage: {document.storagePath}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {document.storagePath && !document.storagePath.startsWith('local://') ? (
                    <SecondaryButton
                      type="button"
                      onClick={() => {
                        void createDocumentSignedUrl(document.storagePath).then((result) => {
                          if (!result.ok) {
                            setFeedback(result.message);
                            return;
                          }
                          if (result.value) window.open(result.value, '_blank', 'noopener,noreferrer');
                        });
                      }}
                    >
                      Open signed URL
                    </SecondaryButton>
                  ) : null}
                  <SecondaryButton type="button" onClick={() => setDraft(document)}>
                    Edit
                  </SecondaryButton>
                  <SecondaryButton
                    type="button"
                    onClick={() => {
                      if (document.storagePath) {
                        void deleteDocumentFile(document.storagePath, document.id);
                      }
                      deleteDocument(document.id);
                      setFeedback('Document deleted.');
                    }}
                  >
                    Delete
                  </SecondaryButton>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </Panel>
  );
}

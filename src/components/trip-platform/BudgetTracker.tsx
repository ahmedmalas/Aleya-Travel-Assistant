import { useState } from 'react';
import { EXPENSE_CATEGORIES, type Expense, type ExpenseCategory } from '../../store/tripDomain';
import { useSharedTripStore } from '../../store/TripStoreContext';
import {
  EmptyState,
  Field,
  Panel,
  PrimaryButton,
  SecondaryButton,
  StatusBanner,
  inputClassName,
} from './shared/ui';

const createExpense = (currency: string): Expense => ({
  id: crypto.randomUUID(),
  title: '',
  category: 'other',
  amount: 0,
  currency,
  date: '',
  paid: false,
  notes: '',

  deposit: 0,
  refund: 0,
  sharedTravellerIds: [],
  exchangeRateToTrip: 1,
  attachmentName: '',
});

export function BudgetTracker() {
  const { trip, budgetSummary, upsertExpense, deleteExpense, updatePlannedBudget } = useSharedTripStore();
  const [draft, setDraft] = useState<Expense>(createExpense(trip.currency));
  const [plannedBudget, setPlannedBudget] = useState(trip.budget);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleSaveExpense = () => {
    if (!draft.title.trim()) {
      setFeedback('Expense title is required.');
      return;
    }
    upsertExpense(draft);
    setDraft(createExpense(trip.currency));
    setFeedback('Expense saved.');
  };

  const handleUpdatePlannedBudget = () => {
    const result = updatePlannedBudget(plannedBudget, trip.currency);
    setFeedback(result.message);
  };

  return (
    <Panel title="Budget tracker" description="Compare planned budget with actual spending by category.">
      {feedback ? <StatusBanner kind="info" message={feedback} /> : null}
      {budgetSummary.overBudget ? (
        <div className="mt-3">
          <StatusBanner kind="error" message="Over-budget warning: spending exceeds the planned budget." />
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-sky-300">Planned</p>
          <p className="mt-2 text-xl font-semibold">{budgetSummary.plannedBudget.toFixed(2)} {budgetSummary.currency}</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-sky-300">Actual</p>
          <p className="mt-2 text-xl font-semibold">{budgetSummary.actualSpending.toFixed(2)} {budgetSummary.currency}</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-sky-300">Paid / unpaid</p>
          <p className="mt-2 text-xl font-semibold">
            {budgetSummary.paidSpending.toFixed(2)} / {budgetSummary.unpaidSpending.toFixed(2)}
          </p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-sky-300">Remaining</p>
          <p className={`mt-2 text-xl font-semibold ${budgetSummary.overBudget ? 'text-rose-300' : 'text-emerald-300'}`}>
            {budgetSummary.remainingBalance.toFixed(2)} {budgetSummary.currency}
          </p>
        </article>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <Field label="Planned budget" htmlFor="planned-budget">
          <input
            id="planned-budget"
            type="number"
            min={0}
            className={inputClassName}
            value={plannedBudget}
            onChange={(e) => setPlannedBudget(Number(e.target.value))}
          />
        </Field>
        <PrimaryButton type="button" onClick={handleUpdatePlannedBudget}>
          Update planned budget
        </PrimaryButton>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Field label="Expense title" htmlFor="expense-title">
          <input id="expense-title" className={inputClassName} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
        </Field>
        <Field label="Category" htmlFor="expense-category">
          <select id="expense-category" className={inputClassName} value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as ExpenseCategory })}>
            {EXPENSE_CATEGORIES.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </Field>
        <Field label="Amount" htmlFor="expense-amount">
          <input id="expense-amount" type="number" min={0} className={inputClassName} value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: Number(e.target.value) })} />
        </Field>
        <Field label="Date" htmlFor="expense-date">
          <input id="expense-date" type="date" className={inputClassName} value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
        </Field>
        <Field label="Currency" htmlFor="expense-currency">
          <input id="expense-currency" className={inputClassName} value={draft.currency} onChange={(e) => setDraft({ ...draft, currency: e.target.value.toUpperCase() })} />
        </Field>
        <Field label="FX rate → trip currency" htmlFor="expense-fx">
          <input
            id="expense-fx"
            type="number"
            min={0}
            step="0.0001"
            className={inputClassName}
            value={draft.exchangeRateToTrip}
            onChange={(e) => setDraft({ ...draft, exchangeRateToTrip: Number(e.target.value) || 1 })}
          />
        </Field>
        <Field label="Deposit" htmlFor="expense-deposit">
          <input
            id="expense-deposit"
            type="number"
            min={0}
            className={inputClassName}
            value={draft.deposit}
            onChange={(e) => setDraft({ ...draft, deposit: Number(e.target.value) || 0 })}
          />
        </Field>
        <Field label="Refund" htmlFor="expense-refund">
          <input
            id="expense-refund"
            type="number"
            min={0}
            className={inputClassName}
            value={draft.refund}
            onChange={(e) => setDraft({ ...draft, refund: Number(e.target.value) || 0 })}
          />
        </Field>
        <Field label="Shared traveller IDs" htmlFor="expense-shared">
          <input
            id="expense-shared"
            className={inputClassName}
            value={draft.sharedTravellerIds.join(',')}
            onChange={(e) =>
              setDraft({
                ...draft,
                sharedTravellerIds: e.target.value
                  .split(',')
                  .map((entry) => entry.trim())
                  .filter(Boolean),
              })
            }
            placeholder="traveller-id-1, traveller-id-2"
          />
        </Field>
        <Field label="Attachment name" htmlFor="expense-attachment">
          <input
            id="expense-attachment"
            className={inputClassName}
            value={draft.attachmentName}
            onChange={(e) => setDraft({ ...draft, attachmentName: e.target.value })}
          />
        </Field>
        <label className="flex items-center gap-2 text-sm text-slate-200">
          <input type="checkbox" checked={draft.paid} onChange={(e) => setDraft({ ...draft, paid: e.target.checked })} />
          Paid
        </label>
        <div className="md:col-span-2 xl:col-span-3">
          <Field label="Notes" htmlFor="expense-notes">
            <textarea id="expense-notes" rows={2} className={inputClassName} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} placeholder="Payment notes, receipts, split context…" />
          </Field>
        </div>
      </div>
      <div className="mt-3">
        <PrimaryButton type="button" onClick={handleSaveExpense}>Save expense</PrimaryButton>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-4">
          <h4 className="font-medium text-white">Category breakdown</h4>
          {budgetSummary.categoryBreakdown.length === 0 ? (
            <div className="mt-3">
              <EmptyState title="No spending yet" body="Add expenses to see category totals." />
            </div>
          ) : (
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              {budgetSummary.categoryBreakdown.map((entry) => (
                <li key={entry.category} className="flex justify-between rounded-xl border border-white/10 px-3 py-2">
                  <span>{entry.category}</span>
                  <span>
                    {entry.amount.toFixed(2)} ({entry.paidAmount.toFixed(2)} paid)
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-4">
          <h4 className="font-medium text-white">Expenses</h4>
          {trip.expenses.length === 0 ? (
            <div className="mt-3">
              <EmptyState title="No expenses" body="Log individual trip costs to track remaining balance." />
            </div>
          ) : (
            <ul className="mt-3 space-y-2">
              {trip.expenses.map((expense) => (
                <li key={expense.id} className="rounded-xl border border-white/10 px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-100">{expense.title}</p>
                      <p className="text-xs text-slate-400">
                        {expense.category} · {expense.date || 'No date'} · {expense.paid ? 'Paid' : 'Unpaid'} · FX{' '}
                        {expense.exchangeRateToTrip || 1}
                      </p>
                      <p className="mt-1 text-slate-300">
                        {expense.amount.toFixed(2)} {expense.currency}
                        {expense.deposit ? ` · deposit ${expense.deposit}` : ''}
                        {expense.refund ? ` · refund ${expense.refund}` : ''}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <SecondaryButton type="button" onClick={() => setDraft(expense)}>Edit</SecondaryButton>
                      <SecondaryButton type="button" onClick={() => deleteExpense(expense.id)}>Delete</SecondaryButton>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Panel>
  );
}

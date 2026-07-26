import type {
  Booking,
  Expense,
  ExpenseCategory,
  PackingList,
  TripData,
  TripStop,
} from './tripDomain';

export type BudgetSummary = {
  plannedBudget: number;
  actualSpending: number;
  paidSpending: number;
  unpaidSpending: number;
  remainingBalance: number;
  currency: string;
  overBudget: boolean;
  categoryBreakdown: Array<{ category: ExpenseCategory; amount: number; paidAmount: number }>;
};

export type PackingProgress = {
  totalItems: number;
  packedItems: number;
  progressPercent: number;
};

export type ItineraryConflict = {
  leftId: string;
  rightId: string;
  date: string;
  message: string;
};

export type DailyItinerarySummary = {
  date: string;
  day: number;
  items: TripStop[];
  totalCost: number;
  conflicts: ItineraryConflict[];
};

export type TripOverviewModel = {
  tripName: string;
  destination: string;
  departureDate: string;
  returnDate: string;
  travellerCount: number;
  daysUntilDeparture: number | null;
  budgetSummary: BudgetSummary;
  itineraryItemCount: number;
  bookingCount: number;
  packingProgress: PackingProgress;
  alerts: string[];
  recentActivity: TripData['activityLog'];
};

const timeToMinutes = (value: string): number | null => {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) {
    return null;
  }
  return Number(match[1]) * 60 + Number(match[2]);
};

const expenseAmountInTripCurrency = (expense: Expense): number => {
  const rate = Number.isFinite(expense.exchangeRateToTrip) && expense.exchangeRateToTrip > 0 ? expense.exchangeRateToTrip : 1;
  const gross = Math.max(0, expense.amount) + Math.max(0, expense.deposit ?? 0) - Math.max(0, expense.refund ?? 0);
  return Math.max(0, gross * rate);
};

export const calculateBudgetSummary = (trip: TripData): BudgetSummary => {
  const currency = trip.currency || 'USD';
  const actualSpending = trip.expenses.reduce((sum, expense) => sum + expenseAmountInTripCurrency(expense), 0);
  const paidSpending = trip.expenses
    .filter((expense) => expense.paid)
    .reduce((sum, expense) => sum + expenseAmountInTripCurrency(expense), 0);
  const unpaidSpending = actualSpending - paidSpending;
  const remainingBalance = trip.budget - actualSpending;
  const categories = new Map<ExpenseCategory, { amount: number; paidAmount: number }>();
  for (const expense of trip.expenses) {
    const amount = expenseAmountInTripCurrency(expense);
    const current = categories.get(expense.category) ?? { amount: 0, paidAmount: 0 };
    current.amount += amount;
    if (expense.paid) {
      current.paidAmount += amount;
    }
    categories.set(expense.category, current);
  }
  return {
    plannedBudget: trip.budget,
    actualSpending,
    paidSpending,
    unpaidSpending,
    remainingBalance,
    currency,
    overBudget: remainingBalance < 0,
    categoryBreakdown: [...categories.entries()]
      .map(([category, values]) => ({ category, ...values }))
      .sort((a, b) => b.amount - a.amount),
  };
};

export const calculatePackingProgress = (lists: PackingList[]): PackingProgress => {
  const allItems = lists.flatMap((list) => list.items);
  const totalItems = allItems.length;
  const packedItems = allItems.filter((item) => item.packed).length;
  return {
    totalItems,
    packedItems,
    progressPercent: totalItems === 0 ? 0 : Math.round((packedItems / totalItems) * 100),
  };
};

export const detectItineraryConflicts = (stops: TripStop[]): ItineraryConflict[] => {
  const conflicts: ItineraryConflict[] = [];
  const byDate = new Map<string, TripStop[]>();
  for (const stop of stops) {
    const key = stop.date || `day-${stop.day}`;
    const current = byDate.get(key) ?? [];
    current.push(stop);
    byDate.set(key, current);
  }
  for (const [date, dayStops] of byDate.entries()) {
    for (let i = 0; i < dayStops.length; i += 1) {
      for (let j = i + 1; j < dayStops.length; j += 1) {
        const left = dayStops[i];
        const right = dayStops[j];
        const leftStart = timeToMinutes(left.startTime);
        const leftEnd = timeToMinutes(left.endTime);
        const rightStart = timeToMinutes(right.startTime);
        const rightEnd = timeToMinutes(right.endTime);
        if (leftStart === null || leftEnd === null || rightStart === null || rightEnd === null) {
          continue;
        }
        if (leftStart < rightEnd && rightStart < leftEnd) {
          conflicts.push({
            leftId: left.id,
            rightId: right.id,
            date,
            message: `"${left.title}" overlaps "${right.title}"`,
          });
        }
      }
    }
  }
  return conflicts;
};

export const summarizeItineraryByDay = (stops: TripStop[]): DailyItinerarySummary[] => {
  const conflicts = detectItineraryConflicts(stops);
  const groups = new Map<string, TripStop[]>();
  for (const stop of stops) {
    const key = stop.date || `day-${stop.day}`;
    const current = groups.get(key) ?? [];
    current.push(stop);
    groups.set(key, current);
  }
  return [...groups.entries()]
    .map(([date, items]) => {
      const sorted = [...items].sort((a, b) => {
        if (a.startTime && b.startTime && a.startTime !== b.startTime) {
          return a.startTime.localeCompare(b.startTime);
        }
        return a.order - b.order;
      });
      return {
        date,
        day: sorted[0]?.day ?? 1,
        items: sorted,
        totalCost: sorted.reduce((sum, item) => sum + item.cost, 0),
        conflicts: conflicts.filter((conflict) => conflict.date === date),
      };
    })
    .sort((a, b) => {
      if (a.date.startsWith('day-') || b.date.startsWith('day-')) {
        return a.day - b.day;
      }
      return a.date.localeCompare(b.date);
    });
};

export const calculateItineraryTotalCost = (stops: TripStop[]): number =>
  stops.reduce((sum, stop) => sum + stop.cost, 0);

export const calculateBookingTotal = (bookings: Booking[]): number =>
  bookings.reduce((sum, booking) => sum + booking.cost, 0);

export const daysUntil = (isoDate: string, now = new Date()): number | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return null;
  }
  const target = new Date(`${isoDate}T00:00:00.000Z`);
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return Math.round((target.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
};

export const buildTripOverview = (trip: TripData, now = new Date()): TripOverviewModel => {
  const budgetSummary = calculateBudgetSummary(trip);
  const packingProgress = calculatePackingProgress(trip.packingLists);
  const conflicts = detectItineraryConflicts(trip.stops);
  const alerts: string[] = [];
  if (!trip.destination.trim()) {
    alerts.push('Destination is missing.');
  }
  if (!trip.departureDate || !trip.returnDate) {
    alerts.push('Trip dates are incomplete.');
  }
  if (budgetSummary.overBudget) {
    alerts.push('Trip is over budget.');
  }
  if (conflicts.length > 0) {
    alerts.push(`${conflicts.length} itinerary time conflict${conflicts.length === 1 ? '' : 's'} detected.`);
  }
  if (packingProgress.totalItems > 0 && packingProgress.progressPercent < 100) {
    alerts.push(`Packing is ${packingProgress.progressPercent}% complete.`);
  }
  const unpaidBookings = trip.bookings.filter((booking) => booking.status === 'planned').length;
  if (unpaidBookings > 0) {
    alerts.push(`${unpaidBookings} booking${unpaidBookings === 1 ? '' : 's'} still planned.`);
  }
  return {
    tripName: trip.tripName,
    destination: trip.destination,
    departureDate: trip.departureDate,
    returnDate: trip.returnDate,
    travellerCount: trip.travellerCount,
    daysUntilDeparture: daysUntil(trip.departureDate, now),
    budgetSummary,
    itineraryItemCount: trip.stops.length,
    bookingCount: trip.bookings.length,
    packingProgress,
    alerts,
    recentActivity: trip.activityLog.slice(0, 8),
  };
};

export const sumExpenses = (expenses: Expense[]): number => expenses.reduce((sum, expense) => sum + expense.amount, 0);

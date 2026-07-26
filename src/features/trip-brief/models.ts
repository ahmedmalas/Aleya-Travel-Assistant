export const budgetStyles = ['value', 'moderate', 'premium', 'luxury'] as const;

export type BudgetStyle = (typeof budgetStyles)[number];

export const interestTags = [
  'food',
  'culture',
  'shopping',
  'nature',
  'nightlife',
  'family',
  'relaxation',
] as const;

export type InterestTag = (typeof interestTags)[number];

export type TripBriefInput = {
  destination: string;
  startDate: string;
  endDate: string;
  travelers: number;
  budgetStyle: BudgetStyle;
  interests: InterestTag[];
  notes: string;
};

export type TripBriefValidationErrors = Partial<Record<keyof TripBriefInput, string>>;

export type TripPace = 'light' | 'balanced' | 'packed';

export type DraftPlan = {
  title: string;
  destination: string;
  durationDays: number;
  travelers: number;
  budgetStyle: BudgetStyle;
  tripPillars: string[];
  dailyPace: TripPace;
  nextSteps: string[];
  assumptions: string[];
  /** Suggested itinerary day titles derived from the brief (deterministic). */
  suggestedDays: string[];
};

export const defaultTripBrief: TripBriefInput = {
  destination: '',
  startDate: '',
  endDate: '',
  travelers: 1,
  budgetStyle: 'moderate',
  interests: [],
  notes: '',
};

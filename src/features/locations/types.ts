export type LocationKind =
  | 'airport'
  | 'city'
  | 'country'
  | 'neighbourhood'
  | 'landmark'
  | 'region'
  | 'other';

export type LocationSuggestion = {
  id: string;
  label: string;
  primary: string;
  secondary: string;
  kind: LocationKind;
  airportCode?: string;
  city?: string;
  country?: string;
  lat?: number;
  lon?: number;
  source: 'airport-catalog' | 'nominatim' | 'manual';
};

export type LocationSuggestMode = 'flight' | 'place' | 'any';

export type LocationSuggestState = {
  query: string;
  suggestions: LocationSuggestion[];
  loading: boolean;
  error: string | null;
  open: boolean;
};

import { useEffect, useRef, useState } from 'react';
import { suggestLocations } from './suggestLocations';
import type { LocationSuggestMode, LocationSuggestion } from './types';

export function useLocationSuggest(query: string, mode: LocationSuggestMode = 'any', enabled = true) {
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    const trimmed = query.trim();
    if (trimmed.length < 1) {
      setSuggestions([]);
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const id = ++requestId.current;
    setLoading(true);
    const timer = window.setTimeout(() => {
      void suggestLocations(trimmed, { mode, signal: controller.signal }).then((result) => {
        if (id !== requestId.current) return;
        setSuggestions(result.suggestions);
        setError(result.error);
        setLoading(false);
      });
    }, 180);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, mode, enabled]);

  return { suggestions, loading, error };
}

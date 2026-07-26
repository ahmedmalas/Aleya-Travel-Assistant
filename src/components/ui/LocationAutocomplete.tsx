import { useEffect, useId, useRef, useState } from 'react';
import { createManualLocation } from '../../features/locations/suggestLocations';
import type { LocationSuggestMode, LocationSuggestion } from '../../features/locations/types';
import { useLocationSuggest } from '../../features/locations/useLocationSuggest';
import { inputClassName } from '../trip-platform/shared/ui';

export type LocationAutocompleteProps = {
  id: string;
  label?: string;
  value: string;
  mode?: LocationSuggestMode;
  placeholder?: string;
  disabled?: boolean;
  onChange: (value: string, suggestion?: LocationSuggestion) => void;
  'aria-label'?: string;
};

export function LocationAutocomplete({
  id,
  value,
  mode = 'any',
  placeholder = 'Start typing a location…',
  disabled,
  onChange,
  'aria-label': ariaLabel,
}: LocationAutocompleteProps) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const { suggestions, loading, error } = useLocationSuggest(value, mode, open || value.trim().length > 0);

  useEffect(() => {
    setHighlight(0);
  }, [suggestions]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  const showList = open && value.trim().length > 0;
  const activeId = showList && suggestions[highlight] ? `${listboxId}-option-${highlight}` : undefined;

  const selectSuggestion = (suggestion: LocationSuggestion) => {
    onChange(suggestion.label, suggestion);
    setOpen(false);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showList) {
      if (event.key === 'ArrowDown' && value.trim()) {
        setOpen(true);
      }
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlight((index) => (suggestions.length === 0 ? 0 : (index + 1) % suggestions.length));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlight((index) =>
        suggestions.length === 0 ? 0 : (index - 1 + suggestions.length) % suggestions.length,
      );
    } else if (event.key === 'Enter') {
      const selected = suggestions[highlight];
      if (selected) {
        event.preventDefault();
        selectSuggestion(selected);
      }
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <input
        id={id}
        className={inputClassName}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={showList}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={activeId}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => {
          // Keep manual entry if provider failed / no pick.
          if (value.trim() && !suggestions.some((item) => item.label === value || item.airportCode === value)) {
            onChange(value, createManualLocation(value));
          }
        }}
      />
      {showList ? (
        <div
          id={listboxId}
          role="listbox"
          className="absolute z-40 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-white/15 bg-slate-950/95 p-1 shadow-2xl shadow-black/40"
        >
          {loading ? (
            <p className="px-3 py-2 text-xs text-slate-400" role="status">
              Searching locations…
            </p>
          ) : null}
          {!loading && error ? (
            <p className="px-3 py-2 text-xs text-amber-200" role="status">
              {error}. You can keep typing a location manually.
            </p>
          ) : null}
          {!loading && !error && suggestions.length === 0 ? (
            <p className="px-3 py-2 text-xs text-slate-400" role="status">
              No matches — keep typing or use your own location text.
            </p>
          ) : null}
          {suggestions.map((suggestion, index) => {
            const selected = index === highlight;
            return (
              <button
                key={suggestion.id}
                id={`${listboxId}-option-${index}`}
                type="button"
                role="option"
                aria-selected={selected}
                className={`flex w-full flex-col rounded-lg px-3 py-2 text-left text-sm ${
                  selected ? 'bg-sky-400/20 text-sky-50' : 'text-slate-100 hover:bg-white/5'
                }`}
                onMouseEnter={() => setHighlight(index)}
                onMouseDown={(event) => {
                  event.preventDefault();
                  selectSuggestion(suggestion);
                }}
              >
                <span className="font-medium">{suggestion.primary}</span>
                <span className="text-xs text-slate-400">
                  {suggestion.secondary}
                  {suggestion.kind !== 'other' ? ` · ${suggestion.kind}` : ''}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

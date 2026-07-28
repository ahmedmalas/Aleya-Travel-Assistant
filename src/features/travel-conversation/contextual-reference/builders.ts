/** Build structured option sets for known Aleya questions. */

import type { ActiveOptionSet, ConversationalOption } from './types';

let optionSetSeq = 0;

export function resetOptionSetSequence(): void {
  optionSetSeq = 0;
}

function nextIds(prefix: string): { id: string; sourceTurnId: string } {
  optionSetSeq += 1;
  const sourceTurnId = `${prefix}-turn-${optionSetSeq}`;
  return { id: `${prefix}-opts-${optionSetSeq}`, sourceTurnId };
}

function serviceOptions(): ConversationalOption[] {
  return [
    {
      id: 'flights',
      label: 'flights',
      value: 'flights',
      category: 'service',
      position: 1,
    },
    {
      id: 'accommodation',
      label: 'accommodation',
      value: 'accommodation',
      category: 'service',
      position: 2,
    },
    {
      id: 'car_hire',
      label: 'car hire',
      value: 'car_hire',
      category: 'service',
      position: 3,
    },
  ];
}

export function buildServicesOptionSet(question: string): ActiveOptionSet {
  const ids = nextIds('services');
  return {
    ...ids,
    question,
    options: serviceOptions(),
    selectionMode: 'multiple',
    awaitingField: 'services',
    createdAt: new Date().toISOString(),
  };
}

export function buildTripTypeOptionSet(question: string): ActiveOptionSet {
  const ids = nextIds('trip-type');
  return {
    ...ids,
    question,
    options: [
      {
        id: 'one_way',
        label: 'one-way',
        value: 'one_way',
        category: 'trip_type',
        position: 1,
      },
      {
        id: 'return',
        label: 'returning',
        value: 'return',
        category: 'trip_type',
        position: 2,
      },
    ],
    selectionMode: 'single',
    awaitingField: 'tripType',
    createdAt: new Date().toISOString(),
  };
}

/** Generic builder for tests and future preference / location questions. */
export function buildOptionSet(input: {
  prefix: string;
  question: string;
  selectionMode: 'single' | 'multiple';
  awaitingField?: string;
  options: Array<{
    id: string;
    label: string;
    value: unknown;
    category: ConversationalOption['category'];
  }>;
}): ActiveOptionSet {
  const ids = nextIds(input.prefix);
  return {
    ...ids,
    question: input.question,
    selectionMode: input.selectionMode,
    awaitingField: input.awaitingField,
    createdAt: new Date().toISOString(),
    options: input.options.map((o, i) => ({
      id: o.id,
      label: o.label,
      value: o.value,
      category: o.category,
      position: i + 1,
    })),
  };
}

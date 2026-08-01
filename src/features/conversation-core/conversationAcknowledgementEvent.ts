/**
 * Phase 16I — narrow deterministic acknowledgement-event contract.
 *
 * Emitted by acknowledgement selection from classification buckets and
 * propagated through reply components, the reply plan, and conversational
 * layer input. Does not own wording. Conversational transforms must not
 * re-derive this event from trip state or acknowledgement text.
 */

/** Travel fields that have dedicated set / changed / removed acknowledgements. */
export type AcknowledgementTravelField =
  | 'destination'
  | 'origin'
  | 'departureDate'
  | 'returnDate'
  | 'adultCount'
  | 'childCount'
  | 'infantCount'
  | 'restaurantPreference';

/**
 * Semantic event for the single selected acknowledgement of a turn.
 * `null` means no acknowledgement was selected.
 */
export type ConversationAcknowledgementEvent =
  | {
      readonly kind: 'field-set';
      readonly field: AcknowledgementTravelField;
    }
  | {
      readonly kind: 'field-changed';
      readonly field: AcknowledgementTravelField;
    }
  | {
      readonly kind: 'field-removed';
      readonly field: AcknowledgementTravelField;
    }
  | {
      readonly kind: 'capability-enabled';
      readonly capabilities: readonly string[];
    }
  | {
      readonly kind: 'capability-disabled';
      readonly capabilities: readonly string[];
    }
  | {
      readonly kind: 'generic';
    }
  | null;

/** Non-null acknowledgement event (present when acknowledgement text is selected). */
export type PresentConversationAcknowledgementEvent = Exclude<
  ConversationAcknowledgementEvent,
  null
>;

/** Selected acknowledgement text paired with its event from one priority decision. */
export type SelectedConversationAcknowledgement = {
  readonly text: string;
  readonly event: PresentConversationAcknowledgementEvent;
};

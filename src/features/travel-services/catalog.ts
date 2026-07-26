export type ServiceAvailability =
  | 'Available now'
  | 'Planning and recommendation tool'
  | 'Live search connected'
  | 'Coming soon';

export type TravelServiceId =
  | 'flights'
  | 'hotels'
  | 'itineraries'
  | 'ai-concierge'
  | 'concierge-plan'
  | 'car-hire'
  | 'cruises'
  | 'leisure'
  | 'tours'
  | 'taxis'
  | 'rideshare'
  | 'airport-transfers'
  | 'private-hire'
  | 'chauffeur'
  | 'limousine'
  | 'off-roading'
  | 'adventure'
  | 'restaurants'
  | 'wellness'
  | 'theme-parks'
  | 'nearby'
  | 'things-nearby'
  | 'shopping-nearby'
  | 'beaches-nature'
  | 'family'
  | 'nightlife'
  | 'events'
  | 'local-guides'
  | 'local-transport'
  | 'trains'
  | 'buses'
  | 'ferries'
  | 'insurance'
  | 'visa'
  | 'vaccinations'
  | 'sim-esim'
  | 'currency-budget'
  | 'luggage'
  | 'airport-lounges'
  | 'parking'
  | 'accessibility-services'
  | 'pet-travel'
  | 'weather'
  | 'packing'
  | 'booking-organiser'
  | 'documents'
  | 'trip-notes'
  | 'emergency'
  | 'destination-discovery'
  | 'budget-intelligence'
  | 'personal-recommendations'
  | 'trip-questions'
  | 'confirmations'
  | 'ai-planning';

export type TravelServiceItem = {
  id: TravelServiceId;
  title: string;
  description: string;
  availability: ServiceAvailability;
  /** Trip platform tab to open when available. */
  tabId?: string;
};

export type TravelServiceGroup = {
  id: string;
  label: string;
  items: TravelServiceItem[];
};

export const TRAVEL_SERVICE_GROUPS: TravelServiceGroup[] = [
  {
    id: 'book',
    label: 'Book',
    items: [
      {
        id: 'flights',
        title: 'Flights',
        description: 'Plan origins, destinations, dates, travellers, and cabin — save requirements to your trip.',
        availability: 'Planning and recommendation tool',
        tabId: 'flights',
      },
      {
        id: 'hotels',
        title: 'Hotels',
        description: 'Plan stays with destination, dates, guests, and preferences.',
        availability: 'Planning and recommendation tool',
        tabId: 'stays',
      },
      {
        id: 'car-hire',
        title: 'Car Hire',
        description: 'Capture pickup/drop-off, dates, and vehicle preferences for later booking.',
        availability: 'Planning and recommendation tool',
        tabId: 'transport',
      },
      {
        id: 'cruises',
        title: 'Cruises',
        description: 'Outline cruise routes, cabin preferences, and sailing windows.',
        availability: 'Planning and recommendation tool',
        tabId: 'services',
      },
      {
        id: 'airport-transfers',
        title: 'Airport Transfers',
        description: 'Plan airport pickup and drop-off details.',
        availability: 'Planning and recommendation tool',
        tabId: 'transport',
      },
      {
        id: 'private-hire',
        title: 'Private Hire',
        description: 'Save private vehicle requirements for your itinerary.',
        availability: 'Planning and recommendation tool',
        tabId: 'transport',
      },
    ],
  },
  {
    id: 'plan',
    label: 'Plan',
    items: [
      {
        id: 'itineraries',
        title: 'Itinerary Builder',
        description: 'Build day-by-day plans with activities, times, and locations.',
        availability: 'Available now',
        tabId: 'itinerary',
      },
      {
        id: 'destination-discovery',
        title: 'Destination Discovery',
        description: 'Compare destinations, seasons, and neighbourhood fit.',
        availability: 'Available now',
        tabId: 'destinations',
      },
      {
        id: 'budget-intelligence',
        title: 'Budget Intelligence',
        description: 'Track and estimate trip costs across categories.',
        availability: 'Available now',
        tabId: 'budget',
      },
      {
        id: 'visa',
        title: 'Visa and Entry Guidance',
        description: 'Checklist and notes for entry requirements.',
        availability: 'Planning and recommendation tool',
        tabId: 'checklist',
      },
      {
        id: 'weather',
        title: 'Weather and Seasonal Guidance',
        description: 'Capture seasonal preferences and packing context.',
        availability: 'Planning and recommendation tool',
        tabId: 'services',
      },
      {
        id: 'packing',
        title: 'Packing Assistance',
        description: 'Build packing lists tied to your trip.',
        availability: 'Available now',
        tabId: 'packing',
      },
    ],
  },
  {
    id: 'explore',
    label: 'Explore',
    items: [
      {
        id: 'leisure',
        title: 'Leisure and Activities',
        description: 'Plan leisure blocks and activity ideas.',
        availability: 'Planning and recommendation tool',
        tabId: 'services',
      },
      {
        id: 'tours',
        title: 'Tours and Attractions',
        description: 'Save tour ideas and attraction notes.',
        availability: 'Planning and recommendation tool',
        tabId: 'services',
      },
      {
        id: 'off-roading',
        title: 'Off-Roading',
        description: 'Capture off-road and 4WD preferences.',
        availability: 'Planning and recommendation tool',
        tabId: 'services',
      },
      {
        id: 'adventure',
        title: 'Adventure Activities',
        description: 'Plan adventure experiences and safety notes.',
        availability: 'Planning and recommendation tool',
        tabId: 'services',
      },
      {
        id: 'restaurants',
        title: 'Restaurants',
        description: 'Collect dining preferences and reservations to organise.',
        availability: 'Planning and recommendation tool',
        tabId: 'services',
      },
      {
        id: 'nearby',
        title: 'Nearby Recommendations',
        description: 'Plan nearby places from your saved destinations.',
        availability: 'Planning and recommendation tool',
        tabId: 'maps',
      },
      {
        id: 'things-nearby',
        title: 'Things To Do Nearby',
        description: 'Shortlist nearby activities for each day.',
        availability: 'Planning and recommendation tool',
        tabId: 'itinerary',
      },
      {
        id: 'shopping-nearby',
        title: 'Shopping Nearby',
        description: 'Note shopping districts and markets.',
        availability: 'Planning and recommendation tool',
        tabId: 'services',
      },
      {
        id: 'beaches-nature',
        title: 'Beaches and Nature',
        description: 'Plan outdoor and nature days.',
        availability: 'Planning and recommendation tool',
        tabId: 'services',
      },
      {
        id: 'family',
        title: 'Family Activities',
        description: 'Family-friendly planning notes.',
        availability: 'Planning and recommendation tool',
        tabId: 'services',
      },
      {
        id: 'nightlife',
        title: 'Nightlife',
        description: 'Evening plans and venue notes.',
        availability: 'Planning and recommendation tool',
        tabId: 'services',
      },
      {
        id: 'events',
        title: 'Events',
        description: 'Track festivals, concerts, and local events.',
        availability: 'Planning and recommendation tool',
        tabId: 'services',
      },
      {
        id: 'wellness',
        title: 'Wellness and spas',
        description: 'Plan spa, wellness, and recovery blocks.',
        availability: 'Planning and recommendation tool',
        tabId: 'services',
      },
      {
        id: 'theme-parks',
        title: 'Theme parks',
        description: 'Theme-park days, tickets, and timing notes.',
        availability: 'Planning and recommendation tool',
        tabId: 'services',
      },
      {
        id: 'local-guides',
        title: 'Local guides',
        description: 'Private guide preferences and booking placeholders.',
        availability: 'Planning and recommendation tool',
        tabId: 'services',
      },
    ],
  },
  {
    id: 'move',
    label: 'Move',
    items: [
      {
        id: 'taxis',
        title: 'Taxis',
        description: 'Plan taxi legs and pickup notes.',
        availability: 'Planning and recommendation tool',
        tabId: 'transport',
      },
      {
        id: 'rideshare',
        title: 'Rideshare',
        description: 'Capture rideshare preferences and estimates.',
        availability: 'Planning and recommendation tool',
        tabId: 'transport',
      },
      {
        id: 'trains',
        title: 'Trains',
        description: 'Organise rail segments and tickets.',
        availability: 'Planning and recommendation tool',
        tabId: 'transport',
      },
      {
        id: 'buses',
        title: 'Buses and Coaches',
        description: 'Plan coach and bus travel.',
        availability: 'Planning and recommendation tool',
        tabId: 'transport',
      },
      {
        id: 'ferries',
        title: 'Ferries',
        description: 'Ferry crossings and port details.',
        availability: 'Planning and recommendation tool',
        tabId: 'transport',
      },
      {
        id: 'local-transport',
        title: 'Local Transport',
        description: 'Metro passes and local transit notes.',
        availability: 'Planning and recommendation tool',
        tabId: 'transport',
      },
      {
        id: 'chauffeur',
        title: 'Chauffeur Services',
        description: 'Private chauffeur planning details.',
        availability: 'Planning and recommendation tool',
        tabId: 'transport',
      },
      {
        id: 'limousine',
        title: 'Limousine services',
        description: 'Plan limousine transfers and special-occasion transport.',
        availability: 'Planning and recommendation tool',
        tabId: 'transport',
      },
      {
        id: 'parking',
        title: 'Airport parking',
        description: 'Capture parking location, dates, and booking placeholders.',
        availability: 'Planning and recommendation tool',
        tabId: 'transport',
      },
    ],
  },
  {
    id: 'organise',
    label: 'Organise',
    items: [
      {
        id: 'booking-organiser',
        title: 'Booking Organiser',
        description: 'Keep confirmations and booking records together.',
        availability: 'Available now',
        tabId: 'bookings',
      },
      {
        id: 'documents',
        title: 'Travel Documents',
        description: 'Upload and manage trip documents securely.',
        availability: 'Available now',
        tabId: 'documents',
      },
      {
        id: 'confirmations',
        title: 'Confirmations',
        description: 'Track booking references and confirmation status.',
        availability: 'Available now',
        tabId: 'bookings',
      },
      {
        id: 'trip-notes',
        title: 'Trip Notes',
        description: 'Free-form notes and journal entries.',
        availability: 'Available now',
        tabId: 'journal',
      },
      {
        id: 'insurance',
        title: 'Travel Insurance',
        description: 'Store policy contacts and coverage notes.',
        availability: 'Available now',
        tabId: 'emergency',
      },
      {
        id: 'emergency',
        title: 'Emergency and Local Assistance',
        description: 'Emergency contacts, embassies, and medical info.',
        availability: 'Available now',
        tabId: 'emergency',
      },
      {
        id: 'currency-budget',
        title: 'Currency and Budgeting',
        description: 'Budget tracking with multi-currency support.',
        availability: 'Available now',
        tabId: 'budget',
      },
      {
        id: 'vaccinations',
        title: 'Vaccinations and health preparation',
        description: 'Health prep notes and vaccination reminders (not medical advice).',
        availability: 'Planning and recommendation tool',
        tabId: 'checklist',
      },
      {
        id: 'sim-esim',
        title: 'SIM and eSIM planning',
        description: 'Connectivity planning and provider placeholders.',
        availability: 'Planning and recommendation tool',
        tabId: 'services',
      },
      {
        id: 'luggage',
        title: 'Luggage services',
        description: 'Luggage storage, shipping, and allowance notes.',
        availability: 'Planning and recommendation tool',
        tabId: 'services',
      },
      {
        id: 'airport-lounges',
        title: 'Airport lounges',
        description: 'Lounge access planning and membership notes.',
        availability: 'Planning and recommendation tool',
        tabId: 'services',
      },
      {
        id: 'accessibility-services',
        title: 'Accessibility services',
        description: 'Assistance requests, step-free transfer notes, and support contacts.',
        availability: 'Planning and recommendation tool',
        tabId: 'travellers',
      },
      {
        id: 'pet-travel',
        title: 'Pet travel',
        description: 'Pet documentation, cabin/hold preferences, and airline rules placeholders.',
        availability: 'Planning and recommendation tool',
        tabId: 'services',
      },
    ],
  },
  {
    id: 'assist',
    label: 'Assist',
    items: [
      {
        id: 'ai-concierge',
        title: 'AI Concierge',
        description: 'Rule-based trip tips and smart assistance.',
        availability: 'Available now',
        tabId: 'assistance',
      },
      {
        id: 'concierge-plan',
        title: 'Concierge Plan',
        description: 'Ask structured trip questions and save recommendations into your itinerary.',
        availability: 'Planning and recommendation tool',
        tabId: 'concierge-plan',
      },
      {
        id: 'ai-planning',
        title: 'AI travel planning',
        description: 'Generate mock AI itineraries, versions, and locked-item-aware revisions.',
        availability: 'Planning and recommendation tool',
        tabId: 'ai-planning',
      },
      {
        id: 'personal-recommendations',
        title: 'Personal Recommendations',
        description: 'Recommendations from your trip brief and assistance engine.',
        availability: 'Planning and recommendation tool',
        tabId: 'trip-brief',
      },
      {
        id: 'trip-questions',
        title: 'Trip Questions',
        description: 'Concierge-style Q&A using saved trip context.',
        availability: 'Planning and recommendation tool',
        tabId: 'concierge-plan',
      },
    ],
  },
];

export function listAllServices(): TravelServiceItem[] {
  return TRAVEL_SERVICE_GROUPS.flatMap((group) => group.items);
}

export function findService(id: TravelServiceId): TravelServiceItem | undefined {
  return listAllServices().find((item) => item.id === id);
}

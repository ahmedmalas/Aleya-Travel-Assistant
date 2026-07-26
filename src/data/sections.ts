export type TravelSection = {
  title: string;
  eyebrow: string;
  description: string;
  availability: 'Available now' | 'Planning and recommendation tool' | 'Coming soon';
  href: string;
  targetTab: string;
};

export const travelSections: TravelSection[] = [
  {
    title: 'Flights',
    eyebrow: 'Book',
    description: 'Origin/destination autocomplete, calendar dates, travellers, and cabin — save plans to your trip.',
    availability: 'Planning and recommendation tool',
    href: '#trip-platform',
    targetTab: 'flights',
  },
  {
    title: 'Hotels',
    eyebrow: 'Book',
    description: 'Destination suggestions, check-in/out calendars, guests, rooms, and stay preferences.',
    availability: 'Planning and recommendation tool',
    href: '#trip-platform',
    targetTab: 'stays',
  },
  {
    title: 'Itinerary Builder',
    eyebrow: 'Plan',
    description: 'Create structured day-by-day travel plans with activities, times, locations, and notes.',
    availability: 'Available now',
    href: '#trip-platform',
    targetTab: 'itinerary',
  },
  {
    title: 'Destination Discovery',
    eyebrow: 'Discover',
    description: 'Compare destinations, neighbourhoods, seasons, travel styles, and local highlights.',
    availability: 'Available now',
    href: '#trip-platform',
    targetTab: 'destinations',
  },
  {
    title: 'Budget Intelligence',
    eyebrow: 'Compare',
    description: 'Estimate and track trip costs across flights, hotels, transport, activities, meals, and extras.',
    availability: 'Available now',
    href: '#trip-platform',
    targetTab: 'budget',
  },
  {
    title: 'Travel Services Hub',
    eyebrow: 'Explore',
    description: 'Car hire, cruises, leisure, tours, transfers, restaurants, nearby ideas, transport, insurance, and more — grouped and labelled.',
    availability: 'Planning and recommendation tool',
    href: '#trip-platform',
    targetTab: 'services',
  },
  {
    title: 'Booking Organiser',
    eyebrow: 'Organise',
    description: 'Keep confirmations, documents, timings, preferences, and travel notes in one place.',
    availability: 'Available now',
    href: '#trip-platform',
    targetTab: 'bookings',
  },
  {
    title: 'AI Concierge',
    eyebrow: 'Assist',
    description: 'Ask for help with flights, hotels, restaurants, tours, transfers, cruises, and local guidance.',
    availability: 'Available now',
    href: '#trip-platform',
    targetTab: 'assistance',
  },
  {
    title: 'Concierge Plan',
    eyebrow: 'Assist',
    description: 'Structured trip questions with recommendations you can save into the itinerary.',
    availability: 'Planning and recommendation tool',
    href: '#trip-platform',
    targetTab: 'concierge-plan',
  },
];
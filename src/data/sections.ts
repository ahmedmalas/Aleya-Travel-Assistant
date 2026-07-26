export type TravelSection = {
  title: string;
  eyebrow: string;
  description: string;
  availability: 'Available now' | 'Planning and recommendation tool' | 'Coming soon';
  href: string;
};

export const travelSections: TravelSection[] = [
  {
    title: 'Flights',
    eyebrow: 'Book',
    description: 'Origin/destination autocomplete, calendar dates, travellers, and cabin — save plans to your trip.',
    availability: 'Planning and recommendation tool',
    href: '#trip-platform',
  },
  {
    title: 'Hotels',
    eyebrow: 'Book',
    description: 'Destination suggestions, check-in/out calendars, guests, rooms, and stay preferences.',
    availability: 'Planning and recommendation tool',
    href: '#trip-platform',
  },
  {
    title: 'Itinerary Builder',
    eyebrow: 'Plan',
    description: 'Create structured day-by-day travel plans with activities, times, locations, and notes.',
    availability: 'Available now',
    href: '#trip-platform',
  },
  {
    title: 'Destination Discovery',
    eyebrow: 'Plan',
    description: 'Compare destinations, neighbourhoods, seasons, travel styles, and local highlights.',
    availability: 'Available now',
    href: '#trip-platform',
  },
  {
    title: 'Budget Intelligence',
    eyebrow: 'Plan',
    description: 'Estimate and track trip costs across flights, hotels, transport, activities, and extras.',
    availability: 'Available now',
    href: '#trip-platform',
  },
  {
    title: 'Travel services hub',
    eyebrow: 'Explore',
    description: 'Car hire, cruises, leisure, tours, transfers, restaurants, nearby ideas, transport, insurance, and more — grouped and labelled.',
    availability: 'Planning and recommendation tool',
    href: '#trip-platform',
  },
  {
    title: 'Booking Organiser',
    eyebrow: 'Organise',
    description: 'Keep confirmations, documents, timings, preferences, and travel notes in one place.',
    availability: 'Available now',
    href: '#trip-platform',
  },
  {
    title: 'AI Concierge',
    eyebrow: 'Assist',
    description: 'Ask for help with flights, hotels, restaurants, tours, transfers, cruises, and local guidance.',
    availability: 'Available now',
    href: '#assistant',
  },
  {
    title: 'Concierge Plan',
    eyebrow: 'Assist',
    description: 'Structured trip questions with recommendations you can save into the itinerary.',
    availability: 'Planning and recommendation tool',
    href: '#trip-platform',
  },
];

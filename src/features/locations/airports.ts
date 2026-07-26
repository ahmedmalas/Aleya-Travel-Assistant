export type AirportRecord = {
  code: string;
  name: string;
  city: string;
  country: string;
};

/** Curated major airports for offline-first flight autocomplete (IATA / city / name). */
export const AIRPORT_CATALOG: AirportRecord[] = [
  { code: 'SYD', name: 'Sydney Airport', city: 'Sydney', country: 'Australia' },
  { code: 'MEL', name: 'Melbourne Airport', city: 'Melbourne', country: 'Australia' },
  { code: 'BNE', name: 'Brisbane Airport', city: 'Brisbane', country: 'Australia' },
  { code: 'PER', name: 'Perth Airport', city: 'Perth', country: 'Australia' },
  { code: 'ADL', name: 'Adelaide Airport', city: 'Adelaide', country: 'Australia' },
  { code: 'CBR', name: 'Canberra Airport', city: 'Canberra', country: 'Australia' },
  { code: 'OOL', name: 'Gold Coast Airport', city: 'Gold Coast', country: 'Australia' },
  { code: 'CNS', name: 'Cairns Airport', city: 'Cairns', country: 'Australia' },
  { code: 'HBA', name: 'Hobart Airport', city: 'Hobart', country: 'Australia' },
  { code: 'DRW', name: 'Darwin Airport', city: 'Darwin', country: 'Australia' },
  { code: 'AKL', name: 'Auckland Airport', city: 'Auckland', country: 'New Zealand' },
  { code: 'WLG', name: 'Wellington Airport', city: 'Wellington', country: 'New Zealand' },
  { code: 'CHC', name: 'Christchurch Airport', city: 'Christchurch', country: 'New Zealand' },
  { code: 'SIN', name: 'Singapore Changi', city: 'Singapore', country: 'Singapore' },
  { code: 'HKG', name: 'Hong Kong International', city: 'Hong Kong', country: 'Hong Kong' },
  { code: 'NRT', name: 'Narita International', city: 'Tokyo', country: 'Japan' },
  { code: 'HND', name: 'Haneda', city: 'Tokyo', country: 'Japan' },
  { code: 'KIX', name: 'Kansai International', city: 'Osaka', country: 'Japan' },
  { code: 'ICN', name: 'Incheon International', city: 'Seoul', country: 'South Korea' },
  { code: 'BKK', name: 'Suvarnabhumi', city: 'Bangkok', country: 'Thailand' },
  { code: 'DMK', name: 'Don Mueang', city: 'Bangkok', country: 'Thailand' },
  { code: 'KUL', name: 'Kuala Lumpur International', city: 'Kuala Lumpur', country: 'Malaysia' },
  { code: 'CGK', name: 'Soekarno-Hatta', city: 'Jakarta', country: 'Indonesia' },
  { code: 'DPS', name: 'Ngurah Rai', city: 'Denpasar', country: 'Indonesia' },
  { code: 'MNL', name: 'Ninoy Aquino', city: 'Manila', country: 'Philippines' },
  { code: 'DEL', name: 'Indira Gandhi International', city: 'Delhi', country: 'India' },
  { code: 'BOM', name: 'Chhatrapati Shivaji Maharaj', city: 'Mumbai', country: 'India' },
  { code: 'DXB', name: 'Dubai International', city: 'Dubai', country: 'United Arab Emirates' },
  { code: 'AUH', name: 'Abu Dhabi International', city: 'Abu Dhabi', country: 'United Arab Emirates' },
  { code: 'DOH', name: 'Hamad International', city: 'Doha', country: 'Qatar' },
  { code: 'IST', name: 'Istanbul Airport', city: 'Istanbul', country: 'Turkey' },
  { code: 'LHR', name: 'Heathrow', city: 'London', country: 'United Kingdom' },
  { code: 'LGW', name: 'Gatwick', city: 'London', country: 'United Kingdom' },
  { code: 'STN', name: 'Stansted', city: 'London', country: 'United Kingdom' },
  { code: 'MAN', name: 'Manchester', city: 'Manchester', country: 'United Kingdom' },
  { code: 'EDI', name: 'Edinburgh', city: 'Edinburgh', country: 'United Kingdom' },
  { code: 'DUB', name: 'Dublin Airport', city: 'Dublin', country: 'Ireland' },
  { code: 'CDG', name: 'Charles de Gaulle', city: 'Paris', country: 'France' },
  { code: 'ORY', name: 'Orly', city: 'Paris', country: 'France' },
  { code: 'AMS', name: 'Schiphol', city: 'Amsterdam', country: 'Netherlands' },
  { code: 'FRA', name: 'Frankfurt am Main', city: 'Frankfurt', country: 'Germany' },
  { code: 'MUC', name: 'Munich', city: 'Munich', country: 'Germany' },
  { code: 'BER', name: 'Berlin Brandenburg', city: 'Berlin', country: 'Germany' },
  { code: 'MAD', name: 'Adolfo Suárez Madrid–Barajas', city: 'Madrid', country: 'Spain' },
  { code: 'BCN', name: 'El Prat', city: 'Barcelona', country: 'Spain' },
  { code: 'FCO', name: 'Fiumicino', city: 'Rome', country: 'Italy' },
  { code: 'MXP', name: 'Malpensa', city: 'Milan', country: 'Italy' },
  { code: 'ZRH', name: 'Zurich', city: 'Zurich', country: 'Switzerland' },
  { code: 'VIE', name: 'Vienna International', city: 'Vienna', country: 'Austria' },
  { code: 'CPH', name: 'Copenhagen', city: 'Copenhagen', country: 'Denmark' },
  { code: 'ARN', name: 'Arlanda', city: 'Stockholm', country: 'Sweden' },
  { code: 'OSL', name: 'Gardermoen', city: 'Oslo', country: 'Norway' },
  { code: 'HEL', name: 'Helsinki-Vantaa', city: 'Helsinki', country: 'Finland' },
  { code: 'LIS', name: 'Humberto Delgado', city: 'Lisbon', country: 'Portugal' },
  { code: 'ATH', name: 'Eleftherios Venizelos', city: 'Athens', country: 'Greece' },
  { code: 'PRG', name: 'Václav Havel', city: 'Prague', country: 'Czechia' },
  { code: 'BUD', name: 'Ferenc Liszt', city: 'Budapest', country: 'Hungary' },
  { code: 'WAW', name: 'Chopin', city: 'Warsaw', country: 'Poland' },
  { code: 'JFK', name: 'John F. Kennedy International', city: 'New York', country: 'United States' },
  { code: 'EWR', name: 'Newark Liberty', city: 'Newark', country: 'United States' },
  { code: 'LGA', name: 'LaGuardia', city: 'New York', country: 'United States' },
  { code: 'LAX', name: 'Los Angeles International', city: 'Los Angeles', country: 'United States' },
  { code: 'SFO', name: 'San Francisco International', city: 'San Francisco', country: 'United States' },
  { code: 'ORD', name: 'O’Hare International', city: 'Chicago', country: 'United States' },
  { code: 'ATL', name: 'Hartsfield–Jackson', city: 'Atlanta', country: 'United States' },
  { code: 'MIA', name: 'Miami International', city: 'Miami', country: 'United States' },
  { code: 'SEA', name: 'Seattle–Tacoma', city: 'Seattle', country: 'United States' },
  { code: 'BOS', name: 'Logan International', city: 'Boston', country: 'United States' },
  { code: 'IAD', name: 'Dulles International', city: 'Washington', country: 'United States' },
  { code: 'DFW', name: 'Dallas/Fort Worth', city: 'Dallas', country: 'United States' },
  { code: 'DEN', name: 'Denver International', city: 'Denver', country: 'United States' },
  { code: 'LAS', name: 'Harry Reid International', city: 'Las Vegas', country: 'United States' },
  { code: 'YVR', name: 'Vancouver International', city: 'Vancouver', country: 'Canada' },
  { code: 'YYZ', name: 'Toronto Pearson', city: 'Toronto', country: 'Canada' },
  { code: 'YUL', name: 'Montréal–Trudeau', city: 'Montreal', country: 'Canada' },
  { code: 'MEX', name: 'Benito Juárez', city: 'Mexico City', country: 'Mexico' },
  { code: 'GRU', name: 'Guarulhos', city: 'São Paulo', country: 'Brazil' },
  { code: 'EZE', name: 'Ministro Pistarini', city: 'Buenos Aires', country: 'Argentina' },
  { code: 'SCL', name: 'Arturo Merino Benítez', city: 'Santiago', country: 'Chile' },
  { code: 'JNB', name: 'O. R. Tambo', city: 'Johannesburg', country: 'South Africa' },
  { code: 'CPT', name: 'Cape Town International', city: 'Cape Town', country: 'South Africa' },
  { code: 'CAI', name: 'Cairo International', city: 'Cairo', country: 'Egypt' },
  { code: 'CMN', name: 'Mohammed V', city: 'Casablanca', country: 'Morocco' },
  { code: 'NBO', name: 'Jomo Kenyatta', city: 'Nairobi', country: 'Kenya' },
  { code: 'ADD', name: 'Bole International', city: 'Addis Ababa', country: 'Ethiopia' },
  { code: 'PVG', name: 'Pudong International', city: 'Shanghai', country: 'China' },
  { code: 'PEK', name: 'Beijing Capital', city: 'Beijing', country: 'China' },
  { code: 'CAN', name: 'Baiyun International', city: 'Guangzhou', country: 'China' },
  { code: 'TPE', name: 'Taoyuan International', city: 'Taipei', country: 'Taiwan' },
  { code: 'HAN', name: 'Noi Bai', city: 'Hanoi', country: 'Vietnam' },
  { code: 'SGN', name: 'Tan Son Nhat', city: 'Ho Chi Minh City', country: 'Vietnam' },
  { code: 'HNL', name: 'Daniel K. Inouye', city: 'Honolulu', country: 'United States' },
  { code: 'GIG', name: 'Galeão', city: 'Rio de Janeiro', country: 'Brazil' },
  { code: 'LIM', name: 'Jorge Chávez', city: 'Lima', country: 'Peru' },
  { code: 'BOG', name: 'El Dorado', city: 'Bogotá', country: 'Colombia' },
];

export function formatAirportLabel(airport: AirportRecord): string {
  return `${airport.city} — ${airport.name} (${airport.code}), ${airport.country}`;
}

export function searchAirports(query: string, limit = 8): AirportRecord[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const scored = AIRPORT_CATALOG.map((airport) => {
    const code = airport.code.toLowerCase();
    const city = airport.city.toLowerCase();
    const name = airport.name.toLowerCase();
    const country = airport.country.toLowerCase();
    let score = 0;
    if (code === q) score = 100;
    else if (code.startsWith(q)) score = 90;
    else if (city.startsWith(q)) score = 80;
    else if (city.includes(q)) score = 70;
    else if (name.includes(q)) score = 60;
    else if (country.startsWith(q)) score = 50;
    else if (country.includes(q)) score = 40;
    return { airport, score };
  })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.airport.city.localeCompare(b.airport.city));
  return scored.slice(0, limit).map((entry) => entry.airport);
}

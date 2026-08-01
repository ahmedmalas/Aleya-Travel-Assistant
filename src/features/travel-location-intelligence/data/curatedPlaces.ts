import type { TravelPlaceType } from '../types';

/** Curated high-value travel places for deterministic local resolution + offline tests. */
export type CuratedPlace = {
  id: string;
  canonicalName: string;
  displayName: string;
  type: TravelPlaceType;
  countryCode: string;
  countryName: string;
  stateCode?: string;
  stateName?: string;
  regionName?: string;
  cityName?: string;
  latitude?: number;
  longitude?: number;
  iataCode?: string;
  airportCodes?: string[];
  nearestAirportCodes?: string[];
  aliases: string[];
  parent?: { name: string; type: TravelPlaceType };
};

export const CURATED_PLACES: CuratedPlace[] = [
  // Major AU cities
  { id: 'au-sydney', canonicalName: 'Sydney', displayName: 'Sydney', type: 'city', countryCode: 'AU', countryName: 'Australia', stateCode: 'NSW', stateName: 'New South Wales', iataCode: 'SYD', airportCodes: ['SYD'], aliases: ['sydney', 'syd'], latitude: -33.8688, longitude: 151.2093 },
  { id: 'au-melbourne', canonicalName: 'Melbourne', displayName: 'Melbourne', type: 'city', countryCode: 'AU', countryName: 'Australia', stateCode: 'VIC', stateName: 'Victoria', iataCode: 'MEL', airportCodes: ['MEL', 'AVV'], aliases: ['melbourne', 'mel'], latitude: -37.8136, longitude: 144.9631 },
  { id: 'au-brisbane', canonicalName: 'Brisbane', displayName: 'Brisbane', type: 'city', countryCode: 'AU', countryName: 'Australia', stateCode: 'QLD', stateName: 'Queensland', iataCode: 'BNE', airportCodes: ['BNE'], aliases: ['brisbane', 'bne'], latitude: -27.4698, longitude: 153.0251 },
  { id: 'au-perth', canonicalName: 'Perth', displayName: 'Perth', type: 'city', countryCode: 'AU', countryName: 'Australia', stateCode: 'WA', stateName: 'Western Australia', iataCode: 'PER', airportCodes: ['PER'], aliases: ['perth', 'per'], latitude: -31.9523, longitude: 115.8613 },
  { id: 'au-adelaide', canonicalName: 'Adelaide', displayName: 'Adelaide', type: 'city', countryCode: 'AU', countryName: 'Australia', stateCode: 'SA', stateName: 'South Australia', iataCode: 'ADL', airportCodes: ['ADL'], aliases: ['adelaide', 'adl'], latitude: -34.9285, longitude: 138.6007 },
  { id: 'au-canberra', canonicalName: 'Canberra', displayName: 'Canberra', type: 'city', countryCode: 'AU', countryName: 'Australia', stateCode: 'ACT', stateName: 'Australian Capital Territory', iataCode: 'CBR', airportCodes: ['CBR'], aliases: ['canberra', 'cbr'], latitude: -35.2809, longitude: 149.13 },
  { id: 'au-gold-coast', canonicalName: 'Gold Coast', displayName: 'Gold Coast', type: 'city', countryCode: 'AU', countryName: 'Australia', stateCode: 'QLD', stateName: 'Queensland', iataCode: 'OOL', airportCodes: ['OOL'], aliases: ['gold coast', 'the gold coast', 'ool'], latitude: -28.0167, longitude: 153.4 },
  { id: 'au-cairns', canonicalName: 'Cairns', displayName: 'Cairns', type: 'city', countryCode: 'AU', countryName: 'Australia', stateCode: 'QLD', stateName: 'Queensland', iataCode: 'CNS', airportCodes: ['CNS'], aliases: ['cairns', 'cns'], latitude: -16.9186, longitude: 145.7781 },
  { id: 'au-hobart', canonicalName: 'Hobart', displayName: 'Hobart', type: 'city', countryCode: 'AU', countryName: 'Australia', stateCode: 'TAS', stateName: 'Tasmania', iataCode: 'HBA', airportCodes: ['HBA'], aliases: ['hobart', 'hba'], latitude: -42.8821, longitude: 147.3272 },
  { id: 'au-darwin', canonicalName: 'Darwin', displayName: 'Darwin', type: 'city', countryCode: 'AU', countryName: 'Australia', stateCode: 'NT', stateName: 'Northern Territory', iataCode: 'DRW', airportCodes: ['DRW'], aliases: ['darwin', 'drw'], latitude: -12.4634, longitude: 130.8456 },

  // Whitsundays / Hamilton Island — critical gap
  { id: 'au-hamilton-island', canonicalName: 'Hamilton Island', displayName: 'Hamilton Island', type: 'island', countryCode: 'AU', countryName: 'Australia', stateCode: 'QLD', stateName: 'Queensland', regionName: 'Whitsundays', iataCode: 'HTI', airportCodes: ['HTI'], nearestAirportCodes: ['HTI', 'PPP'], aliases: ['hamilton island', 'hamilton islands', 'hti'], latitude: -20.3484, longitude: 148.9517, parent: { name: 'Whitsundays', type: 'region' } },
  { id: 'au-whitsundays', canonicalName: 'Whitsundays', displayName: 'Whitsunday Islands', type: 'region', countryCode: 'AU', countryName: 'Australia', stateCode: 'QLD', stateName: 'Queensland', regionName: 'Whitsundays', nearestAirportCodes: ['HTI', 'PPP'], aliases: ['whitsundays', 'whitsunday islands', 'whitsunday'], latitude: -20.2833, longitude: 148.9167 },
  { id: 'au-airlie-beach', canonicalName: 'Airlie Beach', displayName: 'Airlie Beach', type: 'town', countryCode: 'AU', countryName: 'Australia', stateCode: 'QLD', stateName: 'Queensland', regionName: 'Whitsundays', nearestAirportCodes: ['PPP', 'HTI'], aliases: ['airlie beach', 'airlie'], latitude: -20.2675, longitude: 148.7169, parent: { name: 'Whitsundays', type: 'region' } },
  { id: 'au-proserpine', canonicalName: 'Proserpine', displayName: 'Proserpine', type: 'town', countryCode: 'AU', countryName: 'Australia', stateCode: 'QLD', stateName: 'Queensland', iataCode: 'PPP', airportCodes: ['PPP'], aliases: ['proserpine', 'ppp', 'whitsunday coast'], latitude: -20.4011, longitude: 148.58 },
  { id: 'au-gbr', canonicalName: 'Great Barrier Reef', displayName: 'Great Barrier Reef', type: 'region', countryCode: 'AU', countryName: 'Australia', stateCode: 'QLD', stateName: 'Queensland', nearestAirportCodes: ['CNS', 'HTI', 'PPP'], aliases: ['great barrier reef', 'gbr', 'barrier reef'], latitude: -18.2871, longitude: 147.6992 },

  // Beaches / suburbs / areas
  { id: 'au-surfers', canonicalName: 'Surfers Paradise', displayName: 'Surfers Paradise', type: 'suburb', countryCode: 'AU', countryName: 'Australia', stateCode: 'QLD', stateName: 'Queensland', cityName: 'Gold Coast', nearestAirportCodes: ['OOL'], aliases: ['surfers paradise', 'surfers'], latitude: -28.0029, longitude: 153.431, parent: { name: 'Gold Coast', type: 'city' } },
  { id: 'au-bondi', canonicalName: 'Bondi Beach', displayName: 'Bondi Beach', type: 'beach', countryCode: 'AU', countryName: 'Australia', stateCode: 'NSW', stateName: 'New South Wales', cityName: 'Sydney', nearestAirportCodes: ['SYD'], aliases: ['bondi beach', 'bondi'], latitude: -33.8915, longitude: 151.2767, parent: { name: 'Sydney', type: 'city' } },
  { id: 'au-noosa', canonicalName: 'Noosa', displayName: 'Noosa', type: 'town', countryCode: 'AU', countryName: 'Australia', stateCode: 'QLD', stateName: 'Queensland', nearestAirportCodes: ['MCY', 'BNE'], aliases: ['noosa', 'noosa heads'], latitude: -26.3852, longitude: 153.0903 },
  { id: 'au-byron', canonicalName: 'Byron Bay', displayName: 'Byron Bay', type: 'town', countryCode: 'AU', countryName: 'Australia', stateCode: 'NSW', stateName: 'New South Wales', nearestAirportCodes: ['BNK', 'OOL'], aliases: ['byron bay', 'byron'], latitude: -28.6474, longitude: 153.602 },
  { id: 'au-docklands', canonicalName: 'Docklands', displayName: 'Docklands', type: 'suburb', countryCode: 'AU', countryName: 'Australia', stateCode: 'VIC', stateName: 'Victoria', cityName: 'Melbourne', nearestAirportCodes: ['MEL'], aliases: ['docklands'], latitude: -37.8149, longitude: 144.948, parent: { name: 'Melbourne', type: 'city' } },
  { id: 'au-south-bank-bne', canonicalName: 'South Bank', displayName: 'South Bank', type: 'suburb', countryCode: 'AU', countryName: 'Australia', stateCode: 'QLD', stateName: 'Queensland', cityName: 'Brisbane', nearestAirportCodes: ['BNE'], aliases: ['south bank', 'southbank brisbane'], latitude: -27.4816, longitude: 153.0235, parent: { name: 'Brisbane', type: 'city' } },
  { id: 'au-southbank-mel', canonicalName: 'Southbank', displayName: 'Southbank', type: 'suburb', countryCode: 'AU', countryName: 'Australia', stateCode: 'VIC', stateName: 'Victoria', cityName: 'Melbourne', nearestAirportCodes: ['MEL'], aliases: ['southbank melbourne', 'southbank'], latitude: -37.823, longitude: 144.965, parent: { name: 'Melbourne', type: 'city' } },

  // Parks / routes / icons
  { id: 'au-blue-mountains', canonicalName: 'Blue Mountains', displayName: 'Blue Mountains', type: 'region', countryCode: 'AU', countryName: 'Australia', stateCode: 'NSW', stateName: 'New South Wales', nearestAirportCodes: ['SYD'], aliases: ['blue mountains'], latitude: -33.7, longitude: 150.3 },
  { id: 'au-phillip-island', canonicalName: 'Phillip Island', displayName: 'Phillip Island', type: 'island', countryCode: 'AU', countryName: 'Australia', stateCode: 'VIC', stateName: 'Victoria', nearestAirportCodes: ['MEL', 'AVV'], aliases: ['phillip island'], latitude: -38.4833, longitude: 145.2333 },
  { id: 'au-mornington', canonicalName: 'Mornington Peninsula', displayName: 'Mornington Peninsula', type: 'region', countryCode: 'AU', countryName: 'Australia', stateCode: 'VIC', stateName: 'Victoria', nearestAirportCodes: ['MEL', 'AVV'], aliases: ['mornington peninsula', 'mornington'], latitude: -38.35, longitude: 145 },
  { id: 'au-gor', canonicalName: 'Great Ocean Road', displayName: 'Great Ocean Road', type: 'route', countryCode: 'AU', countryName: 'Australia', stateCode: 'VIC', stateName: 'Victoria', nearestAirportCodes: ['MEL', 'AVV'], aliases: ['great ocean road'], latitude: -38.68, longitude: 143.1 },
  { id: 'au-kosciuszko', canonicalName: 'Kosciuszko National Park', displayName: 'Kosciuszko National Park', type: 'national_park', countryCode: 'AU', countryName: 'Australia', stateCode: 'NSW', stateName: 'New South Wales', nearestAirportCodes: ['CBR', 'MEL'], aliases: ['kosciuszko national park', 'kosciuszko', 'mount kosciuszko'], latitude: -36.456, longitude: 148.263 },
  { id: 'au-uluru', canonicalName: 'Uluru', displayName: 'Uluru', type: 'landmark', countryCode: 'AU', countryName: 'Australia', stateCode: 'NT', stateName: 'Northern Territory', nearestAirportCodes: ['AYQ'], aliases: ['uluru', 'ayers rock'], latitude: -25.3444, longitude: 131.0369 },
  { id: 'au-fraser', canonicalName: 'K’gari', displayName: 'K’gari (Fraser Island)', type: 'island', countryCode: 'AU', countryName: 'Australia', stateCode: 'QLD', stateName: 'Queensland', nearestAirportCodes: ['HVB', 'BNE'], aliases: ['kgari', "k'gari", 'fraser island', 'fraser'], latitude: -25.25, longitude: 153.17 },

  // Airports (named)
  { id: 'apt-syd', canonicalName: 'Sydney Airport', displayName: 'Sydney Airport', type: 'airport', countryCode: 'AU', countryName: 'Australia', cityName: 'Sydney', iataCode: 'SYD', airportCodes: ['SYD'], aliases: ['sydney airport', 'kingsford smith', 'kingsford smith airport', 'syd'], latitude: -33.9399, longitude: 151.1753, parent: { name: 'Sydney', type: 'city' } },
  { id: 'apt-mel', canonicalName: 'Melbourne Airport', displayName: 'Melbourne Airport', type: 'airport', countryCode: 'AU', countryName: 'Australia', cityName: 'Melbourne', iataCode: 'MEL', airportCodes: ['MEL'], aliases: ['melbourne airport', 'tullamarine', 'mel'], latitude: -37.669, longitude: 144.841, parent: { name: 'Melbourne', type: 'city' } },
  { id: 'apt-avv', canonicalName: 'Avalon Airport', displayName: 'Avalon Airport', type: 'airport', countryCode: 'AU', countryName: 'Australia', cityName: 'Melbourne', iataCode: 'AVV', airportCodes: ['AVV'], aliases: ['avalon', 'avalon airport', 'avv'], latitude: -38.0394, longitude: 144.4694, parent: { name: 'Melbourne', type: 'city' } },
  { id: 'apt-hti', canonicalName: 'Hamilton Island Airport', displayName: 'Hamilton Island Airport', type: 'airport', countryCode: 'AU', countryName: 'Australia', cityName: 'Hamilton Island', iataCode: 'HTI', airportCodes: ['HTI'], aliases: ['hamilton island airport', 'hti'], latitude: -20.358, longitude: 148.952, parent: { name: 'Hamilton Island', type: 'island' } },
  { id: 'apt-cns', canonicalName: 'Cairns Airport', displayName: 'Cairns Airport', type: 'airport', countryCode: 'AU', countryName: 'Australia', cityName: 'Cairns', iataCode: 'CNS', airportCodes: ['CNS'], aliases: ['cairns airport', 'cns'], latitude: -16.8858, longitude: 145.755, parent: { name: 'Cairns', type: 'city' } },
  { id: 'apt-ool', canonicalName: 'Gold Coast Airport', displayName: 'Gold Coast Airport', type: 'airport', countryCode: 'AU', countryName: 'Australia', cityName: 'Gold Coast', iataCode: 'OOL', airportCodes: ['OOL'], aliases: ['gold coast airport', 'ool', 'coolangatta'], latitude: -28.1644, longitude: 153.5047, parent: { name: 'Gold Coast', type: 'city' } },

  // NZ / intl
  { id: 'nz-auckland', canonicalName: 'Auckland', displayName: 'Auckland', type: 'city', countryCode: 'NZ', countryName: 'New Zealand', iataCode: 'AKL', airportCodes: ['AKL'], aliases: ['auckland', 'akl'], latitude: -36.8509, longitude: 174.7645 },
  { id: 'nz-queenstown', canonicalName: 'Queenstown', displayName: 'Queenstown', type: 'city', countryCode: 'NZ', countryName: 'New Zealand', iataCode: 'ZQN', airportCodes: ['ZQN'], aliases: ['queenstown', 'zqn'], latitude: -45.0312, longitude: 168.6626 },
  { id: 'nz-hamilton', canonicalName: 'Hamilton', displayName: 'Hamilton', type: 'city', countryCode: 'NZ', countryName: 'New Zealand', iataCode: 'HLZ', airportCodes: ['HLZ'], aliases: ['hamilton nz', 'hamilton new zealand', 'hamilton'], latitude: -37.787, longitude: 175.2793 },
  { id: 'jp-tokyo', canonicalName: 'Tokyo', displayName: 'Tokyo', type: 'city', countryCode: 'JP', countryName: 'Japan', iataCode: 'TYO', airportCodes: ['NRT', 'HND'], aliases: ['tokyo', 'tyo', 'japan'], latitude: 35.6762, longitude: 139.6503 },
  { id: 'jp-shibuya', canonicalName: 'Shibuya', displayName: 'Shibuya', type: 'neighbourhood', countryCode: 'JP', countryName: 'Japan', cityName: 'Tokyo', nearestAirportCodes: ['HND', 'NRT'], aliases: ['shibuya'], latitude: 35.6595, longitude: 139.7004, parent: { name: 'Tokyo', type: 'city' } },
  { id: 'id-bali', canonicalName: 'Bali', displayName: 'Bali', type: 'region', countryCode: 'ID', countryName: 'Indonesia', iataCode: 'DPS', airportCodes: ['DPS'], aliases: ['bali'], latitude: -8.3405, longitude: 115.092 },
  { id: 'id-denpasar', canonicalName: 'Denpasar', displayName: 'Denpasar', type: 'city', countryCode: 'ID', countryName: 'Indonesia', iataCode: 'DPS', airportCodes: ['DPS'], aliases: ['denpasar', 'dps'], latitude: -8.6705, longitude: 115.2126, parent: { name: 'Bali', type: 'region' } },
  { id: 'fj-fiji', canonicalName: 'Fiji', displayName: 'Fiji', type: 'region', countryCode: 'FJ', countryName: 'Fiji', iataCode: 'NAN', airportCodes: ['NAN'], nearestAirportCodes: ['NAN'], aliases: ['fiji', 'nadi', 'nan'], latitude: -17.7134, longitude: 178.065 },
  { id: 'vu-vanuatu', canonicalName: 'Vanuatu', displayName: 'Vanuatu', type: 'region', countryCode: 'VU', countryName: 'Vanuatu', iataCode: 'VLI', airportCodes: ['VLI'], aliases: ['vanuatu', 'port vila', 'vli'], latitude: -17.7333, longitude: 168.3273 },
  { id: 'nc-new-caledonia', canonicalName: 'New Caledonia', displayName: 'New Caledonia', type: 'region', countryCode: 'NC', countryName: 'New Caledonia', iataCode: 'NOU', airportCodes: ['NOU'], aliases: ['new caledonia', 'noumea', 'nou'], latitude: -22.2758, longitude: 166.458 },
  { id: 'ck-rarotonga', canonicalName: 'Rarotonga', displayName: 'Rarotonga', type: 'island', countryCode: 'CK', countryName: 'Cook Islands', iataCode: 'RAR', airportCodes: ['RAR'], aliases: ['rarotonga', 'cook islands', 'rar'], latitude: -21.2292, longitude: -159.7763 },
  { id: 'th-phuket', canonicalName: 'Phuket', displayName: 'Phuket', type: 'island', countryCode: 'TH', countryName: 'Thailand', iataCode: 'HKT', airportCodes: ['HKT'], aliases: ['phuket', 'hkt'], latitude: 7.8804, longitude: 98.3923 },
  { id: 'sg-singapore', canonicalName: 'Singapore', displayName: 'Singapore', type: 'city', countryCode: 'SG', countryName: 'Singapore', iataCode: 'SIN', airportCodes: ['SIN'], aliases: ['singapore', 'sin'], latitude: 1.3521, longitude: 103.8198 },
  { id: 'th-bangkok', canonicalName: 'Bangkok', displayName: 'Bangkok', type: 'city', countryCode: 'TH', countryName: 'Thailand', iataCode: 'BKK', airportCodes: ['BKK', 'DMK'], aliases: ['bangkok', 'bkk'], latitude: 13.7563, longitude: 100.5018 },
  { id: 'gb-london', canonicalName: 'London', displayName: 'London', type: 'city', countryCode: 'GB', countryName: 'United Kingdom', iataCode: 'LON', airportCodes: ['LHR', 'LGW', 'STN'], aliases: ['london', 'lhr'], latitude: 51.5074, longitude: -0.1278 },
  { id: 'fr-paris', canonicalName: 'Paris', displayName: 'Paris', type: 'city', countryCode: 'FR', countryName: 'France', iataCode: 'PAR', airportCodes: ['CDG', 'ORY'], aliases: ['paris', 'cdg'], latitude: 48.8566, longitude: 2.3522 },
  { id: 'ae-dubai', canonicalName: 'Dubai', displayName: 'Dubai', type: 'city', countryCode: 'AE', countryName: 'United Arab Emirates', iataCode: 'DXB', airportCodes: ['DXB'], aliases: ['dubai', 'dxb'], latitude: 25.2048, longitude: 55.2708 },
  { id: 'us-nyc', canonicalName: 'New York', displayName: 'New York', type: 'city', countryCode: 'US', countryName: 'United States', iataCode: 'NYC', airportCodes: ['JFK', 'EWR', 'LGA'], aliases: ['new york', 'nyc', 'new york city'], latitude: 40.7128, longitude: -74.006 },
  { id: 'us-la', canonicalName: 'Los Angeles', displayName: 'Los Angeles', type: 'city', countryCode: 'US', countryName: 'United States', iataCode: 'LAX', airportCodes: ['LAX'], aliases: ['los angeles', 'la', 'lax'], latitude: 34.0522, longitude: -118.2437 },
  { id: 'us-disneyland', canonicalName: 'Disneyland', displayName: 'Disneyland', type: 'theme_park', countryCode: 'US', countryName: 'United States', cityName: 'Anaheim', nearestAirportCodes: ['SNA', 'LAX'], aliases: ['disneyland', 'disneyland resort'], latitude: 33.8121, longitude: -117.919 },
  { id: 'us-universal', canonicalName: 'Universal Studios', displayName: 'Universal Studios', type: 'theme_park', countryCode: 'US', countryName: 'United States', nearestAirportCodes: ['LAX', 'MCO'], aliases: ['universal studios', 'universal'], latitude: 34.1381, longitude: -118.3534 },

  // Ambiguous / alternate Hamilton (Canada) for ambiguity tests
  { id: 'ca-hamilton', canonicalName: 'Hamilton', displayName: 'Hamilton', type: 'city', countryCode: 'CA', countryName: 'Canada', iataCode: 'YHM', airportCodes: ['YHM'], aliases: ['hamilton ontario', 'hamilton canada', 'hamilton'], latitude: 43.2557, longitude: -79.8711 },

  // Additional ambiguity fixtures
  { id: 'us-springfield-il', canonicalName: 'Springfield', displayName: 'Springfield', type: 'city', countryCode: 'US', countryName: 'United States', stateCode: 'IL', stateName: 'Illinois', aliases: ['springfield illinois', 'springfield il', 'springfield'], latitude: 39.7817, longitude: -89.6501 },
  { id: 'us-springfield-mo', canonicalName: 'Springfield', displayName: 'Springfield', type: 'city', countryCode: 'US', countryName: 'United States', stateCode: 'MO', stateName: 'Missouri', aliases: ['springfield missouri', 'springfield mo', 'springfield'], latitude: 37.209, longitude: -93.2923 },
  { id: 'au-richmond-vic', canonicalName: 'Richmond', displayName: 'Richmond', type: 'suburb', countryCode: 'AU', countryName: 'Australia', stateCode: 'VIC', stateName: 'Victoria', cityName: 'Melbourne', aliases: ['richmond melbourne', 'richmond vic', 'richmond'], latitude: -37.819, longitude: 144.998, parent: { name: 'Melbourne', type: 'city' } },
  { id: 'us-richmond-va', canonicalName: 'Richmond', displayName: 'Richmond', type: 'city', countryCode: 'US', countryName: 'United States', stateCode: 'VA', stateName: 'Virginia', iataCode: 'RIC', airportCodes: ['RIC'], aliases: ['richmond virginia', 'richmond va', 'richmond'], latitude: 37.5407, longitude: -77.436 },
];

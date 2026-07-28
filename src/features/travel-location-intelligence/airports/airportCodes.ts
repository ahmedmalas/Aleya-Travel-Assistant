/** Common IATA aliases — curated evidence only, not invented mappings. */

export const AIRPORT_CODE_INDEX: Record<string, { name: string; city: string }> = {
  SYD: { name: 'Sydney Airport', city: 'Sydney' },
  MEL: { name: 'Melbourne Airport', city: 'Melbourne' },
  AVV: { name: 'Avalon Airport', city: 'Melbourne' },
  BNE: { name: 'Brisbane Airport', city: 'Brisbane' },
  OOL: { name: 'Gold Coast Airport', city: 'Gold Coast' },
  CNS: { name: 'Cairns Airport', city: 'Cairns' },
  HTI: { name: 'Hamilton Island Airport', city: 'Hamilton Island' },
  PPP: { name: 'Whitsunday Coast Airport', city: 'Proserpine' },
  PER: { name: 'Perth Airport', city: 'Perth' },
  ADL: { name: 'Adelaide Airport', city: 'Adelaide' },
  CBR: { name: 'Canberra Airport', city: 'Canberra' },
  DPS: { name: 'Ngurah Rai', city: 'Denpasar' },
  AKL: { name: 'Auckland Airport', city: 'Auckland' },
  ZQN: { name: 'Queenstown Airport', city: 'Queenstown' },
};

const FALLBACK_CURRENCIES = [
  'AED','ARS','AUD','BDT','BGN','BHD','BRL','CAD','CHF','CLP','CNY','COP','CZK','DKK','EGP','EUR','FJD','GBP','GEL','GHS','HKD','HUF','IDR','ILS','INR','ISK','JPY','KES','KRW','KWD','LKR','MAD','MXN','MYR','NGN','NOK','NPR','NZD','OMR','PEN','PHP','PKR','PLN','QAR','RON','RSD','RUB','SAR','SEK','SGD','THB','TRY','TWD','TZS','UAH','UGX','USD','VND','XAF','XCD','XOF','XPF','ZAR',
] as const;

const REGION_CURRENCY: Record<string, string> = {
  AE: 'AED', AR: 'ARS', AT: 'EUR', AU: 'AUD', BD: 'BDT', BE: 'EUR', BG: 'BGN', BH: 'BHD', BR: 'BRL',
  CA: 'CAD', CH: 'CHF', CL: 'CLP', CN: 'CNY', CO: 'COP', CY: 'EUR', CZ: 'CZK', DE: 'EUR', DK: 'DKK',
  EE: 'EUR', EG: 'EGP', ES: 'EUR', FI: 'EUR', FJ: 'FJD', FR: 'EUR', GB: 'GBP', GE: 'GEL', GH: 'GHS',
  GR: 'EUR', HK: 'HKD', HR: 'EUR', HU: 'HUF', ID: 'IDR', IE: 'EUR', IL: 'ILS', IN: 'INR', IS: 'ISK',
  IT: 'EUR', JP: 'JPY', KE: 'KES', KR: 'KRW', KW: 'KWD', LK: 'LKR', LT: 'EUR', LU: 'EUR', LV: 'EUR',
  MA: 'MAD', MT: 'EUR', MX: 'MXN', MY: 'MYR', NG: 'NGN', NL: 'EUR', NO: 'NOK', NP: 'NPR', NZ: 'NZD',
  OM: 'OMR', PE: 'PEN', PH: 'PHP', PK: 'PKR', PL: 'PLN', PT: 'EUR', QA: 'QAR', RO: 'RON', RS: 'RSD',
  RU: 'RUB', SA: 'SAR', SE: 'SEK', SG: 'SGD', SI: 'EUR', SK: 'EUR', TH: 'THB', TR: 'TRY', TW: 'TWD',
  TZ: 'TZS', UA: 'UAH', UG: 'UGX', US: 'USD', VN: 'VND', ZA: 'ZAR',
};

type SupportedValuesOfIntl = typeof Intl & {
  supportedValuesOf?: (key: string) => string[];
};

export const getSupportedCurrencies = (): string[] => {
  try {
    const values = (Intl as SupportedValuesOfIntl).supportedValuesOf?.('currency');
    if (values?.length) return [...values].sort();
  } catch {
    // Older browsers use the fallback list.
  }
  return [...FALLBACK_CURRENCIES];
};

export const detectUserCurrency = (): string => {
  if (typeof navigator === 'undefined') return 'AUD';
  const locale = navigator.languages?.[0] || navigator.language || 'en-AU';
  try {
    const region = new Intl.Locale(locale).region;
    if (region && REGION_CURRENCY[region]) return REGION_CURRENCY[region];
  } catch {
    const region = locale.split('-')[1]?.toUpperCase();
    if (region && REGION_CURRENCY[region]) return REGION_CURRENCY[region];
  }
  return 'AUD';
};

export const getCurrencyLabel = (currency: string): string => {
  try {
    const display = new Intl.DisplayNames(undefined, { type: 'currency' }).of(currency);
    return display && display !== currency ? `${currency} — ${display}` : currency;
  } catch {
    return currency;
  }
};

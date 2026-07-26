import { useEffect } from 'react';
import { detectUserCurrency, getCurrencyLabel, getSupportedCurrencies } from '../lib/currency';

const enhanced = new WeakSet<HTMLInputElement>();

const setReactInputValue = (input: HTMLInputElement, value: string) => {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
};

export function CurrencyBootstrap() {
  const currencies = getSupportedCurrencies();

  useEffect(() => {
    const preferredCurrency = detectUserCurrency();

    const enhanceCurrencyInputs = () => {
      document.querySelectorAll<HTMLInputElement>('input[id*="currency" i]').forEach((input) => {
        if (enhanced.has(input)) return;
        enhanced.add(input);
        input.setAttribute('list', 'aleya-global-currencies');
        input.setAttribute('maxlength', '3');
        input.setAttribute('autocomplete', 'off');
        input.setAttribute('placeholder', preferredCurrency);
        input.setAttribute('aria-description', `Choose any ISO currency. Suggested for your region: ${preferredCurrency}.`);

        // The legacy blank-trip default was USD. Replace it once for a newly mounted
        // form when the browser region clearly indicates another home currency.
        if (input.value === 'USD' && preferredCurrency !== 'USD') {
          setReactInputValue(input, preferredCurrency);
        }
      });
    };

    enhanceCurrencyInputs();
    const observer = new MutationObserver(enhanceCurrencyInputs);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return (
    <datalist id="aleya-global-currencies">
      {currencies.map((currency) => (
        <option key={currency} value={currency}>{getCurrencyLabel(currency)}</option>
      ))}
    </datalist>
  );
}

# Travel Provider Integration Layer

The UI never calls supplier APIs directly. All inventory flows go through:

```
UI panels
  → Provider Gateway (src/providers/gateway.ts)
    → Provider interfaces (FlightProvider, HotelProvider, …)
      → Supplier adapters (Amadeus, Duffel, Booking.com, …)
        → Unified internal models
```

## Status

- Live commercial APIs are **not** connected.
- Every adapter returns **mock** inventory shaped like the future supplier contract.
- Suppliers can be toggled with env (`VITE_TRAVEL_PROVIDER_<ID>=enabled|disabled|pending`) without code changes.
- Private credentials must live in server/edge env only (documented in `.env.example`).

## Services

| Interface | Adapters (prepared) |
| --- | --- |
| FlightProvider | mock-flights, Amadeus, Duffel |
| HotelProvider | mock-hotels, Booking.com, Expedia Rapid, Hotelbeds |
| ActivitiesProvider | mock-activities, Viator |
| CarHireProvider | mock-car-hire, placeholder |
| CruiseProvider | mock-cruises, placeholder |
| TransferProvider | mock-transfers, placeholder |
| InsuranceProvider | mock-insurance (future) |
| RailProvider | mock-rail (future) |

## Switching providers

```bash
VITE_TRAVEL_PROVIDER_AMADEUS=enabled
VITE_TRAVEL_PROVIDER_DUFFEL=disabled
VITE_TRAVEL_PROVIDER_BOOKING_COM=pending
```

Rebuild / restart the app after env changes. No source edits required.

## Relationship to deal-engine adapters

`src/deal-engine/adapters/` remains the ranking/handoff demo path for the Super Deal Engine.
`src/providers/` is the product-facing integration layer for Flights, Hotels, and Travel Services.
Both stay mock-only until live approval.

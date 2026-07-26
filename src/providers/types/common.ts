/** Shared travel-provider types. UI and features must use these, never supplier payloads. */

export type ProviderMode = 'mock' | 'live';

/** Operational status for a supplier in config (no code change to switch). */
export type SupplierStatus = 'enabled' | 'disabled' | 'pending';

export type Money = {
  amount: number;
  currency: string;
};

export type ProviderSearchMeta = {
  providerId: string;
  displayName: string;
  mode: ProviderMode;
  searchedAt: string;
  /** Always false until live suppliers are approved and wired server-side. */
  isLiveInventory: boolean;
  warning?: string;
};

export type ProviderHealthStatus = 'healthy' | 'degraded' | 'down' | 'not_configured';

export type ProviderHealth = {
  providerId: string;
  displayName: string;
  status: ProviderHealthStatus;
  mode: ProviderMode;
  supplierStatus: SupplierStatus;
  message: string;
  checkedAt: string;
};

export type LocationRef = {
  code?: string;
  name: string;
  city?: string;
  country?: string;
};

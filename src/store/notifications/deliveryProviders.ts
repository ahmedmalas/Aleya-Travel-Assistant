/**
 * Future-ready notification delivery abstractions.
 * In-app centre remains the only active channel in this phase.
 */

export type DeliveryChannel = 'in_app' | 'email' | 'push' | 'sms' | 'calendar';

export type DeliveryPayload = {
  title: string;
  body: string;
  tripId?: string;
  deepLink?: string;
  severity?: 'info' | 'warning' | 'urgent';
};

export type DeliveryResult = {
  ok: boolean;
  channel: DeliveryChannel;
  message: string;
  deliveredAt?: string;
};

export interface NotificationDeliveryProvider {
  channel: DeliveryChannel;
  label: string;
  status: 'active' | 'placeholder';
  send(payload: DeliveryPayload): Promise<DeliveryResult>;
}

export const inAppDeliveryProvider: NotificationDeliveryProvider = {
  channel: 'in_app',
  label: 'In-app notification centre',
  status: 'active',
  async send(payload) {
    return {
      ok: true,
      channel: 'in_app',
      message: `Queued in-app: ${payload.title}`,
      deliveredAt: new Date().toISOString(),
    };
  },
};

const placeholder = (channel: Exclude<DeliveryChannel, 'in_app'>, label: string): NotificationDeliveryProvider => ({
  channel,
  label,
  status: 'placeholder',
  async send(payload) {
    return {
      ok: false,
      channel,
      message: `${label} is not connected. Payload retained for future delivery: ${payload.title}`,
    };
  },
});

export const emailDeliveryProvider = placeholder('email', 'Email notifications');
export const pushDeliveryProvider = placeholder('push', 'Push notifications');
export const smsDeliveryProvider = placeholder('sms', 'SMS notifications');
export const calendarDeliveryProvider = placeholder('calendar', 'Calendar reminders');

export const NOTIFICATION_DELIVERY_PROVIDERS: NotificationDeliveryProvider[] = [
  inAppDeliveryProvider,
  emailDeliveryProvider,
  pushDeliveryProvider,
  smsDeliveryProvider,
  calendarDeliveryProvider,
];

export async function deliverViaPreferredChannels(
  payload: DeliveryPayload,
  channels: DeliveryChannel[] = ['in_app'],
): Promise<DeliveryResult[]> {
  const providers = NOTIFICATION_DELIVERY_PROVIDERS.filter((provider) => channels.includes(provider.channel));
  return Promise.all(providers.map((provider) => provider.send(payload)));
}

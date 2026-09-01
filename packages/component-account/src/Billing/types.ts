export interface SubscriptionItemPrice {
  unit_amount: number;
  recurring: { interval: string };
}

export interface SubscriptionItem {
  current_period_start: number;
  current_period_end: number;
  price: SubscriptionItemPrice;
}

export interface Subscription {
  status?: string;
  currency: string;
  cancel_at_period_end?: boolean;
  cancel_at?: number | null;
  trial_start?: number | null;
  trial_end?: number | null;
  items?: { data?: SubscriptionItem[] };
}

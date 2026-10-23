import type { AgeCheckResult } from "@ngriffin_uk/polychat-schemas";

export type AnonymousUser = {
  id: string;
  ip_address: string;
  user_agent?: string;
  credit_period?: string | null;
  spent_credit_micros?: number;
  reserved_credit_micros?: number;
  created_at: string;
  updated_at: string;
  last_active_at?: string;
  captcha_verified?: number;
  age_check?: AgeCheckResult | null;
  age_checked_at?: string | null;
};

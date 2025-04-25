export interface User {
  id: string;
  name: string;
  github_username: string;
  email?: string;
  plan_id: "free" | "pro";
  avatar_url: string;
  created_at: string;
  updated_at: string;
  company: string;
  location: string;
  site: string;
  twitter_username: string;
  github_url: string;
  bio: string;
  message_count?: number;
  daily_message_count?: number;
  daily_reset?: string | null;
  daily_pro_message_count?: number;
  daily_pro_reset?: string | null;
  last_active_at?: string | null;
}

export interface UserSettings {
  id: string;
  nickname: string;
  job_role: string;
  traits: string;
  preferences: string;
}

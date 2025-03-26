export interface IUser {
  longitude?: number;
  latitude?: number;
  email: string;
  id: number;
}

export interface User {
  id: number;
  name: string | null;
  avatar_url: string | null;
  email: string;
  github_username: string | null;
  company: string | null;
  site: string | null;
  location: string | null;
  bio: string | null;
  twitter_username: string | null;
  created_at: string;
  updated_at: string;
  setup_at: string | null;
  terms_accepted_at: string | null;
  plan_id: string | null;
}

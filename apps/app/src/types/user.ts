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
}

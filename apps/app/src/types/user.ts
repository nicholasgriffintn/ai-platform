export interface User {
  id: string;
  name: string;
  github_username: string;
  email?: string;
  plan: "free" | "pro";
}
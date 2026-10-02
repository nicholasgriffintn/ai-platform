import type { BrowserApproval } from "@ngriffin_uk/polychat-schemas";

import type { IUser } from "~/types";

export const browserTestUser: IUser = {
  id: 1,
  name: "Browser tester",
  email: "browser@example.test",
  avatar_url: null,
  github_username: null,
  company: null,
  site: null,
  location: null,
  bio: null,
  twitter_username: null,
  created_at: "2026-10-02T00:00:00Z",
  updated_at: "2026-10-02T00:00:00Z",
  setup_at: null,
  terms_accepted_at: null,
  plan_id: "pro",
};

export const browserTestApproval: BrowserApproval = {
  requestId: "request-login",
  turnId: "turn-root",
  request: {
    type: "browser_authentication",
    credential_origin: "https://example.test",
    reason: "Read private issues",
    fields: [
      { id: "email", label: "Email", type: "email", required: true },
      { id: "password", label: "Password", type: "password", required: true },
      { id: "code", label: "Code", type: "text", required: true },
    ],
    options: [
      { id: "password", label: "Password", field_ids: ["email", "password"] },
      { id: "code", label: "Code", field_ids: ["code"] },
    ],
  },
};

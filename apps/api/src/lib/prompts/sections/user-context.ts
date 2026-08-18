import { escapeHtml } from "~/utils/html";

import { PromptBuilder } from "../builder";

interface UserContextOptions {
  date: string;
  userNickname?: string | null;
  userJobRole?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  language?: string | null;
}

export function buildUserContextSection({
  date,
  userNickname,
  userJobRole,
  latitude,
  longitude,
  language,
}: UserContextOptions): string {
  const builder = new PromptBuilder("<user_context>")
    .addLine()
    .addIf(!!userNickname, `<user_nickname>${escapeHtml(userNickname ?? "")}</user_nickname>`)
    .addIf(!!userJobRole, `<user_job_role>${escapeHtml(userJobRole ?? "")}</user_job_role>`)
    .addIf(!!date, `<current_date>${escapeHtml(date)}</current_date>`);

  if (
    latitude !== undefined &&
    latitude !== null &&
    longitude !== undefined &&
    longitude !== null
  ) {
    builder
      .addLine("<user_location>")
      .addLine(`<latitude>${latitude}</latitude><longitude>${longitude}</longitude>`)
      .addLine("</user_location>");
  }

  builder.addIf(
    !!language,
    `<preferred_language>${escapeHtml(language ?? "")}</preferred_language>`,
  );

  builder.addLine("</user_context>").addLine();

  return builder.build();
}

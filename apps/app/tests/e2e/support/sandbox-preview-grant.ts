import { sandboxPreviewGrantClaimsSchema } from "@ngriffin_uk/polychat-schemas";

export function replaceSandboxPreviewGrantIdentity(
  token: string,
  claim: "project_id" | "run_id",
  value: string,
): string {
  const segments = token.split(".");

  if (segments.length !== 3 || !segments[1]) {
    throw new Error("Sandbox preview grant is not a JWT");
  }

  const claims = sandboxPreviewGrantClaimsSchema.parse(
    JSON.parse(Buffer.from(segments[1], "base64url").toString("utf8")),
  );
  const changed = { ...claims, [claim]: value };

  segments[1] = Buffer.from(JSON.stringify(changed)).toString("base64url");

  return segments.join(".");
}

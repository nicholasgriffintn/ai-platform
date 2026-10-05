import type { JwtClaims } from "@ngriffin_uk/auth-jwt";
import type { OidcConnection } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import z from "zod/v4";

const verifiedProfileSchema = z.object({
  iss: z.string().min(1).max(2048),
  sub: z.string().min(1).max(500),
  exp: z.number().int().positive().max(8_640_000_000),
  email: z.string().trim().toLowerCase().pipe(z.email()),
  email_verified: z.literal(true),
  name: z.string().max(200).optional(),
});

export function resolveOidcProfile(connection: OidcConnection, claims: JwtClaims | null) {
  const profile = verifiedProfileSchema.safeParse(claims);

  if (
    !profile.success ||
    profile.data.iss !== connection.issuer ||
    profile.data.exp * 1000 <= Date.now()
  ) {
    throw new AssistantError(
      "The identity provider must supply a valid identity with a verified email",
      ErrorType.AUTHENTICATION_ERROR,
      401,
    );
  }

  return profile.data;
}

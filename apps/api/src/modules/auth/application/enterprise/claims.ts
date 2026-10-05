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
const groupsSchema = z.array(z.string().min(1).max(200)).max(1000);

export function resolveOidcProfile(connection: OidcConnection, claims: JwtClaims | null) {
  const profile = verifiedProfileSchema.safeParse(claims);
  const groups = groupsSchema.safeParse(claims?.[connection.groupsClaim]);

  if (!profile.success || profile.data.iss !== connection.issuer || !groups.success) {
    throw new AssistantError(
      "The identity provider must supply a verified email and a complete group claim",
      ErrorType.AUTHENTICATION_ERROR,
      401,
    );
  }

  const matching = connection.roleMappings.filter((mapping) => groups.data.includes(mapping.group));
  const role = matching.some((mapping) => mapping.role === "admin")
    ? "admin"
    : matching.length
      ? "member"
      : null;
  const expiresAt = new Date(Math.min(profile.data.exp * 1000, Date.now() + 15 * 60 * 1000));

  return { ...profile.data, role, expiresAt };
}

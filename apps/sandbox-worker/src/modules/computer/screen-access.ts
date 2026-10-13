import { isValidLeaseFence, signGrant, verifyGrant } from "@ngriffin_uk/polychat-library-sandbox";
import { teachingRecordingIdSchema } from "@ngriffin_uk/polychat-schemas";

export interface ScreenAccessPayload {
  origin: string;
  resourceId: string;
  fence: number;
  exp: number;
  viewOnly?: boolean;
  recordingId?: string;
}

export function signScreenAccess(secret: string, payload: ScreenAccessPayload): Promise<string> {
  return signGrant(secret, payload);
}

export function verifyScreenAccess(
  secret: string,
  token: string,
  origin: string,
): Promise<ScreenAccessPayload | null> {
  return verifyGrant(secret, token, (claims) => {
    if (
      claims.origin !== origin ||
      typeof claims.resourceId !== "string" ||
      !isValidLeaseFence(claims.fence) ||
      typeof claims.exp !== "number" ||
      (claims.viewOnly !== undefined && typeof claims.viewOnly !== "boolean") ||
      (claims.recordingId !== undefined &&
        !teachingRecordingIdSchema.safeParse(claims.recordingId).success)
    ) {
      return null;
    }

    return {
      origin,
      resourceId: claims.resourceId,
      fence: claims.fence,
      exp: claims.exp,
      ...(claims.viewOnly === true ? { viewOnly: true } : {}),
      ...(typeof claims.recordingId === "string" ? { recordingId: claims.recordingId } : {}),
    };
  });
}

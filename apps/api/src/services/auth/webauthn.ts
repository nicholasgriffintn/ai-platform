import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type {
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/types";
import type { Database } from "~/lib/database";
import type { User } from "../../types";
import { AssistantError, ErrorType } from "../../utils/errors";

export async function saveWebAuthnChallenge(
  database: Database,
  challenge: string,
  userId?: number,
): Promise<void> {
  try {
    await database.createWebAuthnChallenge(challenge, userId);
  } catch (error) {
    console.error("Error saving WebAuthn challenge:", error);
    throw new AssistantError(
      "Failed to save WebAuthn challenge",
      ErrorType.UNKNOWN_ERROR,
    );
  }
}

export async function getWebAuthnChallenge(
  database: Database,
  challenge?: string,
  userId?: number,
): Promise<string> {
  try {
    let challengeRecord;

    if (challenge && userId) {
      challengeRecord = await database.getWebAuthnChallenge(challenge, userId);
    } else if (challenge) {
      challengeRecord = await database.getWebAuthnChallenge(challenge);
    } else if (userId) {
      challengeRecord = await database.getWebAuthnChallengeByUserId(userId);
    }

    if (!challengeRecord?.challenge) {
      throw new AssistantError(
        "WebAuthn challenge not found or expired",
        ErrorType.AUTHENTICATION_ERROR,
      );
    }

    return challengeRecord.challenge;
  } catch (error) {
    if (error instanceof AssistantError) {
      throw error;
    }
    console.error("Error getting WebAuthn challenge:", error);
    throw new AssistantError(
      "Failed to retrieve WebAuthn challenge",
      ErrorType.UNKNOWN_ERROR,
    );
  }
}

export async function deleteWebAuthnChallenge(
  database: Database,
  challenge: string,
  userId?: number,
): Promise<void> {
  try {
    await database.deleteWebAuthnChallenge(challenge, userId);
  } catch (error) {
    console.error("Error deleting WebAuthn challenge:", error);
  }
}

export async function registerPasskey(
  database: Database,
  userId: number,
  credentialId: string,
  publicKey: Uint8Array,
  counter: number,
  deviceType: string,
  backedUp: boolean,
  transports?: AuthenticatorTransportFuture[],
): Promise<void> {
  try {
    await database.createPasskey(
      userId,
      credentialId,
      publicKey,
      counter,
      deviceType,
      backedUp,
      transports,
    );
  } catch (error) {
    console.error("Error registering passkey:", error);
    throw new AssistantError(
      "Failed to register passkey",
      ErrorType.UNKNOWN_ERROR,
    );
  }
}

export async function getUserPasskeys(
  database: Database,
  userId: number,
): Promise<Record<string, unknown>[]> {
  try {
    return await database.getPasskeysByUserId(userId);
  } catch (error) {
    console.error("Error getting user passkeys:", error);
    return [];
  }
}

export async function getPasskeyWithUser(
  database: Database,
  credentialId: string,
): Promise<{
  credential: Record<string, unknown>;
  user: Partial<User>;
} | null> {
  try {
    const result = await database.getPasskeyByCredentialId(credentialId);

    if (!result) {
      return null;
    }

    const user: Partial<User> = {
      id: result.user_id as number,
      email: result.email as string,
      name: (result.name as string) || null,
      github_username: (result.github_username as string) || null,
      avatar_url: (result.avatar_url as string) || null,
    };

    return {
      credential: result,
      user,
    };
  } catch (error) {
    console.error("Error getting passkey with user:", error);
    return null;
  }
}

export async function updatePasskeyCounter(
  database: Database,
  credentialId: string,
  counter: number,
): Promise<void> {
  try {
    await database.updatePasskeyCounter(credentialId, counter);
  } catch (error) {
    console.error("Error updating passkey counter:", error);
  }
}

export async function deletePasskey(
  database: Database,
  passkeyId: number,
  userId: number,
): Promise<boolean> {
  try {
    const success = await database.deletePasskey(passkeyId, userId);
    return success;
  } catch (error) {
    console.error("Error deleting passkey:", error);
    throw new AssistantError(
      "Failed to delete passkey",
      ErrorType.UNKNOWN_ERROR,
    );
  }
}

export async function generatePasskeyRegistrationOptions(
  database: Database,
  user: User,
  rpName: string,
  rpID: string,
): Promise<PublicKeyCredentialCreationOptionsJSON> {
  try {
    const existingCredentials = await getUserPasskeys(database, user.id);

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: new TextEncoder().encode(user.id.toString()),
      userName: user.github_username || user.email,
      attestationType: "none",
      excludeCredentials: existingCredentials.map((cred) => ({
        id: cred.credential_id as string,
        type: "public-key",
        transports: cred.transports
          ? JSON.parse(cred.transports as string)
          : undefined,
      })),
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
      },
    });

    await saveWebAuthnChallenge(database, options.challenge, user.id);

    return options;
  } catch (error) {
    console.error("Error generating passkey registration options:", error);
    throw new AssistantError(
      "Failed to generate passkey registration options",
      ErrorType.UNKNOWN_ERROR,
    );
  }
}

export async function verifyAndRegisterPasskey(
  database: Database,
  user: User,
  response: RegistrationResponseJSON,
  expectedOrigin: string,
  expectedRPID: string,
): Promise<boolean> {
  try {
    const challenge = await getWebAuthnChallenge(database, undefined, user.id);

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin,
      expectedRPID,
    });

    const { verified, registrationInfo } = verification;

    if (verified && registrationInfo) {
      const { credential } = registrationInfo;
      const credentialId = Buffer.from(credential.id).toString("base64url");

      const existingCredentials = await getUserPasskeys(database, user.id);
      const duplicateCredential = existingCredentials.find(
        (cred) => cred.credential_id === credentialId,
      );

      if (duplicateCredential) {
        console.warn(
          `Attempt to register duplicate credential ID: ${credentialId}`,
        );
        throw new AssistantError(
          "This passkey is already registered",
          ErrorType.AUTHENTICATION_ERROR,
        );
      }

      await registerPasskey(
        database,
        user.id,
        credentialId,
        credential.publicKey,
        credential.counter,
        registrationInfo.credentialDeviceType,
        registrationInfo.credentialBackedUp,
      );

      await deleteWebAuthnChallenge(database, challenge, user.id);
    }

    return verified;
  } catch (error: any) {
    console.error("Error verifying passkey registration:", error);
    throw new AssistantError(
      `WebAuthn registration failed: ${error.message}`,
      ErrorType.AUTHENTICATION_ERROR,
    );
  }
}

export async function generatePasskeyAuthenticationOptions(
  database: Database,
  rpID: string,
  username?: string,
): Promise<PublicKeyCredentialRequestOptionsJSON> {
  try {
    let userId;

    if (username) {
      const user = await database.getUserByEmail(username);

      if (!user) {
        throw new AssistantError(
          "User not found",
          ErrorType.AUTHENTICATION_ERROR,
        );
      }

      userId = user.id;
    }

    let allowCredentials: {
      id: string;
      type: "public-key";
      transports?: AuthenticatorTransportFuture[];
    }[] = [];

    if (userId) {
      const credentials = await getUserPasskeys(database, userId);

      allowCredentials = credentials.map((cred) => ({
        id: cred.credential_id as string,
        type: "public-key" as const,
        transports: cred.transports
          ? JSON.parse(cred.transports as string)
          : undefined,
      }));
    }

    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: "preferred",
      allowCredentials,
    });

    await saveWebAuthnChallenge(database, options.challenge, userId);

    return options;
  } catch (error) {
    console.error("Error generating passkey authentication options:", error);
    if (error instanceof AssistantError) {
      throw error;
    }
    throw new AssistantError(
      "Failed to generate passkey authentication options",
      ErrorType.UNKNOWN_ERROR,
    );
  }
}

export async function verifyPasskeyAuthentication(
  database: Database,
  response: AuthenticationResponseJSON,
  expectedOrigin: string,
  expectedRPID: string,
): Promise<{ verified: boolean; user?: Partial<User> }> {
  try {
    const credentialID = response.id;

    const passkeyWithUser = await getPasskeyWithUser(database, credentialID);

    if (!passkeyWithUser) {
      throw new AssistantError(
        "Authenticator not registered",
        ErrorType.AUTHENTICATION_ERROR,
      );
    }

    const { credential, user } = passkeyWithUser;

    const challenge = await getWebAuthnChallenge(database);

    if (!challenge) {
      throw new AssistantError(
        "Authentication challenge expired or not found",
        ErrorType.AUTHENTICATION_ERROR,
      );
    }

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin,
      expectedRPID,
      requireUserVerification: true,
      credential: {
        id: credentialID,
        publicKey: credential.public_key as Uint8Array,
        counter: credential.counter as number,
      },
    });

    const { verified, authenticationInfo } = verification;

    if (verified) {
      await updatePasskeyCounter(
        database,
        credentialID,
        authenticationInfo.newCounter,
      );

      await deleteWebAuthnChallenge(database, challenge);

      return { verified, user };
    }

    return { verified };
  } catch (error: any) {
    console.error("Error verifying passkey authentication:", error);
    if (error instanceof AssistantError) {
      throw error;
    }
    throw new AssistantError(
      `WebAuthn authentication failed: ${error.message}`,
      ErrorType.AUTHENTICATION_ERROR,
    );
  }
}

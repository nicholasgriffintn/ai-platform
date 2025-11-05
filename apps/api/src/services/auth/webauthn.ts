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

import type { RepositoryManager } from "~/repositories";
import type { User } from "~/types";
import { decodeBase64Url } from "~/utils/base64url";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";
import { safeParseJson } from "../../utils/json";

const logger = getLogger({ prefix: "services/auth/webauthn" });

export async function saveWebAuthnChallenge(
	repositories: RepositoryManager,
	challenge: string,
	userId?: number,
): Promise<void> {
	try {
		await repositories.webAuthn.createChallenge(challenge, userId);
	} catch (error) {
		logger.error("Error saving WebAuthn challenge:", { error });
		throw new AssistantError(
			`Failed to save WebAuthn challenge: ${error}`,
			ErrorType.UNKNOWN_ERROR,
		);
	}
}

export async function getWebAuthnChallenge(
	repositories: RepositoryManager,
	challenge?: string,
	userId?: number,
): Promise<string> {
	try {
		let challengeRecord;

		if (challenge && userId) {
			challengeRecord = await repositories.webAuthn.getChallenge(
				challenge,
				userId,
			);
		} else if (challenge) {
			challengeRecord = await repositories.webAuthn.getChallenge(challenge);
		} else if (userId) {
			challengeRecord =
				await repositories.webAuthn.getChallengeByUserId(userId);
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
		logger.error("Error getting WebAuthn challenge:", { error });
		throw new AssistantError(
			"Failed to retrieve WebAuthn challenge",
			ErrorType.UNKNOWN_ERROR,
		);
	}
}

export async function deleteWebAuthnChallenge(
	repositories: RepositoryManager,
	challenge: string,
	userId?: number,
): Promise<void> {
	try {
		await repositories.webAuthn.deleteChallenge(challenge, userId);
	} catch (error) {
		logger.error("Error deleting WebAuthn challenge:", { error });
	}
}

export async function registerPasskey(
	repositories: RepositoryManager,
	userId: number,
	credentialId: string,
	publicKey: Uint8Array,
	counter: number,
	deviceType: string,
	backedUp: boolean,
	transports?: AuthenticatorTransportFuture[],
): Promise<void> {
	try {
		await repositories.webAuthn.createPasskey(
			userId,
			credentialId,
			publicKey,
			counter,
			deviceType,
			backedUp,
			transports,
		);
	} catch (error) {
		logger.error("Error registering passkey:", { error });
		throw new AssistantError(
			"Failed to register passkey",
			ErrorType.UNKNOWN_ERROR,
		);
	}
}

export async function getUserPasskeys(
	repositories: RepositoryManager,
	userId: number,
): Promise<Record<string, unknown>[]> {
	try {
		return await repositories.webAuthn.getPasskeysByUserId(userId);
	} catch (error) {
		logger.error("Error getting user passkeys:", { error });
		return [];
	}
}

export async function getPasskeyWithUser(
	repositories: RepositoryManager,
	credentialId: string,
): Promise<{
	credential: Record<string, unknown>;
	user: Partial<User>;
} | null> {
	try {
		const result =
			await repositories.webAuthn.getPasskeyByCredentialId(credentialId);

		if (!result) {
			return null;
		}

		const user: Partial<User> = {
			id: result.user_id as number,
			email: result.email as string,
			name: (result.name as string) || null,
			github_username: (result.github_username as string) || null,
			role: (result.role as string) || null,
			avatar_url: (result.avatar_url as string) || null,
		};

		return {
			credential: result,
			user,
		};
	} catch (error) {
		logger.error("Error getting passkey with user:", { error });
		return null;
	}
}

export async function updatePasskeyCounter(
	repositories: RepositoryManager,
	credentialId: string,
	counter: number,
): Promise<void> {
	try {
		await repositories.webAuthn.updatePasskeyCounter(credentialId, counter);
	} catch (error) {
		logger.error("Error updating passkey counter:", { error });
	}
}

export async function deletePasskey(
	repositories: RepositoryManager,
	passkeyId: number,
	userId: number,
): Promise<boolean> {
	try {
		const success = await repositories.webAuthn.deletePasskey(
			passkeyId,
			userId,
		);
		return success;
	} catch (error) {
		logger.error("Error deleting passkey:", { error });
		throw new AssistantError(
			"Failed to delete passkey",
			ErrorType.UNKNOWN_ERROR,
		);
	}
}

export async function generatePasskeyRegistrationOptions(
	repositories: RepositoryManager,
	user: User,
	rpName: string,
	rpID: string,
): Promise<PublicKeyCredentialCreationOptionsJSON> {
	try {
		if (!user.id) {
			throw new AssistantError(
				"User ID is required",
				ErrorType.AUTHENTICATION_ERROR,
			);
		}

		const existingCredentials = await getUserPasskeys(repositories, user.id);

		const options = await generateRegistrationOptions({
			rpName,
			rpID,
			userID: new TextEncoder().encode(user.id.toString()),
			userName: user.github_username || user.email,
			attestationType: "none",
			excludeCredentials: existingCredentials.map((cred) => {
				let parsedTransports = safeParseJson(cred.transports as string);
				if (!parsedTransports) {
					logger.error("Failed to parse transports", {
						error: cred.transports,
					});
					parsedTransports = undefined;
				}
				return {
					id: cred.credential_id as string,
					type: "public-key",
					transports: parsedTransports,
				};
			}),
			authenticatorSelection: {
				residentKey: "preferred",
				userVerification: "preferred",
			},
		});

		await saveWebAuthnChallenge(repositories, options.challenge, user.id);

		return options;
	} catch (error) {
		logger.error("Error generating passkey registration options:", { error });
		throw new AssistantError(
			"Failed to generate passkey registration options",
			ErrorType.UNKNOWN_ERROR,
		);
	}
}

export async function verifyAndRegisterPasskey(
	repositories: RepositoryManager,
	user: User,
	response: RegistrationResponseJSON,
	expectedOrigin: string,
	expectedRPID: string,
): Promise<boolean> {
	try {
		const challenge = await getWebAuthnChallenge(
			repositories,
			undefined,
			user.id,
		);

		const verification = await verifyRegistrationResponse({
			response,
			expectedChallenge: challenge,
			expectedOrigin,
			expectedRPID,
		});

		const { verified, registrationInfo } = verification;

		if (verified && registrationInfo) {
			const { credential } = registrationInfo;

			const credentialId = response.rawId || response.id;

			const existingCredentials = await getUserPasskeys(repositories, user.id);
			const duplicateCredential = existingCredentials.find(
				(cred) => cred.credential_id === credentialId,
			);

			if (duplicateCredential) {
				logger.warn(
					`Attempt to register duplicate credential ID: ${credentialId}`,
				);
				throw new AssistantError(
					"This passkey is already registered",
					ErrorType.AUTHENTICATION_ERROR,
				);
			}

			try {
				await registerPasskey(
					repositories,
					user.id,
					credentialId,
					credential.publicKey,
					credential.counter,
					registrationInfo.credentialDeviceType,
					registrationInfo.credentialBackedUp,
				);
			} catch (err) {
				logger.error("Database error during passkey registration:", { err });
				throw new AssistantError(
					"Failed to save passkey to database",
					ErrorType.UNKNOWN_ERROR,
				);
			}

			await deleteWebAuthnChallenge(repositories, challenge, user.id);
		}

		return verified;
	} catch (error: any) {
		logger.error("Error verifying passkey registration:", { error });
		throw new AssistantError(
			"WebAuthn verifyAndRegisterPasskey failed",
			ErrorType.AUTHENTICATION_ERROR,
		);
	}
}

export async function generatePasskeyAuthenticationOptions(
	repositories: RepositoryManager,
	rpID: string,
): Promise<PublicKeyCredentialRequestOptionsJSON> {
	try {
		const options = await generateAuthenticationOptions({
			rpID,
			userVerification: "preferred",
		});

		await saveWebAuthnChallenge(repositories, options.challenge);

		return options;
	} catch (error) {
		logger.error("Error generating passkey authentication options:", { error });
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
	repositories: RepositoryManager,
	response: AuthenticationResponseJSON,
	expectedOrigin: string,
	expectedRPID: string,
): Promise<{ verified: boolean; user?: Partial<User> }> {
	try {
		const credentialID = response.id;

		const passkeyWithUser = await getPasskeyWithUser(
			repositories,
			credentialID,
		);

		if (!passkeyWithUser) {
			throw new AssistantError(
				"Authenticator not registered",
				ErrorType.AUTHENTICATION_ERROR,
			);
		}

		const { credential, user } = passkeyWithUser;

		const clientDataBytes = decodeBase64Url(response.response.clientDataJSON);
		const clientDataText = new TextDecoder().decode(clientDataBytes);
		let clientData;
		clientData = safeParseJson(clientDataText);
		if (!clientData) {
			logger.error("Failed to parse client data", { error: clientDataText });
			throw new AssistantError(
				"Failed to parse client data",
				ErrorType.AUTHENTICATION_ERROR,
			);
		}
		const challengeFromClient = clientData.challenge;

		const expectedChallenge = await getWebAuthnChallenge(
			repositories,
			challengeFromClient,
		);

		const publicKeyString = credential.public_key as string;
		const publicKeyBytes = decodeBase64Url(publicKeyString);

		const verification = await verifyAuthenticationResponse({
			response,
			expectedChallenge,
			expectedOrigin,
			expectedRPID,
			requireUserVerification: true,
			credential: {
				id: credentialID,
				publicKey: publicKeyBytes,
				counter: credential.counter as number,
			},
		});

		const { verified, authenticationInfo } = verification;

		if (verified) {
			await updatePasskeyCounter(
				repositories,
				credentialID,
				authenticationInfo.newCounter,
			);

			await deleteWebAuthnChallenge(repositories, expectedChallenge);

			return { verified, user };
		}

		return { verified };
	} catch (error: any) {
		logger.error("Error verifying passkey authentication:", { error });
		if (error instanceof AssistantError) {
			throw error;
		}
		throw new AssistantError(
			"WebAuthn authentication failed",
			ErrorType.AUTHENTICATION_ERROR,
		);
	}
}

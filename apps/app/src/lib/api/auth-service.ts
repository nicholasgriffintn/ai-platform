import { API_BASE_URL } from "~/constants";
import { apiKeyService } from "~/lib/api/api-key";
import type { User, UserSettings } from "~/types";
import { fetchApi } from "./fetch-wrapper";

interface MagicLinkSuccessResponse {
	success: boolean;
}

interface MagicLinkErrorResponse {
	error: string;
}

class AuthService {
	private static instance: AuthService;
	private user: User | null = null;
	private userSettings: UserSettings | null = null;
	private tokenExpiry: Date | null = null;
	private refreshTimer: NodeJS.Timeout | null = null;

	private constructor() {}

	public static getInstance(): AuthService {
		if (!AuthService.instance) {
			AuthService.instance = new AuthService();
		}
		return AuthService.instance;
	}

	public initiateGithubLogin(): void {
		window.location.href = `${API_BASE_URL}/auth/github`;
	}

	public isPasskeySupported(): boolean {
		return (
			window.PublicKeyCredential !== undefined &&
			typeof window.PublicKeyCredential === "function"
		);
	}

	public async isConditionalUISupported(): Promise<boolean> {
		if (!this.isPasskeySupported()) {
			return false;
		}

		try {
			return await window.PublicKeyCredential.isConditionalMediationAvailable();
		} catch (_e) {
			return false;
		}
	}

	public async checkAuthStatus(): Promise<boolean> {
		try {
			const response = await fetchApi("/auth/me", {
				method: "GET",
			});

			if (!response.ok) {
				this.user = null;
				this.userSettings = null;
				return false;
			}

			const data = (await response.json()) as {
				user: User;
				userSettings: UserSettings;
			};
			if (data?.user) {
				this.user = data.user;
				this.userSettings = data.userSettings;
				return true;
			}

			this.user = null;
			this.userSettings = null;
			return false;
		} catch (error) {
			console.error("Error checking auth status:", error);
			this.user = null;
			this.userSettings = null;
			return false;
		}
	}

	public async getToken(): Promise<string | null> {
		try {
			if (
				this.tokenExpiry &&
				Date.now() < this.tokenExpiry.getTime() - 2 * 60 * 1000
			) {
				const existingToken = await apiKeyService.getApiKey();
				if (existingToken) {
					return existingToken;
				}
			}

			const response = await fetchApi("/auth/token", {
				method: "GET",
			});

			if (!response.ok) {
				return null;
			}

			const data = (await response.json()) as {
				token: string;
				expires_in: number;
			};
			if (data?.token && data?.expires_in) {
				this.tokenExpiry = new Date(Date.now() + data.expires_in * 1000);
				this.scheduleTokenRefresh();
				await apiKeyService.setApiKey(data.token);
				return data.token;
			}

			return null;
		} catch (error) {
			console.error("Error getting token:", error);
			return null;
		}
	}

	private scheduleTokenRefresh(): void {
		if (this.refreshTimer) {
			clearTimeout(this.refreshTimer);
		}

		if (!this.tokenExpiry) {
			return;
		}

		const refreshTime = this.tokenExpiry.getTime() - Date.now() - 3 * 60 * 1000;

		if (refreshTime > 0) {
			this.refreshTimer = setTimeout(async () => {
				await this.getToken();
			}, refreshTime);
		}
	}

	private clearTokenRefresh(): void {
		if (this.refreshTimer) {
			clearTimeout(this.refreshTimer);
			this.refreshTimer = null;
		}
		this.tokenExpiry = null;
	}

	public async logout(): Promise<boolean> {
		try {
			const response = await fetchApi("/auth/logout", {
				method: "POST",
			});

			if (response.ok) {
				this.clearTokenRefresh();
				apiKeyService.removeApiKey();
				this.user = null;
				this.userSettings = null;
				return true;
			}

			return false;
		} catch (error) {
			console.error("Error logging out:", error);
			return false;
		}
	}

	public getUser(): User | null {
		return this.user;
	}

	public getUserSettings(): UserSettings | null {
		return this.userSettings;
	}

	public async updateUserSettings(
		settings: Partial<UserSettings>,
	): Promise<boolean> {
		try {
			const response = await fetchApi("/user/settings", {
				method: "PUT",
				body: settings,
			});

			if (!response.ok) {
				return false;
			}

			await this.checkAuthStatus();

			return true;
		} catch (error) {
			console.error("Error updating user settings:", error);
			return false;
		}
	}

	public async requestMagicLink(
		email: string,
	): Promise<{ success: boolean; error?: string }> {
		try {
			const response = await fetchApi("/auth/magic-link/request", {
				method: "POST",
				body: JSON.stringify({ email }),
			});

			if (!response.ok) {
				const errorData = (await response
					.json()
					.catch(() => ({}))) as Partial<MagicLinkErrorResponse>;
				return {
					success: false,
					error: errorData.error || "Failed to request magic link.",
				};
			}

			const data = (await response.json()) as MagicLinkSuccessResponse;
			return { success: data.success };
		} catch (error: any) {
			console.error("Error requesting magic link:", error);
			return {
				success: false,
				error: error.message || "An unexpected error occurred.",
			};
		}
	}

	public async verifyMagicLink(
		token: string,
		nonce: string,
	): Promise<{ success: boolean; error?: string }> {
		try {
			const response = await fetchApi("/auth/magic-link/verify", {
				method: "POST",
				body: JSON.stringify({ token, nonce }),
			});

			const data = (await response.json()) as {
				success: boolean;
				error?: string;
			};

			if (!response.ok) {
				return {
					success: false,
					error: data.error || "Failed to verify magic link.",
				};
			}

			return { success: data.success };
		} catch (error: any) {
			console.error("Error verifying magic link:", error);
			return {
				success: false,
				error: error.message || "An unexpected error occurred.",
			};
		}
	}
}

export const authService = AuthService.getInstance();

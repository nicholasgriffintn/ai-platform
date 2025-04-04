import { API_BASE_URL } from "~/constants";
import { apiKeyService } from "~/lib/api/api-key";
import type { User, UserSettings } from "~/types";

class AuthService {
  private static instance: AuthService;
  private user: User | null = null;
  private userSettings: UserSettings | null = null;

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

  public async checkAuthStatus(): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        this.user = null;
        this.userSettings = null;
        return false;
      }

      const data = (await response.json()) as any;
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
      const response = await fetch(`${API_BASE_URL}/auth/token`, {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as any;
      if (data?.token) {
        await apiKeyService.setApiKey(data.token);
        return data.token;
      }

      return null;
    } catch (error) {
      console.error("Error getting token:", error);
      return null;
    }
  }

  public async logout(): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
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
      const response = await fetch(`${API_BASE_URL}/user/settings`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        return false;
      }

      // Update local copy of user settings
      await this.checkAuthStatus();

      return true;
    } catch (error) {
      console.error("Error updating user settings:", error);
      return false;
    }
  }
}

export const authService = AuthService.getInstance();

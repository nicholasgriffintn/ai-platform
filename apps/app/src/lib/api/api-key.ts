const RETIRED_STORAGE_KEYS = ["encrypted_api_key", "api_key"];

let accessToken: string | null = null;

function discardRetiredStorage(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    for (const key of RETIRED_STORAGE_KEYS) {
      window.localStorage.removeItem(key);
    }
  } catch {
    return;
  }
}

export const apiKeyService = {
  setApiKey: async (apiKey: string): Promise<void> => {
    accessToken = apiKey;
    discardRetiredStorage();
  },

  getApiKey: async (): Promise<string | null> => {
    discardRetiredStorage();

    return accessToken;
  },

  removeApiKey: (): void => {
    accessToken = null;
    discardRetiredStorage();
  },

  validateApiKey: (apiKey: string): boolean => {
    return (
      typeof apiKey === "string" &&
      apiKey.length >= 32 &&
      apiKey.length <= 256 &&
      /^[a-zA-Z0-9_-]+$/.test(apiKey)
    );
  },
};

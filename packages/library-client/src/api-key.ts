let accessToken: string | null = null;

export const apiKeyService = {
  setApiKey: async (apiKey: string): Promise<void> => {
    accessToken = apiKey;
  },

  getApiKey: async (): Promise<string | null> => {
    return accessToken;
  },

  removeApiKey: (): void => {
    accessToken = null;
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

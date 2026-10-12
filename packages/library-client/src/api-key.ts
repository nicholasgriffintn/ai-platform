export type AccessTokenSource = () => Promise<string | null>;

let accessToken: string | null = null;
let tokenSource: AccessTokenSource | null = null;

export const apiKeyService = {
  setApiKey: async (apiKey: string): Promise<void> => {
    accessToken = apiKey;
  },

  getApiKey: async (): Promise<string | null> => {
    return tokenSource ? tokenSource() : accessToken;
  },

  removeApiKey: (): void => {
    accessToken = null;
  },

  setTokenSource: (source: AccessTokenSource | null): void => {
    tokenSource = source;
  },

  hasTokenSource: (): boolean => tokenSource !== null,

  validateApiKey: (apiKey: string): boolean => {
    return (
      typeof apiKey === "string" &&
      apiKey.length >= 32 &&
      apiKey.length <= 256 &&
      /^[a-zA-Z0-9_-]+$/.test(apiKey)
    );
  },
};

import z from "zod/v4";

export const protectedResourceMetadataSchema = z.object({
  resource: z.string().optional(),
  authorization_servers: z.array(z.string()).optional(),
  scopes_supported: z.array(z.string()).optional(),
});

export const authorizationServerMetadataSchema = z.object({
  issuer: z.string(),
  authorization_endpoint: z.string(),
  token_endpoint: z.string(),
  registration_endpoint: z.string().optional(),
  code_challenge_methods_supported: z.array(z.string()).optional(),
  scopes_supported: z.array(z.string()).optional(),
});

export const clientRegistrationResponseSchema = z.object({
  client_id: z.string().min(1),
  client_secret: z.string().optional(),
});

export const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string().default("Bearer"),
  expires_in: z.number().optional(),
  refresh_token: z.string().optional(),
  scope: z.string().optional(),
});

export interface McpAuthorizationServer {
  issuer: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  registrationEndpoint?: string;
}

export interface McpAuthorizationDiscovery {
  resource: string;
  authorizationServer: McpAuthorizationServer;
  scopes?: string[];
}

export interface McpOAuthClient {
  clientId: string;
  clientSecret?: string;
}

export interface McpOAuthTokens {
  accessToken: string;
  tokenType: string;
  refreshToken?: string;
  expiresAt?: string;
}

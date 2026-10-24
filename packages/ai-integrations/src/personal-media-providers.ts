import type { ConnectorProviderConfig } from "./providers.js";

const limitProperty = { type: "integer", minimum: 1, maximum: 100 };

export const personalMediaConnectorProviders: ConnectorProviderConfig[] = [
  {
    id: "readwise",
    name: "Readwise",
    description: "Read your Readwise highlights and your Reader reading queue.",
    categories: [{ id: "reading", name: "Reading" }],
    setupUrl: "/chat/plugins?connector=readwise",
    operations: [
      {
        id: "list_highlights",
        access: "read",
        inputSchema: {
          type: "object",
          properties: {
            updatedAfter: { type: "string", description: "ISO date-time to read changes since." },
            pageCursor: { type: "string" },
          },
        },
      },
      {
        id: "list_reader_documents",
        access: "read",
        inputSchema: {
          type: "object",
          properties: {
            location: { type: "string", enum: ["new", "later", "shortlist", "archive", "feed"] },
            updatedAfter: { type: "string" },
            pageCursor: { type: "string" },
          },
        },
      },
    ],
    auth: { authType: "api_key", credentialLabel: "Access token", scopes: ["highlights:read"] },
  },
  {
    id: "lastfm",
    name: "Last.fm",
    description: "Read what you've been listening to from your Last.fm scrobbles.",
    categories: [{ id: "music", name: "Music" }],
    setupUrl: "/chat/plugins?connector=lastfm",
    operations: ["get_recent_tracks", "get_top_artists", "get_top_tracks"].map((id) => ({
      id,
      access: "read" as const,
      inputSchema: {
        type: "object",
        required: ["user"],
        properties: {
          user: { type: "string", description: "The Last.fm username." },
          period: {
            type: "string",
            enum: ["overall", "7day", "1month", "3month", "6month", "12month"],
          },
          limit: limitProperty,
        },
      },
    })),
    auth: { authType: "api_key", credentialLabel: "API key", scopes: ["scrobbles:read"] },
  },
  {
    id: "trakt",
    name: "Trakt",
    description: "Read the films and shows you've watched and want to watch on Trakt.",
    categories: [{ id: "video", name: "Film and TV" }],
    setupUrl: "/chat/plugins?connector=trakt",
    operations: ["get_history", "get_watchlist"].map((id) => ({
      id,
      access: "read" as const,
      inputSchema: {
        type: "object",
        required: ["username"],
        properties: {
          username: { type: "string", description: "A public Trakt username." },
          type: { type: "string", enum: ["movies", "shows"] },
          limit: limitProperty,
        },
      },
    })),
    auth: { authType: "api_key", credentialLabel: "Client ID", scopes: ["history:read"] },
  },
  {
    id: "hardcover",
    name: "Hardcover",
    description: "Read the books you're reading, want to read and have finished on Hardcover.",
    categories: [{ id: "reading", name: "Reading" }],
    setupUrl: "/chat/plugins?connector=hardcover",
    operations: [
      {
        id: "list_books",
        access: "read",
        inputSchema: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["want_to_read", "currently_reading", "read"] },
            limit: { type: "integer", minimum: 1, maximum: 50 },
          },
        },
      },
    ],
    auth: { authType: "api_key", credentialLabel: "API token", scopes: ["books:read"] },
  },
  {
    id: "podcastindex",
    name: "Podcast Index",
    description: "Find podcasts and their newest episodes in the open Podcast Index.",
    categories: [{ id: "podcasts", name: "Podcasts" }],
    setupUrl: "/chat/plugins?connector=podcastindex",
    operations: [
      {
        id: "search_podcasts",
        access: "read",
        inputSchema: {
          type: "object",
          required: ["query"],
          properties: {
            query: { type: "string" },
            max: { type: "integer", minimum: 1, maximum: 50 },
          },
        },
      },
      {
        id: "recent_episodes",
        access: "read",
        inputSchema: {
          type: "object",
          required: ["feedId"],
          properties: {
            feedId: { type: "integer" },
            max: { type: "integer", minimum: 1, maximum: 50 },
          },
        },
      },
    ],
    auth: {
      authType: "api_key",
      credentialLabel: "API key and secret, as key:secret",
      scopes: ["search:read"],
    },
  },
  {
    id: "oura",
    name: "Oura",
    description: "Read your Oura readiness, sleep and activity scores.",
    categories: [{ id: "health", name: "Health" }],
    setupUrl: "/chat/plugins?connector=oura",
    operations: ["get_daily_readiness", "get_daily_sleep", "get_daily_activity"].map((id) => ({
      id,
      access: "read" as const,
      inputSchema: {
        type: "object",
        properties: {
          startDate: { type: "string", description: "First day, as YYYY-MM-DD." },
          endDate: { type: "string", description: "Last day, as YYYY-MM-DD." },
        },
      },
    })),
    auth: { authType: "api_key", credentialLabel: "Personal access token", scopes: ["daily"] },
  },
  {
    id: "audiobookshelf",
    name: "Audiobookshelf",
    description:
      "Read the audiobooks and podcasts you're part way through on your Audiobookshelf server.",
    categories: [{ id: "podcasts", name: "Podcasts" }],
    setupUrl: "/chat/plugins?connector=audiobookshelf",
    operations: [
      { id: "list_in_progress", access: "read", inputSchema: { type: "object", properties: {} } },
      {
        id: "list_listening_sessions",
        access: "read",
        inputSchema: { type: "object", properties: { limit: limitProperty } },
      },
    ],
    auth: {
      authType: "api_key",
      credentialLabel: "Server address and API token, as https://server|token",
      scopes: ["library:read"],
    },
  },
];

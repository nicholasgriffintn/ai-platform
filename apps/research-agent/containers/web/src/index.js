import { serve } from "@hono/node-server";
import { Hono } from "hono";

import { config } from "./config.js";
import {
  handleScrape,
  handleSearch,
  handleUrl,
  handleValidate,
} from "./handlers.js";

const app = new Hono();

app.get("/", (c) => {
  return c.json({
    name: "Web Agent",
    version: "1.0.0",
    description:
      "Web scraping and data fetching capabilities for the AI Agent Orchestrator",
    capabilities: [
      "Web page scraping",
      "Content extraction",
      "Search simulation",
      "URL validation",
      "Metadata extraction",
    ],
  });
});

app.get("/health", (c) => {
  return c.json({
    status: "healthy",
    timestamp: Date.now(),
    memory_usage: process.memoryUsage(),
  });
});

app.post("/scrape", handleScrape);

app.post("/url", handleUrl);
app.post("/search", handleSearch);
app.get("/validate/:url", handleValidate);

// Error handling
app.onError((err, c) => {
  console.error("Web agent error:", err);

  return c.json(
    {
      success: false,
      error: "Internal server error",
      message: err.message,
      timestamp: new Date().toISOString(),
    },
    500,
  );
});

console.log(`Starting Web Agent on port ${config.port}`);

serve(
  {
    fetch: app.fetch,
    port: Number.parseInt(config.port),
  },
  (info) => {
    console.log(`Web Agent listening on http://localhost:${info.port}`);
  },
);

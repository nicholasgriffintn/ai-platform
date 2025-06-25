export const config = {
  // Server settings
  port: process.env.PORT || 8080,

  // Scraping settings
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  requestTimeout: 10000,
  maxContentLength: 5000,
  maxExcerptLength: 300,
  maxUrls: 10,
  maxSearchResults: 5,

  // Content selectors for better scraping
  contentSelectors: [
    "article",
    '[role="main"]',
    ".content",
    ".post-content",
    ".entry-content",
    "#content",
    "main",
    ".main-content",
  ],

  // Elements to remove during scraping
  elementsToRemove: "script, style, nav, footer, header",

  // Mock search configuration
  mockSearchEnabled: true, // Set to false when using real search API
};

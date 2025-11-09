# E2E Test Structure

This directory contains end-to-end tests for the AI platform using Playwright with the Page Object Model pattern.

## Page Object Model

Each page object extends `BasePage` and encapsulates:

- Page-specific locators
- Actions that can be performed on the page
- Page-specific assertions

Example usage:

```typescript
const homePage = new HomePage(page);
await homePage.navigate();
await homePage.sendMessage("Hello");
```

## Test Helpers

The `TestHelpers` class provides utilities for:

- Creating page objects
- Mocking API responses
- Managing localStorage/sessionStorage
- Network idle waiting

## Prerequisites

1. **API Key**: Set `PLAYWRIGHT_API_KEY` environment variable with a valid Polychat API key

   ```bash
   export PLAYWRIGHT_API_KEY=your_api_key_here
   ```

   If this is not set, the API tests will be skipped.

2. **Dependencies**: Install Playwright browsers
   ```bash
   pnpm exec playwright install
   ```

## Running Tests

### Run all E2E tests

```bash
pnpm run test:e2e
```

### Run specific test files

```bash
# Chat functionality only
pnpm exec playwright test features/chat

# App features only
pnpm exec playwright test features/app

# Resilience tests only
pnpm exec playwright test features/resilience

# Smoke tests only
pnpm exec playwright test smoke/
```

### Run in different modes

```bash
# Headed mode (see browser)
pnpm exec playwright test --headed

# Debug mode
pnpm exec playwright test --debug

# UI mode (interactive)
pnpm exec playwright test --ui

# Specific test by name
pnpm exec playwright test -g "maintains context"
```

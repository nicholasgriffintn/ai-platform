# E2E Test Structure

This directory contains end-to-end tests for the AI platform using Playwright with the Page Object Model pattern.

## Structure

```
tests/e2e/
├── features/             # Feature-specific test files
│   ├── feature.spec.ts   # A feature test
├── page-objects/         # Page Object Model classes
│   ├── BasePage.ts       # Base page class with common functionality
│   ├── OtherPage.ts      # Any other page specific methods
├── utils/                # Test utilities and helpers
│   └── test-helpers.ts   # Helper functions for tests
├── fixtures/             # Test data and fixtures
│   └── test-data.ts      # Centralized test data
├── smoke/                # Smoke tests
│   └── basic.spec.ts     # Basic smoke tests
```

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

## Running Tests

```bash
# Run all E2E tests
pnpm run test:e2e

# Run specific test file
pnpm run test:e2e -- features/chat.spec.ts

# Run tests in headed mode
pnpm run test:e2e -- --headed

# Run tests with debug
pnpm run test:e2e -- --debug
```

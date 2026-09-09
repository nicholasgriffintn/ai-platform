import type { Page, Response } from "@playwright/test";

const MODULE_RESOURCE_TYPES = new Set(["document", "script", "stylesheet"]);
const MODULE_ERROR_PATTERN =
  /failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed|failed to resolve module specifier|chunkloaderror/i;
const FONT_HOST_PATTERN = /(?:^|\.)(?:fonts\.googleapis\.com|fonts\.gstatic\.com)$/;
const FONT_POLICY_PATTERN = /font-src|content security policy/i;

export interface PageDiagnostics {
  readonly consoleErrors: string[];
  readonly moduleErrors: string[];
  readonly failedModuleRequests: string[];
  readonly fontCdnRequests: string[];
  readonly fontPolicyViolations: string[];
  readonly fontResponses: Response[];
}

export function collectPageDiagnostics(page: Page): PageDiagnostics {
  const consoleErrors: string[] = [];
  const moduleErrors: string[] = [];
  const failedModuleRequests: string[] = [];
  const fontCdnRequests: string[] = [];
  const fontPolicyViolations: string[] = [];
  const fontResponses: Response[] = [];

  page.on("console", (message) => {
    if (message.type() !== "error") {
      return;
    }

    const text = message.text();

    consoleErrors.push(text);
    if (MODULE_ERROR_PATTERN.test(text)) {
      moduleErrors.push(text);
    }

    if (FONT_POLICY_PATTERN.test(text)) {
      fontPolicyViolations.push(text);
    }
  });

  page.on("pageerror", (error) => {
    consoleErrors.push(error.message);
    if (MODULE_ERROR_PATTERN.test(error.message)) {
      moduleErrors.push(error.message);
    }
  });

  page.on("requestfailed", (request) => {
    if (MODULE_RESOURCE_TYPES.has(request.resourceType())) {
      failedModuleRequests.push(`${request.url()} (${request.failure()?.errorText ?? "failed"})`);
    }
  });

  page.on("request", (request) => {
    if (FONT_HOST_PATTERN.test(new URL(request.url()).hostname)) {
      fontCdnRequests.push(request.url());
    }
  });

  page.on("response", (response) => {
    if (new URL(response.url()).pathname.endsWith(".woff2")) {
      fontResponses.push(response);
    }
  });

  return {
    consoleErrors,
    moduleErrors,
    failedModuleRequests,
    fontCdnRequests,
    fontPolicyViolations,
    fontResponses,
  };
}

export function describeFontResponses(responses: readonly Response[]) {
  return responses.map((response) => ({
    origin: new URL(response.url()).origin,
    status: response.status(),
  }));
}

export function computedDurationsInSeconds(page: Page, selector: string) {
  return page.evaluate((target) => {
    const element = document.querySelector(target);

    if (!element) {
      throw new Error(`No element matched ${target}`);
    }

    const styles = globalThis.getComputedStyle(element);
    const toSeconds = (value: string) =>
      value
        .split(",")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
        .map((entry) =>
          entry.endsWith("ms") ? Number.parseFloat(entry) / 1000 : Number.parseFloat(entry),
        );

    return {
      transition: toSeconds(styles.transitionDuration),
      animation: toSeconds(styles.animationDuration),
    };
  }, selector);
}

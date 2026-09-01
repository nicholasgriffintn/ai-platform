import { AssistantError, ErrorType } from "~/utils/errors";
import { normaliseHttpOrigin } from "~/utils/urls";

export function requireStripePriceId(plan: Record<string, unknown>, planId: string): string {
  const price = plan.price;

  if (typeof price === "number" && price <= 0) {
    throw new AssistantError(
      `Plan ${planId} is free and cannot be checked out`,
      ErrorType.PARAMS_ERROR,
      400,
      { planId },
    );
  }

  const priceId = plan.stripe_price_id;

  if (typeof priceId !== "string" || priceId.trim().length === 0) {
    throw new AssistantError(
      `Stripe price ID not configured for plan ${planId}`,
      ErrorType.CONFIGURATION_ERROR,
      500,
      { planId },
    );
  }

  return priceId.trim();
}

export function requireCheckoutReturnUrls(
  appBaseUrl: string | undefined,
  successUrl: string,
  cancelUrl: string,
): void {
  const appOrigin = normaliseHttpOrigin(appBaseUrl);

  if (!appOrigin) {
    throw new AssistantError(
      "App base URL not configured for Stripe Checkout",
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  if (
    normaliseHttpOrigin(successUrl) !== appOrigin ||
    normaliseHttpOrigin(cancelUrl) !== appOrigin
  ) {
    throw new AssistantError(
      "Checkout return URLs must use the configured app origin",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }
}

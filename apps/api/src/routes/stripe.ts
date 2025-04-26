import { type Context, Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { z } from "zod";
import { FREE_TRIAL_DAYS } from "~/constants/app";
import { Database } from "~/lib/database";
import { requireAuth } from "~/middleware/auth";
import { AssistantError, ErrorType } from "~/utils/errors";

const app = new Hono();

const checkoutSchema = z.object({
  plan_id: z.string(),
  success_url: z.string().url(),
  cancel_url: z.string().url(),
});

async function verifyStripeSignature(
  payload: string,
  header: string,
  secret: string,
): Promise<boolean> {
  const parts = header.split(",").map((p) => p.trim());
  const timestampPart = parts.find((p) => p.startsWith("t="));
  const signaturePart = parts.find((p) => p.startsWith("v1="));

  if (!timestampPart || !signaturePart) {
    return false;
  }

  const timestamp = timestampPart.split("=")[1];
  const expectedSig = signaturePart.split("=")[1];
  const signedPayload = `${timestamp}.${payload}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(signedPayload),
  );
  const signatureHex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (signatureHex.length !== expectedSig.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < signatureHex.length; i++) {
    result |= signatureHex.charCodeAt(i) ^ expectedSig.charCodeAt(i);
  }

  return result === 0;
}

app.post(
  "/checkout",
  describeRoute({
    tags: ["stripe"],
    summary: "Create a Stripe Checkout Session for a subscription",
    requestBody: {
      description: "Plan selection and redirect URLs",
      required: true,
      content: {
        "application/json": { schema: resolver(checkoutSchema) },
      },
    },
    responses: {
      200: {
        description: "Stripe Checkout Session created",
        content: { "application/json": {} },
      },
      400: {
        description: "Invalid request data",
        content: { "application/json": {} },
      },
      500: { description: "Server error", content: { "application/json": {} } },
    },
  }),
  zValidator("json", checkoutSchema),
  requireAuth,
  async (c: Context) => {
    const { plan_id, success_url, cancel_url } = c.req.valid(
      "json" as never,
    ) as z.infer<typeof checkoutSchema>;
    const user = c.get("user");

    if (!user?.id) {
      throw new AssistantError(
        "Authentication required",
        ErrorType.AUTHENTICATION_ERROR,
      );
    }

    const db = Database.getInstance(c.env);
    const plan = await db.getPlanById(plan_id);

    if (!plan) {
      throw new AssistantError("Plan not found", ErrorType.NOT_FOUND);
    }

    const priceId = (plan as any).stripe_price_id as string;

    const secret = c.env.STRIPE_SECRET_KEY;
    if (!secret) {
      throw new AssistantError(
        "Stripe secret key not configured",
        ErrorType.CONFIGURATION_ERROR,
      );
    }

    const params = new URLSearchParams();
    params.append("mode", "subscription");
    params.append(
      "subscription_data[trial_period_days]",
      FREE_TRIAL_DAYS.toString(),
    );
    params.append("payment_method_types[]", "card");
    params.append("line_items[0][price]", priceId);
    params.append("line_items[0][quantity]", "1");
    params.append("success_url", success_url);
    params.append("cancel_url", cancel_url);

    let customerId = user.stripe_customer_id;

    if (!customerId) {
      const custParams = new URLSearchParams();
      custParams.append("email", (user as any).email);
      custParams.append("metadata[user_id]", user.id.toString());

      const custRes = await fetch("https://api.stripe.com/v1/customers", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secret}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: custParams,
      });

      const custData = (await custRes.json()) as any;

      if (!custRes.ok) {
        throw new AssistantError(
          custData.error?.message || "Failed to create Stripe customer",
          ErrorType.INTERNAL_ERROR,
        );
      }

      customerId = custData.id;

      await db.updateUser(user.id, { stripe_customer_id: customerId });
    }

    params.append("customer", customerId);

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });

    const data = (await res.json()) as any;
    if (!res.ok) {
      throw new AssistantError(
        data.error?.message || "Stripe API error",
        ErrorType.INTERNAL_ERROR,
      );
    }

    return c.json(data);
  },
);

app.get(
  "/subscription",
  describeRoute({
    tags: ["stripe"],
    summary: "Get the authenticated user's subscription status",
    responses: {
      200: {
        description: "Subscription details",
        content: { "application/json": {} },
      },
      404: {
        description: "No subscription found",
        content: { "application/json": {} },
      },
      500: { description: "Server error", content: { "application/json": {} } },
    },
  }),
  requireAuth,
  async (c: Context) => {
    const user = c.get("user");
    const subscriptionId = user?.stripe_subscription_id;

    if (!subscriptionId) {
      return c.json({
        status: "inactive",
        plan: null,
      });
    }
    const secret = c.env.STRIPE_SECRET_KEY;
    if (!secret) {
      throw new AssistantError(
        "Stripe secret key not configured",
        ErrorType.CONFIGURATION_ERROR,
      );
    }
    const res = await fetch(
      `https://api.stripe.com/v1/subscriptions/${subscriptionId}`,
      { headers: { Authorization: `Bearer ${secret}` } },
    );
    const data = (await res.json()) as any;
    if (!res.ok) {
      throw new AssistantError(
        data.error?.message || "Stripe API error",
        ErrorType.INTERNAL_ERROR,
      );
    }
    return c.json(data);
  },
);

app.post(
  "/subscription/cancel",
  describeRoute({
    tags: ["stripe"],
    summary: "Cancel the authenticated user's subscription at period end",
    responses: {
      200: {
        description: "Subscription canceled",
        content: { "application/json": {} },
      },
      404: {
        description: "No subscription found",
        content: { "application/json": {} },
      },
      500: { description: "Server error", content: { "application/json": {} } },
    },
  }),
  requireAuth,
  async (c: Context) => {
    const user = c.get("user");
    const subscriptionId = (user as any)?.stripe_subscription_id;

    if (!subscriptionId) {
      throw new AssistantError("No active subscription", ErrorType.NOT_FOUND);
    }

    const secret = c.env.STRIPE_SECRET_KEY;

    if (!secret) {
      throw new AssistantError(
        "Stripe secret key not configured",
        ErrorType.CONFIGURATION_ERROR,
      );
    }

    const params = new URLSearchParams();
    params.append("cancel_at_period_end", "true");

    const res = await fetch(
      `https://api.stripe.com/v1/subscriptions/${subscriptionId}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secret}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params,
      },
    );

    const data = (await res.json()) as any;

    if (!res.ok) {
      throw new AssistantError(
        data.error?.message || "Stripe API error",
        ErrorType.INTERNAL_ERROR,
      );
    }
    return c.json(data);
  },
);

app.post("/webhook", async (c: Context) => {
  const sig = c.req.header("stripe-signature");

  if (!sig) {
    throw new AssistantError(
      "Missing Stripe signature",
      ErrorType.AUTHENTICATION_ERROR,
    );
  }

  const webhookSecret = c.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new AssistantError(
      "Stripe webhook secret not configured",
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  const payload = await c.req.text();

  if (!(await verifyStripeSignature(payload, sig, webhookSecret))) {
    throw new AssistantError(
      "Invalid webhook signature",
      ErrorType.AUTHENTICATION_ERROR,
    );
  }

  let event;
  try {
    event = JSON.parse(payload);
  } catch {
    throw new AssistantError("Invalid webhook payload", ErrorType.PARAMS_ERROR);
  }

  const db = Database.getInstance(c.env);
  const { type, data } = event;
  const obj = data.object;

  if (type === "checkout.session.completed") {
    const customer = obj.customer as string;
    const subscription = obj.subscription as string;
    const user = await db.getUserByStripeCustomerId(customer);
    if (user?.id) {
      await db.updateUser(user.id, {
        stripe_customer_id: customer,
        stripe_subscription_id: subscription,
        plan_id: "pro",
      });
    }
  }

  if (
    type === "customer.subscription.updated" ||
    type === "customer.subscription.deleted"
  ) {
    const customer = obj.customer as string;
    const subscriptionId = obj.id as string;
    const user = await db.getUserByStripeCustomerId(customer);
    if (user?.id) {
      if (type === "customer.subscription.deleted") {
        await db.updateUser(user.id, {
          stripe_subscription_id: null,
          plan_id: "free",
        });
      } else {
        await db.updateUser(user.id, {
          stripe_subscription_id: subscriptionId,
        });
      }
    }
  }

  return c.json({ received: true });
});

export default app;

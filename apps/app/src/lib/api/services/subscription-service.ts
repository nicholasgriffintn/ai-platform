import { fetchApi } from "../fetch-wrapper";

export class SubscriptionService {
  async getSubscription(): Promise<any | null> {
    const response = await fetchApi("/stripe/subscription");
    if (response.status === 404) return null;
    if (!response.ok) {
      const err = (await response.json()) as { error?: string };
      throw new Error(err.error || "Failed to fetch subscription");
    }
    return response.json();
  }

  async createCheckoutSession(
    planId: string,
    successUrl: string,
    cancelUrl: string,
  ): Promise<{ url: string }> {
    const response = await fetchApi("/stripe/checkout", {
      method: "POST",
      body: { plan_id: planId, success_url: successUrl, cancel_url: cancelUrl },
    });
    const data = (await response.json()) as { url: string; error?: string };
    if (!response.ok) {
      throw new Error(data.error || "Checkout session creation failed");
    }
    return data;
  }

  async cancelSubscription(): Promise<any> {
    const response = await fetchApi("/stripe/subscription/cancel", {
      method: "POST",
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      throw new Error(data.error || "Failed to cancel subscription");
    }
    return data;
  }

  async reactivateSubscription(): Promise<any> {
    const response = await fetchApi("/stripe/subscription/reactivate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = (await response.json()) as { message?: string };
      throw new Error(error.message || "Failed to reactivate subscription");
    }

    return response.json();
  }
}

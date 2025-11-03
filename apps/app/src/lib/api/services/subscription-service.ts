import { fetchApi, returnFetchedData } from "../fetch-wrapper";

export class SubscriptionService {
	async getSubscription(): Promise<any | null> {
		const response = await fetchApi("/stripe/subscription");
		if (response.status === 404) return null;
		if (!response.ok) {
			const err = await returnFetchedData<{ error?: string }>(response);
			throw new Error(err.error || "Failed to fetch subscription");
		}
		return await returnFetchedData<any>(response);
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
		const data = await returnFetchedData<{ url: string; error?: string }>(
			response,
		);
		if (!response.ok) {
			throw new Error(data.error || "Checkout session creation failed");
		}
		return data;
	}

	async cancelSubscription(): Promise<any> {
		const response = await fetchApi("/stripe/subscription/cancel", {
			method: "POST",
		});
		const data = await returnFetchedData<{ error?: string }>(response);
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
			const error = await returnFetchedData<{ message?: string }>(response);
			throw new Error(error.message || "Failed to reactivate subscription");
		}

		return await returnFetchedData<any>(response);
	}
}

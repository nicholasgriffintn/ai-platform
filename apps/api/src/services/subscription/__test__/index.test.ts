import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IEnv, IUser } from "~/types";
import {
	cancelSubscription,
	createCheckoutSession,
	getSubscriptionStatus,
	handleStripeWebhook,
	reactivateSubscription,
} from "../index";

const mockStripe = {
	customers: {
		create: vi.fn(),
	},
	subscriptions: {
		retrieve: vi.fn(),
		update: vi.fn(),
	},
	checkout: {
		sessions: {
			create: vi.fn(),
		},
	},
	webhooks: {
		constructEventAsync: vi.fn(),
	},
};

const mockDatabase = {
	getPlanById: vi.fn(),
	updateUser: vi.fn(),
	getUserByStripeCustomerId: vi.fn(),
};

vi.mock("stripe", () => ({
	default: vi.fn().mockImplementation(() => mockStripe),
}));


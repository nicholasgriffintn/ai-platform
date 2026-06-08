import { beforeEach, describe, expect, it, vi } from "vitest";

import { executeRampOperation } from "../ramp";

describe("executeRampOperation", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response(JSON.stringify({ data: [] }), { status: 200 })),
		);
	});

	it("lists transactions with bounded pagination and finance filters", async () => {
		await expect(
			executeRampOperation("token", "list_transactions", {
				pageSize: 500,
				start: "cursor_123",
				state: "CLEARED",
				from_date: "2026-06-01T00:00:00Z",
				to_date: "2026-06-08T00:00:00Z",
				min_amount: 100,
				max_amount: 500,
				has_been_approved: true,
			}),
		).resolves.toEqual({ data: [] });

		const [url, init] = vi.mocked(fetch).mock.calls[0];
		const parsedUrl = new URL(String(url));
		expect(`${parsedUrl.origin}${parsedUrl.pathname}`).toBe(
			"https://api.ramp.com/developer/v1/transactions",
		);
		expect(Object.fromEntries(parsedUrl.searchParams)).toEqual({
			from_date: "2026-06-01T00:00:00Z",
			has_been_approved: "true",
			max_amount: "500",
			min_amount: "100",
			page_size: "100",
			start: "cursor_123",
			state: "CLEARED",
			to_date: "2026-06-08T00:00:00Z",
		});
		expect(init).toMatchObject({
			headers: expect.objectContaining({
				Authorization: "Bearer token",
			}),
		});
	});

	it("gets a transaction with merchant data", async () => {
		await executeRampOperation("token", "get_transaction", {
			transactionId: "transaction_123",
			include_merchant_data: true,
		});

		expect(String(vi.mocked(fetch).mock.calls[0][0])).toBe(
			"https://api.ramp.com/developer/v1/transactions/transaction_123?include_merchant_data=true",
		);
	});

	it("lists reimbursements with filters", async () => {
		await executeRampOperation("token", "list_reimbursements", {
			pageSize: 25,
			state: "PENDING",
			direction: "BUSINESS_TO_USER",
			user_id: "user_123",
			sync_ready: false,
		});

		const parsedUrl = new URL(String(vi.mocked(fetch).mock.calls[0][0]));
		expect(`${parsedUrl.origin}${parsedUrl.pathname}`).toBe(
			"https://api.ramp.com/developer/v1/reimbursements",
		);
		expect(Object.fromEntries(parsedUrl.searchParams)).toEqual({
			direction: "BUSINESS_TO_USER",
			page_size: "25",
			state: "PENDING",
			sync_ready: "false",
			user_id: "user_123",
		});
	});

	it("lists bills with comma-separated status summaries", async () => {
		await executeRampOperation("token", "list_bills", {
			pageSize: 10,
			approval_status: "PENDING",
			payment_status: "OPEN",
			status_summaries: ["PAYMENT_READY", "APPROVAL_PENDING"],
		});

		expect(String(vi.mocked(fetch).mock.calls[0][0])).toBe(
			"https://api.ramp.com/developer/v1/bills?page_size=10&approval_status=PENDING&payment_status=OPEN&status_summaries=PAYMENT_READY%2CAPPROVAL_PENDING",
		);
	});

	it("gets reimbursements and bills by id", async () => {
		await executeRampOperation("token", "get_reimbursement", {
			reimbursementId: "reimbursement_123",
		});
		await executeRampOperation("token", "get_bill", { billId: "bill_123" });

		expect(String(vi.mocked(fetch).mock.calls[0][0])).toBe(
			"https://api.ramp.com/developer/v1/reimbursements/reimbursement_123",
		);
		expect(String(vi.mocked(fetch).mock.calls[1][0])).toBe(
			"https://api.ramp.com/developer/v1/bills/bill_123",
		);
	});

	it("requires ids for detail operations", async () => {
		await expect(executeRampOperation("token", "get_transaction", {})).rejects.toThrow(
			"transactionId is required",
		);
		await expect(executeRampOperation("token", "get_reimbursement", {})).rejects.toThrow(
			"reimbursementId is required",
		);
		await expect(executeRampOperation("token", "get_bill", {})).rejects.toThrow(
			"billId is required",
		);
	});
});

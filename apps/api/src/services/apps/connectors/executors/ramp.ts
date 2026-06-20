import { AssistantError, ErrorType } from "~/utils/errors";
import { fetchConnectorJson } from "./http";
import { getNumberParam, getStringParam, limitPositiveInteger } from "./params";

const RAMP_API_BASE_URL = "https://api.ramp.com/developer/v1";

function requireId(params: Record<string, unknown>, key: string): string {
	const value = getStringParam(params, key);
	if (!value) {
		throw new AssistantError(`${key} is required`, ErrorType.PARAMS_ERROR, 400);
	}
	return value;
}

function addRampPagination(url: URL, params: Record<string, unknown>) {
	const start = getStringParam(params, "start");
	if (start) {
		url.searchParams.set("start", start);
	}
	url.searchParams.set(
		"page_size",
		limitPositiveInteger(getNumberParam(params, "pageSize"), 20, 100).toString(),
	);
}

function addOptionalStringFilters(
	url: URL,
	params: Record<string, unknown>,
	keys: readonly string[],
) {
	for (const key of keys) {
		const value = getStringParam(params, key);
		if (value) {
			url.searchParams.set(key, value);
		}
	}
}

function addOptionalBooleanFilters(
	url: URL,
	params: Record<string, unknown>,
	keys: readonly string[],
) {
	for (const key of keys) {
		if (typeof params[key] === "boolean") {
			url.searchParams.set(key, params[key] ? "true" : "false");
		}
	}
}

function addOptionalNumberFilters(
	url: URL,
	params: Record<string, unknown>,
	keys: readonly string[],
) {
	for (const key of keys) {
		const value = getNumberParam(params, key);
		if (value !== undefined) {
			url.searchParams.set(key, value.toString());
		}
	}
}

function addRampTransactionFilters(url: URL, params: Record<string, unknown>) {
	addOptionalStringFilters(url, params, [
		"approval_status",
		"awaiting_approval_by_user_id",
		"card_id",
		"department_id",
		"from_date",
		"limit_id",
		"location_id",
		"merchant_id",
		"spend_program_id",
		"state",
		"sync_status",
		"to_date",
		"user_id",
	]);
	addOptionalBooleanFilters(url, params, [
		"all_requirements_met_and_approved",
		"has_been_approved",
		"has_no_sync_commits",
		"has_statement",
	]);
	addOptionalNumberFilters(url, params, ["max_amount", "min_amount", "sk_category_id"]);
}

function addRampReimbursementFilters(url: URL, params: Record<string, unknown>) {
	addOptionalStringFilters(url, params, [
		"awaiting_approval_by_user_id",
		"direction",
		"entity_id",
		"from_date",
		"from_submitted_at",
		"from_transaction_date",
		"state",
		"sync_status",
		"to_date",
		"to_submitted_at",
		"to_transaction_date",
		"trip_id",
		"updated_after",
		"user_id",
	]);
	addOptionalBooleanFilters(url, params, [
		"has_been_approved",
		"has_no_sync_commits",
		"sync_ready",
	]);
}

function addRampBillFilters(url: URL, params: Record<string, unknown>) {
	addOptionalStringFilters(url, params, [
		"approval_status",
		"customer_friendly_payment_id",
		"draft_bill_id",
		"entity_id",
		"from_created_at",
		"from_due_date",
		"from_issued_date",
		"invoice_number",
		"payment_id",
		"payment_method",
		"payment_status",
		"remote_id",
		"sync_status",
		"to_created_at",
		"to_due_date",
		"to_issued_date",
		"vendor_id",
	]);
	addOptionalBooleanFilters(url, params, [
		"is_accounting_sync_enabled",
		"is_archived",
		"payment_details_missing",
		"sync_ready",
	]);
	const statusSummaries = params.status_summaries;
	if (Array.isArray(statusSummaries)) {
		const values = statusSummaries.filter(
			(value): value is string => typeof value === "string" && Boolean(value.trim()),
		);
		if (values.length) {
			url.searchParams.set("status_summaries", values.join(","));
		}
	}
}

export async function executeRampOperation(
	token: string,
	operation: string,
	params: Record<string, unknown>,
) {
	if (operation === "list_transactions") {
		const url = new URL(`${RAMP_API_BASE_URL}/transactions`);
		addRampPagination(url, params);
		addRampTransactionFilters(url, params);
		return fetchConnectorJson({ url: url.toString(), token });
	}

	if (operation === "get_transaction") {
		const transactionId = requireId(params, "transactionId");
		const url = new URL(`${RAMP_API_BASE_URL}/transactions/${encodeURIComponent(transactionId)}`);
		if (typeof params.include_merchant_data === "boolean") {
			url.searchParams.set(
				"include_merchant_data",
				params.include_merchant_data ? "true" : "false",
			);
		}
		return fetchConnectorJson({ url: url.toString(), token });
	}

	if (operation === "list_reimbursements") {
		const url = new URL(`${RAMP_API_BASE_URL}/reimbursements`);
		addRampPagination(url, params);
		addRampReimbursementFilters(url, params);
		return fetchConnectorJson({ url: url.toString(), token });
	}

	if (operation === "get_reimbursement") {
		const reimbursementId = requireId(params, "reimbursementId");
		return fetchConnectorJson({
			url: `${RAMP_API_BASE_URL}/reimbursements/${encodeURIComponent(reimbursementId)}`,
			token,
		});
	}

	if (operation === "list_bills") {
		const url = new URL(`${RAMP_API_BASE_URL}/bills`);
		addRampPagination(url, params);
		addRampBillFilters(url, params);
		return fetchConnectorJson({ url: url.toString(), token });
	}

	if (operation === "get_bill") {
		const billId = requireId(params, "billId");
		return fetchConnectorJson({
			url: `${RAMP_API_BASE_URL}/bills/${encodeURIComponent(billId)}`,
			token,
		});
	}

	throw new AssistantError("Unsupported Ramp operation", ErrorType.PARAMS_ERROR, 400);
}

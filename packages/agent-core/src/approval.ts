const DEFAULT_POLL_INTERVAL_MS = 2000;

export interface ApprovalWindow {
	timeoutSeconds: number;
	escalateAfterSeconds: number;
}

export interface ApprovalRecord {
	id: string;
	status:
		| "pending"
		| "escalated"
		| "approved"
		| "rejected"
		| "timed_out"
		| string;
	expiresAt?: string;
	escalatedAt?: string;
	timedOutAt?: string;
	resolutionReason?: string;
}

export interface ApprovalControlState {
	state?: "running" | "cancelled" | string;
	cancellationReason?: string;
}

export interface ApprovalClient<
	TApproval extends ApprovalRecord = ApprovalRecord,
> {
	requestApproval(
		subject: string,
		reason: string,
		window: ApprovalWindow,
		abortSignal?: AbortSignal,
	): Promise<TApproval | null>;
	fetchApproval(
		approvalId: string,
		abortSignal?: AbortSignal,
	): Promise<TApproval | null>;
	fetchControlState?(
		abortSignal?: AbortSignal,
	): Promise<ApprovalControlState | null>;
}

export interface ResolveApprovalParams<
	TRisk extends string,
	TTrust extends string,
	TApproval extends ApprovalRecord = ApprovalRecord,
> {
	subject: string;
	riskLevel: TRisk;
	trustLevel: TTrust;
	reason: string;
	agentStep: number;
	emit: (event: Record<string, unknown>) => Promise<void>;
	guardExecution: (abortMessage: string) => Promise<void>;
	shouldRequireApproval: (params: {
		riskLevel: TRisk;
		trustLevel: TTrust;
	}) => boolean;
	approvalWindowForRiskLevel: (riskLevel: TRisk) => ApprovalWindow;
	approvalClient?: ApprovalClient<TApproval>;
	abortSignal?: AbortSignal;
	pollIntervalMs?: number;
	eventPrefix?: string;
}

export interface ResolveApprovalResult<
	TApproval extends ApprovalRecord = ApprovalRecord,
> {
	approved: boolean;
	rejected: boolean;
	approval?: TApproval;
	rejectedMessage?: string;
}

function wait(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function resolveApproval<
	TRisk extends string,
	TTrust extends string,
	TApproval extends ApprovalRecord = ApprovalRecord,
>(
	params: ResolveApprovalParams<TRisk, TTrust, TApproval>,
): Promise<ResolveApprovalResult<TApproval>> {
	const {
		subject,
		riskLevel,
		trustLevel,
		reason,
		agentStep,
		emit,
		guardExecution,
		approvalClient,
		abortSignal,
		shouldRequireApproval,
		approvalWindowForRiskLevel,
		pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
		eventPrefix = "approval",
	} = params;

	if (!shouldRequireApproval({ riskLevel, trustLevel })) {
		return {
			approved: true,
			rejected: false,
		};
	}

	if (!approvalClient) {
		throw new Error(
			`Approval required but no approval client is configured for: ${subject}`,
		);
	}

	const approval = await approvalClient.requestApproval(
		subject,
		reason,
		approvalWindowForRiskLevel(riskLevel),
		abortSignal,
	);

	if (!approval) {
		throw new Error(`Failed to create approval request for: ${subject}`);
	}

	await emit({
		type: `${eventPrefix}_requested`,
		subject,
		riskLevel,
		trustLevel,
		agentStep,
		approvalId: approval.id,
		approvalStatus: approval.status,
		approvalExpiresAt: approval.expiresAt,
		approvalEscalatedAt: approval.escalatedAt,
	});

	let previousStatus = approval.status;

	while (true) {
		await guardExecution("Execution cancelled while waiting for approval");

		const control = approvalClient.fetchControlState
			? await approvalClient.fetchControlState(abortSignal)
			: null;

		if (control?.state === "cancelled") {
			throw new Error(
				control.cancellationReason ||
					"Execution cancelled during approval wait",
			);
		}

		const latestApproval = await approvalClient.fetchApproval(
			approval.id,
			abortSignal,
		);

		if (!latestApproval) {
			await wait(pollIntervalMs);
			continue;
		}

		if (
			latestApproval.status === "escalated" &&
			previousStatus !== "escalated"
		) {
			await emit({
				type: `${eventPrefix}_escalated`,
				subject,
				riskLevel,
				trustLevel,
				agentStep,
				approvalId: latestApproval.id,
				approvalStatus: latestApproval.status,
				approvalEscalatedAt: latestApproval.escalatedAt,
				approvalExpiresAt: latestApproval.expiresAt,
			});
		}

		if (latestApproval.status === "approved") {
			await emit({
				type: `${eventPrefix}_resolved`,
				subject,
				riskLevel,
				trustLevel,
				agentStep,
				approvalId: latestApproval.id,
				approvalStatus: latestApproval.status,
				approvalEscalatedAt: latestApproval.escalatedAt,
				approvalExpiresAt: latestApproval.expiresAt,
			});
			return {
				approved: true,
				rejected: false,
				approval: latestApproval,
			};
		}

		if (latestApproval.status === "rejected") {
			await emit({
				type: `${eventPrefix}_resolved`,
				subject,
				riskLevel,
				trustLevel,
				agentStep,
				approvalId: latestApproval.id,
				approvalStatus: latestApproval.status,
				approvalEscalatedAt: latestApproval.escalatedAt,
				approvalExpiresAt: latestApproval.expiresAt,
			});
			return {
				approved: false,
				rejected: true,
				approval: latestApproval,
				rejectedMessage: latestApproval.resolutionReason || "Approval rejected",
			};
		}

		if (latestApproval.status === "timed_out") {
			await emit({
				type: `${eventPrefix}_timed_out`,
				subject,
				riskLevel,
				trustLevel,
				agentStep,
				approvalId: latestApproval.id,
				approvalStatus: latestApproval.status,
				approvalEscalatedAt: latestApproval.escalatedAt,
				approvalExpiresAt: latestApproval.expiresAt,
				approvalTimedOutAt: latestApproval.timedOutAt,
			});
			return {
				approved: false,
				rejected: true,
				approval: latestApproval,
				rejectedMessage:
					latestApproval.resolutionReason ||
					"Approval timed out before a decision was made",
			};
		}

		previousStatus = latestApproval.status;
		await wait(pollIntervalMs);
	}
}

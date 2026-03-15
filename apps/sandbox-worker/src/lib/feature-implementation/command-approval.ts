import type { SandboxTrustLevel } from "@assistant/schemas";

import type { TaskEvent } from "../../types";
import type { RunControlClient } from "../run-control-client";

const APPROVAL_POLL_INTERVAL_MS = 2000;
const NETWORK_APPROVAL_TIMEOUT_SECONDS = 120;
const NETWORK_APPROVAL_ESCALATE_AFTER_SECONDS = 30;
const RISKY_APPROVAL_TIMEOUT_SECONDS = 180;
const RISKY_APPROVAL_ESCALATE_AFTER_SECONDS = 45;

function shouldRequireApproval(params: {
	trustLevel: SandboxTrustLevel;
	riskLevel: "low" | "network" | "risky";
}): boolean {
	if (params.trustLevel === "trusted") {
		return false;
	}
	if (params.trustLevel === "strict") {
		return params.riskLevel === "network" || params.riskLevel === "risky";
	}
	return params.riskLevel === "network";
}

function wait(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function approvalWindowForRiskLevel(riskLevel: "low" | "network" | "risky"): {
	timeoutSeconds: number;
	escalateAfterSeconds: number;
} {
	if (riskLevel === "risky") {
		return {
			timeoutSeconds: RISKY_APPROVAL_TIMEOUT_SECONDS,
			escalateAfterSeconds: RISKY_APPROVAL_ESCALATE_AFTER_SECONDS,
		};
	}
	return {
		timeoutSeconds: NETWORK_APPROVAL_TIMEOUT_SECONDS,
		escalateAfterSeconds: NETWORK_APPROVAL_ESCALATE_AFTER_SECONDS,
	};
}

export interface ResolveCommandApprovalParams {
	command: string;
	riskLevel: "low" | "network" | "risky";
	trustLevel: SandboxTrustLevel;
	agentStep: number;
	emit: (event: TaskEvent) => Promise<void>;
	approvalClient?: RunControlClient;
	abortSignal?: AbortSignal;
	guardExecution: (abortMessage: string) => Promise<void>;
}

export interface ResolveCommandApprovalResult {
	allowNetwork: boolean;
	allowRisky: boolean;
	rejected: boolean;
	rejectedMessage?: string;
}

export async function resolveCommandApproval(
	params: ResolveCommandApprovalParams,
): Promise<ResolveCommandApprovalResult> {
	const {
		command,
		riskLevel,
		trustLevel,
		agentStep,
		emit,
		approvalClient,
		abortSignal,
		guardExecution,
	} = params;

	if (!shouldRequireApproval({ trustLevel, riskLevel })) {
		return {
			allowNetwork: false,
			allowRisky: false,
			rejected: false,
		};
	}

	if (!approvalClient) {
		throw new Error(
			`Command requires approval but approval client is unavailable: ${command}`,
		);
	}

	const approval = await approvalClient.requestCommandApproval(
		command,
		`${riskLevel} command in ${trustLevel} trust mode`,
		approvalWindowForRiskLevel(riskLevel),
		abortSignal,
	);
	if (!approval) {
		throw new Error(
			`Failed to create approval request for command: ${command}`,
		);
	}
	await emit({
		type: "command_approval_requested",
		command,
		agentStep,
		message: `Approval requested for ${riskLevel} command`,
		approvalId: approval.id,
		approvalStatus: approval.status,
		approvalExpiresAt: approval.expiresAt,
		approvalEscalatedAt: approval.escalatedAt,
	});

	let previousStatus = approval.status;
	while (true) {
		await guardExecution(
			"Sandbox run cancelled while waiting for command approval",
		);
		const control = await approvalClient.fetchControlState(abortSignal);
		if (control?.state === "cancelled") {
			throw new Error(
				control.cancellationReason ||
					"Sandbox run cancelled during approval wait",
			);
		}

		const latestApproval = await approvalClient.fetchApproval(
			approval.id,
			abortSignal,
		);
		if (
			latestApproval?.status === "escalated" &&
			previousStatus !== "escalated"
		) {
			await emit({
				type: "command_approval_escalated",
				command,
				agentStep,
				message: "Command approval escalated",
				approvalId: latestApproval.id,
				approvalStatus: latestApproval.status,
				approvalEscalatedAt: latestApproval.escalatedAt,
				approvalExpiresAt: latestApproval.expiresAt,
			});
		}
		if (latestApproval?.status === "approved") {
			await emit({
				type: "command_approval_resolved",
				command,
				agentStep,
				message: "Command approval granted",
				approvalId: latestApproval.id,
				approvalStatus: latestApproval.status,
				approvalEscalatedAt: latestApproval.escalatedAt,
				approvalExpiresAt: latestApproval.expiresAt,
			});
			return {
				allowNetwork: riskLevel === "network",
				allowRisky: riskLevel === "risky",
				rejected: false,
			};
		}

		if (latestApproval?.status === "rejected") {
			await emit({
				type: "command_approval_resolved",
				command,
				agentStep,
				message: "Command approval rejected",
				approvalId: latestApproval.id,
				approvalStatus: latestApproval.status,
				approvalEscalatedAt: latestApproval.escalatedAt,
				approvalExpiresAt: latestApproval.expiresAt,
			});
			return {
				allowNetwork: false,
				allowRisky: false,
				rejected: true,
				rejectedMessage:
					latestApproval.resolutionReason || "Command approval rejected",
			};
		}

		if (latestApproval?.status === "timed_out") {
			await emit({
				type: "command_approval_timed_out",
				command,
				agentStep,
				message:
					latestApproval.resolutionReason || "Command approval timed out",
				approvalId: latestApproval.id,
				approvalStatus: latestApproval.status,
				approvalEscalatedAt: latestApproval.escalatedAt,
				approvalTimedOutAt: latestApproval.timedOutAt,
				approvalExpiresAt: latestApproval.expiresAt,
			});
			return {
				allowNetwork: false,
				allowRisky: false,
				rejected: true,
				rejectedMessage:
					latestApproval.resolutionReason ||
					"Command approval timed out before a decision was made.",
			};
		}

		if (latestApproval) {
			previousStatus = latestApproval.status;
		}

		await wait(APPROVAL_POLL_INTERVAL_MS);
	}
}

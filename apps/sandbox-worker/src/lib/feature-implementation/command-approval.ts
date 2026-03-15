import type { SandboxTrustLevel } from "@assistant/schemas";

import type { TaskEvent } from "../../types";
import type { RunControlClient } from "../run-control-client";

const APPROVAL_POLL_INTERVAL_MS = 2000;

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
		return { allowNetwork: false, allowRisky: false, rejected: false };
	}

	if (!approvalClient) {
		throw new Error(
			`Command requires approval but approval client is unavailable: ${command}`,
		);
	}

	await emit({
		type: "command_approval_requested",
		command,
		agentStep,
		message: `Approval requested for ${riskLevel} command`,
	});

	const approval = await approvalClient.requestCommandApproval(
		command,
		`${riskLevel} command in ${trustLevel} trust mode`,
		abortSignal,
	);
	if (!approval) {
		throw new Error(
			`Failed to create approval request for command: ${command}`,
		);
	}

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
		if (latestApproval?.status === "approved") {
			await emit({
				type: "command_approval_resolved",
				command,
				agentStep,
				message: "Command approval granted",
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
			});
			return { allowNetwork: false, allowRisky: false, rejected: true };
		}

		await wait(APPROVAL_POLL_INTERVAL_MS);
	}
}

export interface ReplicateInputField {
	name: string;
	type: string | string[];
	description?: string;
	required: boolean;
	default?: any;
	enum?: any[];
}

import type { AppKind, AppTheme } from "./apps";

export interface ReplicateModel {
	id: string;
	name: string;
	description: string;
	type: string[];
	costPerRun: number;
	inputSchema: {
		fields: ReplicateInputField[];
	};
	reference?: string;
	category?: string;
	icon?: string;
	theme?: AppTheme;
	tags?: string[];
	featured?: boolean;
	href?: string;
	kind?: AppKind;
}

export interface ReplicatePrediction {
	id: string;
	prediction_id?: string;
	status: "processing" | "succeeded" | "completed" | "failed";
	output?: any;
	error?: string;
	modelId: string;
	modelName?: string;
	input: Record<string, any>;
	created_at: string;
	createdAt?: string;
	predictionData?: {
		output?: any;
		response?: any;
	};
}

export interface ExecuteReplicateRequest {
	modelId: string;
	input: Record<string, any>;
}

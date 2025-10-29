export interface ReplicateInputField {
  name: string;
  type: string | string[];
  description?: string;
  required: boolean;
  default?: any;
  enum?: any[];
}

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
}

export interface ReplicatePrediction {
  id: string;
  prediction_id?: string;
  status: "processing" | "succeeded" | "failed";
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

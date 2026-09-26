import type {
  ConnectionCheck,
  DatasetShape,
  DeploymentSpec,
  DeploymentStatus,
  GraderConfig,
  HostManifest,
  ModelArchitecture,
  ModelProviderId,
  ProviderManifest,
  TrainerManifest,
  TrainingMetricPoint,
  TrainingRunStatus,
  TrainingSpec,
} from "@ngriffin_uk/polychat-schemas";

import type { Fetcher } from "./http.js";

export interface ProviderCredentials {
  secrets: Record<string, string>;
  config: Record<string, string>;
}

export interface ProviderAdapterContext {
  credentials: ProviderCredentials;
  fetcher: Fetcher;
  hub: HubAccess | null;
}

export interface HubAccess {
  token: string;
  namespace: string;
}

export interface DatasetFile {
  url: string;
  size: number;
  sha256: string | null;
  filename: string;
  open: () => Promise<ReadableStream<Uint8Array>>;
}

export interface DatasetHandle {
  versionId: string;
  name: string;
  shape: DatasetShape;
  rows: number;
  tokens: number;
  file: DatasetFile;
}

export type WeightsLocation =
  | { kind: "hub"; repo: string; revision: string }
  | { kind: "url"; url: string }
  | { kind: "provider"; provider: ModelProviderId; ref: string };

export interface ModelHandle {
  versionId: string;
  name: string;
  kind: "model" | "adapter";
  weights: WeightsLocation;
  architecture: ModelArchitecture | null;
  parameterCount: number | null;
  remoteCode: boolean;
  base: ModelHandle | null;
}

export interface GraderDefinition {
  id: string;
  metric: string;
  config: GraderConfig;
}

export interface TeacherInvocation {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface TrainingSubmission {
  runId: string;
  spec: TrainingSpec;
  base: ModelHandle;
  merge: ModelHandle[];
  train: DatasetHandle | null;
  validation: DatasetHandle | null;
  grader: GraderDefinition | null;
  outputRepository: string;
  reportUrl: string;
}

export interface TrainingCheckpointState {
  step: number;
  providerRef: string;
  metrics: Record<string, number>;
}

export type TrainingOutput =
  | { kind: "hub"; repo: string; revision: string }
  | { kind: "provider"; provider: ModelProviderId; ref: string };

export interface TrainingJobState {
  status: TrainingRunStatus;
  providerJobId: string;
  metrics: TrainingMetricPoint[];
  checkpoints: TrainingCheckpointState[];
  output: TrainingOutput | null;
  costUsd: number | null;
  failureReason: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

export interface Trainer {
  readonly manifest: TrainerManifest;
  submit(submission: TrainingSubmission): Promise<TrainingJobState>;
  status(providerJobId: string): Promise<TrainingJobState>;
  cancel(providerJobId: string): Promise<void>;
}

export interface HostDeploymentInput {
  deploymentId: string;
  name: string;
  spec: DeploymentSpec;
  model: ModelHandle;
  adapters: ModelHandle[];
}

export interface HostDeploymentState {
  status: DeploymentStatus;
  providerRef: string;
  region: string | null;
  readyReplicas: number | null;
  hourlyUsd: number | null;
  failureReason: string | null;
}

export interface ChatInvocationMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatInvocation {
  messages: ChatInvocationMessage[];
  maxTokens: number;
  temperature: number;
  topP?: number;
  stop?: string[];
}

export interface ChatInvocationResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

export interface HostedDeployment {
  providerRef: string;
  spec: DeploymentSpec;
  model: ModelHandle;
  adapters: ModelHandle[];
  desired: "running" | "paused";
}

export interface Host {
  readonly manifest: HostManifest;
  create(input: HostDeploymentInput): Promise<HostDeploymentState>;
  status(deployment: HostedDeployment): Promise<HostDeploymentState>;
  scale(
    deployment: HostedDeployment,
    scaling: { minReplicas: number; maxReplicas: number },
  ): Promise<HostDeploymentState>;
  pause(deployment: HostedDeployment): Promise<HostDeploymentState>;
  resume(deployment: HostedDeployment): Promise<HostDeploymentState>;
  delete(deployment: HostedDeployment): Promise<void>;
  invoke(deployment: HostedDeployment, request: ChatInvocation): Promise<ChatInvocationResult>;
  list(): Promise<string[]>;
}

export interface ConnectionChecker {
  check(): Promise<ConnectionCheck>;
}

export interface ModelProviderAdapters {
  manifest: ProviderManifest;
  checker: (context: ProviderAdapterContext) => ConnectionChecker;
  trainers: Record<string, (context: ProviderAdapterContext) => Trainer>;
  hosts: Record<string, (context: ProviderAdapterContext) => Host>;
}

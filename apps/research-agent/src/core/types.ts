export interface ResearchQuery {
  id: string;
  query: string;
  context?: string;
  parameters: ResearchParameters;
  metadata: QueryMetadata;
}

export interface ResearchParameters {
  depth: "shallow" | "medium" | "deep";
  sources: SourceConfig;
  analysis: AnalysisConfig;
  output: OutputConfig;
}

export interface SourceConfig {
  maxSources: number;
  sourceTypes: SourceType[];
  languages?: string[];
  dateRange?: DateRange;
  domains?: DomainFilter;
}

export interface AnalysisConfig {
  enableSentiment: boolean;
  enableEntities: boolean;
  enableSummarization: boolean;
  enableFactChecking: boolean;
  enableTrends: boolean;
  customAnalyzers?: string[];
}

export interface OutputConfig {
  format: "structured" | "narrative" | "hybrid";
  includeSourceMaterial: boolean;
  confidenceThreshold: number;
  maxLength?: number;
}

export interface QueryMetadata {
  requestId: string;
  userId?: string;
  priority: "low" | "normal" | "high" | "urgent";
  timeout: number;
  createdAt: string;
  tags?: string[];
}

export type SourceType =
  | "web"
  | "academic"
  | "news"
  | "social"
  | "patent"
  | "legal";

export interface DateRange {
  from?: string;
  to?: string;
}

export interface DomainFilter {
  include?: string[];
  exclude?: string[];
}

export interface ExecutionPlan {
  id: string;
  query: ResearchQuery;
  stages: ExecutionStage[];
  dependencies: StageDepMap;
  estimatedDuration: number;
  createdAt: string;
}

export interface ExecutionStage {
  id: string;
  name: string;
  type: StageType;
  plugin: string;
  config: Record<string, any>;
  dependencies: string[];
  timeout: number;
  retryPolicy: RetryPolicy;
}

export type StageType =
  | "data_collection"
  | "data_processing"
  | "analysis"
  | "synthesis"
  | "validation"
  | "formatting";

export interface StageDepMap {
  [stageId: string]: string[];
}

export interface RetryPolicy {
  maxAttempts: number;
  backoffMs: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

export interface ExecutionContext {
  planId: string;
  stageId: string;
  attempt: number;
  startTime: number;
  data: ContextData;
  metrics: ExecutionMetrics;
}

export interface ContextData {
  [key: string]: any;
  artifacts?: Artifact[];
  intermediateResults?: Record<string, any>;
}

export interface Artifact {
  id: string;
  type: ArtifactType;
  name: string;
  content: any;
  metadata: ArtifactMetadata;
  createdAt: string;
}

export type ArtifactType =
  | "raw_data"
  | "processed_data"
  | "analysis_result"
  | "report"
  | "visualization"
  | "cache";

export interface ArtifactMetadata {
  source: string;
  format: string;
  size: number;
  checksum?: string;
  ttl?: number;
  tags?: string[];
}

export interface ExecutionMetrics {
  duration: number;
  memoryUsage: number;
  apiCalls: number;
  errorCount: number;
  retryCount: number;
  customMetrics: Record<string, number>;
}

export interface StageResult {
  success: boolean;
  output?: any;
  error?: ResearchError;
  metrics: ExecutionMetrics;
  artifacts: Artifact[];
  nextStages?: string[];
}

export interface ResearchError {
  code: string;
  message: string;
  details?: Record<string, any>;
  retryable: boolean;
  cause?: Error;
  context?: ExecutionContext;
}

export interface ResearchReport {
  id: string;
  query: ResearchQuery;
  executionPlan: ExecutionPlan;
  findings: Finding[];
  summary: ReportSummary;
  sources: Source[];
  analysis: AnalysisResults;
  metadata: ReportMetadata;
}

export interface Finding {
  id: string;
  title: string;
  content: string;
  confidence: number;
  sources: string[];
  type: FindingType;
  significance: "low" | "medium" | "high" | "critical";
  tags?: string[];
}

export type FindingType =
  | "fact"
  | "trend"
  | "opinion"
  | "contradiction"
  | "gap"
  | "insight";

export interface ReportSummary {
  executiveSummary: string;
  keyFindings: string[];
  recommendations?: string[];
  limitations: string[];
  confidenceScore: number;
}

export interface Source {
  id: string;
  url: string;
  title: string;
  author?: string;
  publishedAt?: string;
  credibilityScore: number;
  relevanceScore: number;
  extractedContent: string;
  metadata: SourceMetadata;
}

export interface SourceMetadata {
  type: SourceType;
  domain: string;
  language: string;
  wordCount: number;
  accessedAt: string;
  lastModified?: string;
}

export interface AnalysisResults {
  sentiment?: SentimentAnalysis;
  entities?: EntityAnalysis;
  trends?: TrendAnalysis;
  factCheck?: FactCheckResults;
  custom?: Record<string, any>;
}

export interface SentimentAnalysis {
  overall: SentimentScore;
  aspects: AspectSentiment[];
  trends: SentimentTrend[];
}

export interface SentimentScore {
  polarity: number;
  subjectivity: number;
  confidence: number;
  label: "positive" | "negative" | "neutral";
}

export interface AspectSentiment {
  aspect: string;
  sentiment: SentimentScore;
  mentions: number;
}

export interface SentimentTrend {
  timeframe: string;
  sentiment: SentimentScore;
}

export interface EntityAnalysis {
  entities: Entity[];
  relationships: EntityRelationship[];
  clusters: EntityCluster[];
}

export interface Entity {
  text: string;
  type: EntityType;
  confidence: number;
  mentions: number;
  context: string[];
}

export type EntityType =
  | "person"
  | "organization"
  | "location"
  | "event"
  | "product"
  | "concept"
  | "date"
  | "money";

export interface EntityRelationship {
  source: string;
  target: string;
  relationship: string;
  confidence: number;
}

export interface EntityCluster {
  name: string;
  entities: string[];
  relevance: number;
}

export interface TrendAnalysis {
  trends: Trend[];
  patterns: Pattern[];
  anomalies: Anomaly[];
}

export interface Trend {
  topic: string;
  direction: "rising" | "falling" | "stable";
  strength: number;
  timeframe: string;
  confidence: number;
}

export interface Pattern {
  type: string;
  description: string;
  strength: number;
  occurrences: number;
}

export interface Anomaly {
  type: string;
  description: string;
  severity: "low" | "medium" | "high";
  timestamp: string;
  context: Record<string, any>;
}

export interface FactCheckResults {
  claims: ClaimVerification[];
  overallCredibility: number;
  sources: CredibilityAssessment[];
}

export interface ClaimVerification {
  claim: string;
  verdict: "true" | "false" | "partially_true" | "unverified";
  confidence: number;
  sources: string[];
  explanation: string;
}

export interface CredibilityAssessment {
  sourceId: string;
  score: number;
  factors: CredibilityFactor[];
}

export interface CredibilityFactor {
  name: string;
  score: number;
  weight: number;
  description: string;
}

export interface ReportMetadata {
  generatedAt: string;
  processingTime: number;
  totalSources: number;
  stagesExecuted: string[];
  errors: ResearchError[];
  version: string;
}

export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author: string;
  type: PluginType;
  capabilities: PluginCapability[];
  dependencies: PluginDependency[];
  configuration: PluginConfigSchema;
  endpoints: PluginEndpoint[];
}

export type PluginType =
  | "data_collector"
  | "analyzer"
  | "synthesizer"
  | "validator"
  | "formatter"
  | "utility";

export interface PluginCapability {
  name: string;
  description: string;
  inputTypes: string[];
  outputTypes: string[];
  parameters?: ParameterSchema[];
}

export interface PluginDependency {
  name: string;
  version: string;
  optional: boolean;
}

export interface PluginConfigSchema {
  [key: string]: {
    type: "string" | "number" | "boolean" | "object" | "array";
    required: boolean;
    default?: any;
    description: string;
    validation?: Record<string, any>;
  };
}

export interface PluginEndpoint {
  path: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  description: string;
  parameters?: ParameterSchema[];
  response: ResponseSchema;
}

export interface ParameterSchema {
  name: string;
  type: string;
  required: boolean;
  description: string;
  validation?: Record<string, any>;
}

export interface ResponseSchema {
  type: string;
  properties?: Record<string, any>;
}

export interface SystemStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  version: string;
  uptime: number;
  components: ComponentStatus[];
  metrics: SystemMetrics;
}

export interface ComponentStatus {
  name: string;
  status: "online" | "offline" | "error";
  lastCheck: string;
  responseTime?: number;
  error?: string;
}

export interface SystemMetrics {
  activeQueries: number;
  completedQueries: number;
  averageProcessingTime: number;
  errorRate: number;
  throughput: number;
  resourceUsage: ResourceUsage;
}

export interface ResourceUsage {
  cpu: number;
  memory: number;
  storage: number;
  network: number;
}

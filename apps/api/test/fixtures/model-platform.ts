import { deploymentSpecSchema } from "@ngriffin_uk/polychat-schemas";

import type { RegistryScope } from "~/modules/model-registry/application/scope";
import type { ModelRouteRecord } from "~/modules/model-registry/infrastructure/ModelRouteRepository";
import type { ModelAliasRecord } from "~/modules/model-serving/infrastructure/ModelAliasRepository";
import type { ModelDeploymentRecord } from "~/modules/model-serving/infrastructure/ModelDeploymentRepository";

export const testModelRoute: ModelRouteRecord = {
  id: "route-id",
  workspace_id: "workspace",
  version_id: "version",
  provider: "polychat-deployment",
  provider_model_id: "deployment:deployment-id",
  region: "eu",
  weights_verified: true,
  status: "active",
  deployment_id: "deployment-id",
  jurisdiction: "eu",
  retention: "provider",
  created_by: 1,
  created_at: "2026-09-26T00:00:00Z",
};
export const testModelDeployment: ModelDeploymentRecord = {
  id: "deployment-id",
  workspace_id: "workspace",
  project_id: null,
  name: "Test",
  version_id: "version",
  spec: deploymentSpecSchema.parse({
    versionId: "version",
    shape: "dedicated",
    target: { provider: "huggingface", target: "huggingface-endpoints" },
  }),
  spec_hash: "hash",
  status: "running",
  desired_state: "running",
  provider: "huggingface",
  host: "huggingface-endpoints",
  provider_ref: "reference",
  provisioning_started_at: null,
  region: "eu",
  jurisdiction: "eu",
  weights_verified: true,
  route_id: "route-id",
  hourly_usd: null,
  failure_reason: null,
  created_by: 1,
  created_at: "2026-09-26T00:00:00Z",
  updated_at: "2026-09-26T00:00:00Z",
  last_checked_at: null,
  billed_until: null,
};

export const testRegistryScope: RegistryScope = {
  workspaceId: "workspace",
  projectId: null,
  assets: new Map(),
  versions: [],
  evidence: [],
  decisions: [],
  routes: [testModelRoute],
  datasets: new Map(),
  stack: {
    project: null,
    scoped: [],
    workspace: {
      id: "policy",
      workspaceId: "workspace",
      projectId: null,
      rules: [],
      revision: 1,
      hash: "hash",
      enforcement: "enforced",
      updatedAt: "2026-09-26T00:00:00Z",
      updatedBy: 1,
      isDefault: false,
    },
  },
};

export const testModelAlias: ModelAliasRecord = {
  id: "alias-id",
  workspace_id: "workspace",
  project_id: null,
  scope_key: "workspace",
  name: "Production",
  description: null,
  route_id: null,
  canary_route_id: null,
  canary_percent: 0,
  gate: null,
  requires_approval: false,
  updated_by: 1,
  created_at: "2026-09-26T00:00:00Z",
  updated_at: "2026-09-26T00:00:00Z",
};

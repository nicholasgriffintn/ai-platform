import {
  CLOUDFLARE_RATE_ENTRIES,
  CLOUDFLARE_VENDOR,
  priceUsage,
  type UsageUnit,
} from "@ngriffin_uk/polychat-schemas";

import { RepositoryManager } from "~/repositories";
import type { IEnv } from "~/types";
import { getLogger } from "~/utils/logger";
import { isRecord } from "~/utils/objects";
import { findNumericFieldDeep } from "~/utils/recordFields";

const logger = getLogger({ prefix: "services/infra/reconciliation" });

const CLOUDFLARE_GRAPHQL_ENDPOINT = "https://api.cloudflare.com/client/v4/graphql";

interface ProductProbe {
  resource: string;
  dataset: string;
  selection: string;
  extract: (groups: unknown[]) => Array<{ unit: UsageUnit; quantity: number }>;
}

function sumField(groups: unknown[], field: string): number {
  let total = 0;

  for (const group of groups) {
    if (!isRecord(group)) {
      continue;
    }

    const value = findNumericFieldDeep(group, [field], 3);

    if (typeof value === "number" && Number.isFinite(value)) {
      total += value;
    }
  }

  return total;
}

const R2_CLASS_B_ACTION_PREFIXES = ["getobject", "headobject", "headbucket", "usagesummary"];

function classifyR2Operations(groups: unknown[]): Array<{ unit: UsageUnit; quantity: number }> {
  let classA = 0;
  let classB = 0;

  for (const group of groups) {
    if (!isRecord(group)) {
      continue;
    }

    const requests = findNumericFieldDeep(group, ["requests"], 3) ?? 0;
    const action =
      isRecord(group.dimensions) && typeof group.dimensions.actionType === "string"
        ? group.dimensions.actionType.toLowerCase()
        : "";

    if (R2_CLASS_B_ACTION_PREFIXES.some((prefix) => action.startsWith(prefix))) {
      classB += requests;
    } else {
      classA += requests;
    }
  }

  return [
    { unit: "r2_class_a_ops", quantity: classA },
    { unit: "r2_class_b_ops", quantity: classB },
  ];
}

const PRODUCT_PROBES: ProductProbe[] = [
  {
    resource: "workers",
    dataset: "workersInvocationsAdaptive",
    selection: "sum { requests }",
    extract: (groups) => [{ unit: "worker_requests", quantity: sumField(groups, "requests") }],
  },
  {
    resource: "durable_objects",
    dataset: "durableObjectsInvocationsAdaptiveGroups",
    selection: "sum { requests }",
    extract: (groups) => [{ unit: "do_requests", quantity: sumField(groups, "requests") }],
  },
  {
    resource: "d1",
    dataset: "d1AnalyticsAdaptiveGroups",
    selection: "sum { rowsRead rowsWritten }",
    extract: (groups) => [
      { unit: "d1_rows_read", quantity: sumField(groups, "rowsRead") },
      { unit: "d1_rows_written", quantity: sumField(groups, "rowsWritten") },
    ],
  },
  {
    resource: "r2",
    dataset: "r2OperationsAdaptiveGroups",
    selection: "sum { requests } dimensions { actionType }",
    extract: classifyR2Operations,
  },
  {
    resource: "queues",
    dataset: "queueMessageOperationsAdaptiveGroups",
    selection: "sum { messages }",
    extract: (groups) => [{ unit: "queue_operations", quantity: sumField(groups, "messages") }],
  },
  {
    resource: "workers_ai",
    dataset: "aiInferenceAdaptiveGroups",
    selection: "sum { totalNeurons }",
    extract: (groups) => [{ unit: "ai_neurons", quantity: sumField(groups, "totalNeurons") }],
  },
];

async function queryProduct(params: {
  env: IEnv;
  token: string;
  probe: ProductProbe;
  day: string;
}): Promise<Array<{ unit: UsageUnit; quantity: number }> | null> {
  const { env, token, probe, day } = params;
  const query = `query ($accountTag: String!, $date: String!) {
	viewer {
		accounts(filter: { accountTag: $accountTag }) {
			${probe.dataset}(limit: 10000, filter: { date: $date }) {
				${probe.selection}
			}
		}
	}
}`;

  try {
    const response = await fetch(CLOUDFLARE_GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables: { accountTag: env.ACCOUNT_ID, date: day } }),
    });

    if (!response.ok) {
      logger.warn("Cloudflare analytics query failed", {
        dataset: probe.dataset,
        status: response.status,
      });

      return null;
    }

    const body = (await response.json()) as {
      data?: { viewer?: { accounts?: Array<Record<string, unknown>> } };
      errors?: Array<{ message?: string }>;
    };

    if (Array.isArray(body.errors) && body.errors.length > 0) {
      logger.warn("Cloudflare analytics query returned errors", {
        dataset: probe.dataset,
        error: body.errors[0]?.message,
      });

      return null;
    }

    const account = body.data?.viewer?.accounts?.[0];
    const groups = account?.[probe.dataset];

    if (!Array.isArray(groups)) {
      return null;
    }

    return probe.extract(groups);
  } catch (error) {
    logger.warn("Cloudflare analytics query threw", { dataset: probe.dataset, error });

    return null;
  }
}

export function previousUtcDay(now: Date = new Date()): string {
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  return yesterday.toISOString().slice(0, 10);
}

export interface InfraReconciliationResult {
  status: "skipped" | "success";
  day: string;
  rowsWritten: number;
}

export async function runInfraReconciliation(params: {
  env: IEnv;
  day?: string;
  repositories?: RepositoryManager;
}): Promise<InfraReconciliationResult> {
  const { env } = params;
  const day = params.day ?? previousUtcDay();
  const token = env.CLOUDFLARE_ANALYTICS_API_TOKEN?.trim();

  if (!token) {
    logger.info("Skipping infra reconciliation: CLOUDFLARE_ANALYTICS_API_TOKEN is not configured", {
      day,
    });

    return { status: "skipped", day, rowsWritten: 0 };
  }

  const repositories = params.repositories ?? new RepositoryManager(env);
  const attributed = await repositories.usageEvents.summariseInfrastructureDay(day);
  const attributedByKey = new Map(
    attributed.map((row) => [`${row.resource}:${row.unit}`, row.cost_micros]),
  );

  const occurredAt = `${day}T00:00:00.000Z`;
  let rowsWritten = 0;

  for (const probe of PRODUCT_PROBES) {
    const quantities = await queryProduct({ env, token, probe, day });

    if (!quantities) {
      continue;
    }

    for (const entry of quantities) {
      const priced = priceUsage(
        CLOUDFLARE_RATE_ENTRIES,
        { vendor: CLOUDFLARE_VENDOR, resource: probe.resource, unit: entry.unit, occurredAt },
        entry.quantity,
      );

      await repositories.infraCostDaily.upsertDay({
        day,
        resource: probe.resource,
        unit: entry.unit,
        quantity: entry.quantity,
        costMicros: priced.costMicros,
        attributedCostMicros: attributedByKey.get(`${probe.resource}:${entry.unit}`) ?? 0,
      });

      attributedByKey.delete(`${probe.resource}:${entry.unit}`);
      rowsWritten += 1;
    }
  }

  for (const row of attributed) {
    const key = `${row.resource}:${row.unit}`;

    if (!attributedByKey.has(key)) {
      continue;
    }

    await repositories.infraCostDaily.upsertDay({
      day,
      resource: row.resource,
      unit: row.unit,
      quantity: 0,
      costMicros: 0,
      attributedCostMicros: row.cost_micros,
      source: "attributed_only",
    });

    rowsWritten += 1;
  }

  logger.info("Infra reconciliation completed", { day, rowsWritten });

  return { status: "success", day, rowsWritten };
}

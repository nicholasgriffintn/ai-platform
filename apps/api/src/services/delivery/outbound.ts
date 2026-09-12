import type { ServiceContext } from "~/lib/context/serviceContext";
import { canonicalJson } from "~/utils/canonical-json";
import { sha256Hex } from "~/utils/crypto";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";

const DELIVERY_LEASE_MS = 5 * 60 * 1000;

export async function deliverOutboundOperation(params: {
  context: ServiceContext;
  deliveryId: string;
  userId: number;
  kind: string;
  scopeId: string;
  operationId: string;
  payload: Record<string, unknown>;
  send(): Promise<void>;
}): Promise<void> {
  const payloadDigest = await sha256Hex(canonicalJson(params.payload));

  await params.context.repositories.outboundDeliveries.prepare({
    id: params.deliveryId,
    userId: params.userId,
    kind: params.kind,
    scopeId: params.scopeId,
    operationId: params.operationId,
    payloadDigest,
    payload: params.payload,
  });

  const now = new Date();
  const executionToken = generateId();
  const decision = await params.context.repositories.outboundDeliveries.begin({
    id: params.deliveryId,
    userId: params.userId,
    executionToken,
    now: now.toISOString(),
    leaseExpiresAt: new Date(now.getTime() + DELIVERY_LEASE_MS).toISOString(),
  });

  if (decision === "sent") {
    return;
  }

  if (decision === "in_progress") {
    throw new AssistantError(
      "Outbound delivery is already in progress",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  if (decision === "indeterminate") {
    throw new AssistantError(
      "Outbound delivery has an unknown outcome and will not be repeated automatically",
      ErrorType.PROVIDER_ERROR,
      502,
    );
  }

  try {
    await params.send();
    const sentAt = new Date().toISOString();
    const completed = await params.context.repositories.outboundDeliveries.complete({
      id: params.deliveryId,
      userId: params.userId,
      executionToken,
      sentAt,
    });

    if (!completed) {
      throw new AssistantError(
        "The external operation succeeded but its delivery record could not be completed",
        ErrorType.DATABASE_ERROR,
      );
    }
  } catch (error) {
    await params.context.repositories.outboundDeliveries.markIndeterminate({
      id: params.deliveryId,
      userId: params.userId,
      executionToken,
      recordedAt: new Date().toISOString(),
    });

    throw error;
  }
}

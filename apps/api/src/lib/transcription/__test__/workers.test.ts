import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { WorkersTranscriptionProvider } from "../workers";
import { Database } from "~/lib/database";

const mockAI = vi.hoisted(() => ({
	run: vi.fn(),
}));

const mockGatewayId = vi.hoisted(() => "test-gateway-id");

vi.mock("~/constants/app", () => ({
	gatewayId: mockGatewayId,
}));


import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	getAllAttachments,
	pruneMessagesToFitContext,
	sanitiseInput,
} from "~/lib/chat/utils";
import { getModelConfig } from "~/lib/models";
import { getSystemPrompt } from "~/lib/prompts";
import type { CoreChatOptions } from "~/types";
import { generateId } from "~/utils/id";
import type { ValidationContext } from "../../validation/ValidationPipeline";
import { RequestPreparer } from "../RequestPreparer";

const mockDatabase = {
	getUserSettings: vi.fn(),
	getActiveMemorySynthesis: vi.fn(),
};

const mockConversationManager = {
	addBatch: vi.fn(),
	get: vi.fn(),
	replaceMessages: vi.fn(),
};

const mockEmbedding = {
	augmentPrompt: vi.fn(),
};

const mockMemoryManager = {
	retrieveMemories: vi.fn(),
};


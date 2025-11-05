import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Database } from "~/lib/database";
import { getAuxiliaryModel } from "~/lib/models";
import { trackRagMetrics } from "~/lib/monitoring";
import { AIProviderFactory } from "~/lib/providers/factory";
import { AssistantError } from "~/utils/errors";
import type { IUserSettings } from "../../../types";
import { EmbeddingProviderFactory } from "../factory";
import { Embedding } from "../index";

vi.mock("../factory");

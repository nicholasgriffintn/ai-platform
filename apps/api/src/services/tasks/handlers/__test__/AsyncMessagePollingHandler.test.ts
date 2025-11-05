import { describe, expect, it, beforeEach, vi } from "vitest";
import type { IEnv, User } from "~/types";
import { AsyncMessagePollingHandler } from "../AsyncMessagePollingHandler";
import { ConversationManager } from "~/lib/conversationManager";
import { Database } from "~/lib/database";
import { handleAsyncInvocation } from "~/services/completions/async/handler";
import { isAsyncInvocationPending } from "~/lib/async/asyncInvocation";
import { TaskService } from "../../TaskService";
import { UserRepository } from "~/repositories/UserRepository";
import type { TaskMessage } from "../../TaskService";


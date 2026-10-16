import {
  DELEGATION_EXPIRY_TASK_TYPE,
  DELEGATION_MESSAGE_TASK_TYPE,
  DELEGATION_RUN_TASK_TYPE,
  DELEGATION_WAKE_TASK_TYPE,
} from "@ngriffin_uk/polychat-schemas";

import type { AppWorkflows } from "~/modules/queue/application/workflows";

import { DelegationExpiryHandler } from "./DelegationExpiryHandler";
import { DelegationMessageHandler } from "./DelegationMessageHandler";
import { DelegationRunHandler } from "./DelegationRunHandler";
import { DelegationWakeHandler } from "./DelegationWakeHandler";

export function registerDelegationsQueue(workflows: AppWorkflows): void {
  workflows.register(DELEGATION_RUN_TASK_TYPE, new DelegationRunHandler());
  workflows.register(DELEGATION_MESSAGE_TASK_TYPE, new DelegationMessageHandler());
  workflows.register(DELEGATION_EXPIRY_TASK_TYPE, new DelegationExpiryHandler());
  workflows.register(DELEGATION_WAKE_TASK_TYPE, new DelegationWakeHandler());
}

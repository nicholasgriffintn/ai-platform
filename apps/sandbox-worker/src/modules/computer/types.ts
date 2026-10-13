import type { TeammateComputerInput } from "@ngriffin_uk/polychat-schemas";

import type { Computer } from "./computer";

export interface ComputerRequest {
  resourceId: string;
  handle?: string;
  fence?: number;
  checkpointReference?: string | null;
  input?: TeammateComputerInput;
  recordingId?: string;
}

export type ComputerSandbox = DurableObjectStub<Computer>;

import { fetchApiOrThrow } from "./fetch-wrapper.js";
import { MachineRunClient } from "./machine-runs.js";

export const machineRunClient = new MachineRunClient(fetchApiOrThrow);

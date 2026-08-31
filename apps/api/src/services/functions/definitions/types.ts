import type { ApiToolDefinition } from "~/types/functions";

export type FunctionToolDescriptor = Omit<ApiToolDefinition, "execute" | "normaliseInput">;

import { createAiFunctions } from "@ngriffin_uk/polychat-ai-functions";

import { providerRuntime } from "~/infrastructure/providers/runtime";

export const ai = createAiFunctions(providerRuntime);

import { createAiFunctions } from "@ngriffin_uk/polychat-ai-functions";

import { providerRuntime } from "~/lib/providers/runtime";

export const ai = createAiFunctions(providerRuntime);

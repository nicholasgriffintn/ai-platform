import {
  createFlagshipProvider,
  createLayeredProvider,
  createRulesProvider,
  type FlagProvider,
} from "@ngriffin_uk/polychat-library-flags";

import type { IEnv } from "~/types";

import { experimentDefinitions } from "./definitions";

export function createFlagProvider(env: IEnv): FlagProvider {
  const rules = createRulesProvider(experimentDefinitions(env).rule);

  return env.FLAGS ? createLayeredProvider([createFlagshipProvider(env.FLAGS), rules]) : rules;
}

import type {
  EnvironmentAction,
  EnvironmentActionName,
  EnvironmentKind,
  EnvironmentOf,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { IUser } from "~/types";

export interface EnvironmentScope {
  context: ServiceContext;
  user: IUser;
}

export interface EnvironmentKindDefinition<TKind extends EnvironmentKind = EnvironmentKind> {
  kind: TKind;
  actions: ReadonlySet<EnvironmentActionName>;
  read(scope: EnvironmentScope, id: string): Promise<EnvironmentOf<TKind>>;
  remove?(scope: EnvironmentScope, id: string): Promise<unknown>;
  act?(scope: EnvironmentScope, id: string, action: EnvironmentAction): Promise<unknown>;
}

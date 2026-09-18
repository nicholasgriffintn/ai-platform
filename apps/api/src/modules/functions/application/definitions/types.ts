import type { ToolDescriptor } from "@ngriffin_uk/polychat-library-tools";

import type { IFunctionResponse } from "~/types";
import type { ApiToolExecutionContext } from "~/types/functions";

export type FunctionToolDescriptor = ToolDescriptor<
  any,
  IFunctionResponse,
  ApiToolExecutionContext
>;

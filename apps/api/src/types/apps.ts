import type { ConversationManager } from "~/lib/conversationManager";
import type { ChatMode, ChatRole, MessageContent, Platform } from "./chat";
import type { IRequest } from "./chat";

export type IFunctionResponse = {
  status?: string;
  name?: string;
  content?: string | MessageContent[];
  data?: any;
  role?: ChatRole;
  citations?: string[] | null;
  log_id?: string;
  mode?: ChatMode;
  id?: string;
  timestamp?: number;
  model?: string;
  platform?: Platform;
};

export interface IFunction {
  name: string;
  app_url?: string;
  description: string;
  strict?: boolean;
  type: "normal" | "premium";
  costPerCall: number;
  parameters: {
    type: "object";
    properties: {
      [key: string]: {
        type: string;
        description: string;
        default?: any;
        minimum?: number;
        maximum?: number;
        enum?: string[];
        properties?: {
          [key: string]: {
            type: string;
            description: string;
            enum?: string[];
          };
        };
      };
    };
    required?: string[];
  };
  function: (
    completion_id: string,
    params: any,
    req: IRequest,
    app_url?: string,
    conversationManager?: ConversationManager,
  ) => Promise<IFunctionResponse>;
}

export interface IWeather {
  cod: number;
  main: {
    temp: number;
    feels_like: number;
    temp_min: number;
    temp_max: number;
    pressure: number;
    humidity: number;
  };
  weather: {
    main: string;
    description: string;
  }[];
  wind: {
    speed: number;
    deg: number;
  };
  clouds: {
    all: number;
  };
  sys: {
    country: string;
  };
  name: string;
}

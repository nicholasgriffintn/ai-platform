import z from "zod/v4";

import { nativeMcpIdSchema } from "./native-mcp.js";

export const mcpToolServerConfigurationSchema = z.object({ id: nativeMcpIdSchema }).strict();

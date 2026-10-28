import z from "zod/v4";

export const desktopTerminalSchema = z.object({
  terminalId: z.string().min(1),
  cwd: z.string().min(1),
  scrollback: z.string(),
});
export type DesktopTerminal = z.infer<typeof desktopTerminalSchema>;

export const desktopTerminalEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("output"), data: z.string() }),
  z.object({ type: z.literal("exited"), code: z.number().int().nullable() }),
]);
export type DesktopTerminalEvent = z.infer<typeof desktopTerminalEventSchema>;

export interface DesktopTerminalOpenRequest {
  directoryId: string;
  conversationId: string;
  cols: number;
  rows: number;
}

export type ChannelThreadAction = "mute" | "resume" | "stop";

export function parseChannelThreadAction(body: string): ChannelThreadAction | null {
  const command = body.trim().toLowerCase();

  switch (command) {
    case "polychat mute":
      return "mute";
    case "polychat resume":
      return "resume";
    case "polychat stop":
      return "stop";
    default:
      return null;
  }
}

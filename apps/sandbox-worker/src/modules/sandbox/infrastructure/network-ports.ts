export const READ_LISTENING_SOCKETS_COMMAND =
  "cat /proc/net/tcp && if [ -r /proc/net/tcp6 ]; then cat /proc/net/tcp6; fi";

export function listeningPortsFromProcNet(output: string): Set<number> {
  const ports = new Set<number>();

  for (const line of output.split("\n")) {
    const fields = line.trim().split(/\s+/);

    if (fields[3] !== "0A") {
      continue;
    }

    const port = /:([a-fA-F0-9]{4})$/.exec(fields[1] ?? "")?.[1];

    if (port) {
      ports.add(Number.parseInt(port, 16));
    }
  }

  return ports;
}

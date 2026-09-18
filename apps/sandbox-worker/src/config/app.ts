export const MAX_LOG_CHARS = 80_000;

export const READ_LISTENING_SOCKETS_COMMAND =
  "cat /proc/net/tcp && if [ -r /proc/net/tcp6 ]; then cat /proc/net/tcp6; fi";

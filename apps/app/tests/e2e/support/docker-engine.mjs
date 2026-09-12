export const CONTAINER_EGRESS_IMAGE =
  "cloudflare/proxy-everything:3cb1195@sha256:0ef6716c52430096900b150d84a3302057d6cd2319dae7987128c85d0733e3c8";

export function toWorkerdSocketAddress(dockerHost) {
  return dockerHost.startsWith("tcp://") ? new URL(dockerHost).host : dockerHost;
}

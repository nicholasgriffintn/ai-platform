export class McpProtocolError extends Error {
  constructor(
    public readonly reason:
      | "invalid_response"
      | "invalid_arguments"
      | "request_failed"
      | "unsupported_protocol"
      | "unsupported_input"
      | "catalogue_limit"
      | "tools_unavailable",
  ) {
    super(
      {
        invalid_response: "MCP server returned an invalid response",
        invalid_arguments: "MCP arguments do not match the reviewed tool schema",
        request_failed: "MCP request failed",
        unsupported_protocol: "MCP server must support protocol 2026-07-28",
        unsupported_input: "MCP server requires an unsupported client capability",
        catalogue_limit: "MCP tool catalogue exceeds its size or pagination limit",
        tools_unavailable: "MCP server does not expose tools",
      }[reason],
    );
    this.name = "McpProtocolError";
  }
}

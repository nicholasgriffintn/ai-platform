#!/opt/uv-tools/lean-lsp-mcp/bin/python
"""Run one bounded, read-only Lean LSP MCP diagnostics request."""

import asyncio
import json
import sys

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client


async def main() -> int:
    if len(sys.argv) != 3:
        print("usage: polychat-lean-lsp-advisory PROJECT_ROOT TARGET_PATH", file=sys.stderr)
        return 2

    project_root, target_path = sys.argv[1:]
    server = StdioServerParameters(
        command="lean-lsp-mcp",
        args=[
            "--transport",
            "stdio",
            "--lean-project-path",
            project_root,
            "--disable-tools",
            "lean_run_code,lean_build",
        ],
    )

    async with stdio_client(server) as streams:
        async with ClientSession(*streams) as session:
            await session.initialize()
            result = await session.call_tool(
                "lean_diagnostic_messages",
                {"file_path": target_path, "timeout_s": 45},
            )
            print(json.dumps(result.model_dump(mode="json"), separators=(",", ":")))

    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))

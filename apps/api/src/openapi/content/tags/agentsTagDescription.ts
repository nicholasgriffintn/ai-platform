import { md } from "~/utils/markdown.js";

export const agentsTagDescription = md`# Agents

Create AI agents with custom configurations, tools, and MCP (Model Context Protocol) server integrations.

## Overview

Agents are configurable AI assistants that can:

- Use custom system prompts and instructions
- Connect to MCP servers for extended capabilities
- Access specific models with custom parameters
- Maintain their own configuration
- Be organized into teams
- Use few-shot examples for better performance

## Using Agents

### Create Agent Completion

\`\`\`http
POST /v1/agents/{agentId}/completions
\`\`\`

Start a conversation with an agent. The agent will use its configured model, system prompt, MCP servers, and tools automatically.

**Request:**
\`\`\`json
{
  "messages": [
    {
      "role": "user",
      "content": "Review this code: function add(a,b){return a+b}"
    }
  ],
  "stream": true
}
\`\`\`

Uses the same parameters as \`/v1/chat/completions\`, but with agent configuration applied automatically.

**Response:**
Same format as chat completions, with the agent's configuration applied.

## MCP Server Integration

### What are MCP Servers?

MCP (Model Context Protocol) servers provide external context and capabilities to agents:

- File system access
- Database connections
- API integrations
- Custom tools
- Real-time data sources

### MCP Server Configuration

Each server in the \`servers\` array supports:

**Required:**
- \`url\` - MCP server endpoint URL

**Optional:**
- \`type\` - \`"sse"\` (Server-Sent Events) or \`"stdio"\` (default: "sse")
- \`command\` - Command for stdio transports
- \`args\` - Arguments for stdio transports
- \`env\` - Environment variables: \`[{key: "VAR", value: "value"}]\`
- \`headers\` - HTTP headers for SSE: \`[{key: "Header", value: "value"}]\`

**Example SSE Server:**
\`\`\`json
{
  "url": "https://mcp.example.com",
  "type": "sse",
  "headers": [
    {"key": "Authorization", "value": "Bearer token123"}
  ]
}
\`\`\`

**Example stdio Server:**
\`\`\`json
{
  "url": "file:///path/to/server",
  "type": "stdio",
  "command": "node",
  "args": ["server.js"],
  "env": [
    {"key": "API_KEY", "value": "key123"}
  ]
}
\`\`\`

## Agent Configuration

### System Prompts

Define how your agent behaves:

\`\`\`json
{
  "system_prompt": "You are a helpful coding assistant. Always provide examples and explain your reasoning. Format code using markdown."
}
\`\`\`

### Model Parameters

Control the model:

\`\`\`json
{
  "model": "claude-3-5-sonnet-20241022",
  "temperature": 0.7,
  "max_steps": 10
}
\`\`\`

- \`model\` - Any available model ID
- \`temperature\` - 0-1, controls randomness
- \`max_steps\` - Maximum sequential LLM calls (for tool use)

### Few-Shot Examples

Provide example inputs/outputs to guide behavior:

\`\`\`json
{
  "few_shot_examples": [
    {
      "input": "How do I sort a list?",
      "output": "Here's how to sort a list in Python:\\n\`\`\`python\\nmy_list.sort()\\n\`\`\`"
    }
  ]
}
\`\`\`

### Team Configuration

Organize agents into teams:

\`\`\`json
{
  "team_id": "team_xyz789",
  "team_role": "researcher",
  "is_team_agent": true
}
\`\`\`

## Use Cases

### Code Review Agent

\`\`\`json
{
  "name": "Senior Code Reviewer",
  "model": "claude-3-5-sonnet-20241022",
  "system_prompt": "Review code for:\\n1. Security issues\\n2. Performance problems\\n3. Best practices\\n4. Code style\\nProvide specific, actionable feedback.",
  "temperature": 0.2,
  "servers": [
    {
      "url": "https://git-mcp.example.com",
      "type": "sse"
    }
  ]
}
\`\`\`

### Research Assistant

\`\`\`json
{
  "name": "Research Assistant",
  "model": "gpt-4o",
  "system_prompt": "Help with research by finding, summarizing, and citing sources. Always verify information and provide links.",
  "max_steps": 15,
  "servers": [
    {
      "url": "https://web-search-mcp.example.com",
      "type": "sse"
    }
  ]
}
\`\`\`

### Customer Support

\`\`\`json
{
  "name": "Support Agent",
  "model": "claude-3-5-haiku-20241022",
  "system_prompt": "Provide friendly, helpful customer support. Be concise and solution-focused.",
  "temperature": 0.5,
  "servers": [
    {
      "url": "https://database-mcp.example.com",
      "type": "sse",
      "headers": [
        {"key": "Authorization", "value": "Bearer db_token"}
      ]
    }
  ]
}
\`\`\`

## Examples

### Create a Code Assistant

\`\`\`bash
curl -X POST https://api.polychat.app/v1/agents \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Code Helper",
    "model": "claude-3-5-sonnet-20241022",
    "system_prompt": "You are a code assistant. Help with coding questions and provide clean, documented code examples.",
    "temperature": 0.4
  }'
\`\`\`

### Use an Agent

\`\`\`bash
curl -X POST https://api.polychat.app/v1/agents/agent_abc123/completions \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "messages": [
      {"role": "user", "content": "How do I handle errors in async functions?"}
    ]
  }'
\`\`\`

### Update an Agent

\`\`\`bash
curl -X PUT https://api.polychat.app/v1/agents/agent_abc123 \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type": application/json" \\
  -d '{
    "system_prompt": "Updated system prompt with new instructions...",
    "temperature": 0.6
  }'
\`\`\`

## Best Practices

1. **Specific System Prompts** - Be clear about the agent's role and behavior
2. **Appropriate Models** - Choose models that fit the task (cost vs capability)
3. **Temperature Settings** - Lower for deterministic tasks, higher for creative ones
4. **Test Thoroughly** - Test agents before production use
5. **MCP Security** - Secure MCP server endpoints with proper authentication
6. **Few-Shot Examples** - Provide examples for complex or specific behavior`;

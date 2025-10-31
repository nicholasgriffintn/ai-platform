# Agents

Create AI agents with custom configurations, tools, and MCP (Model Context Protocol) server integrations.

## Overview

Agents are configurable AI assistants that can:

- Use custom system prompts and instructions
- Connect to MCP servers for extended capabilities
- Access specific models with custom parameters
- Maintain their own configuration
- Be organized into teams
- Use few-shot examples for better performance

## Endpoints

### List Your Agents

```http
GET /v1/agents
```

Get all agents you've created.

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "id": "agent_abc123",
      "name": "Code Reviewer",
      "description": "Reviews code for best practices",
      "model": "claude-3-5-sonnet-20241022",
      "temperature": 0.3,
      "system_prompt": "You are an expert code reviewer...",
      "created_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### List Team Agents

```http
GET /v1/agents/teams
```

Get all team agents for the current user.

### Get Agents by Team ID

```http
GET /v1/agents/teams/{teamId}
```

Get all agents belonging to a specific team.

### Create Agent

```http
POST /v1/agents
```

**Request:**
```json
{
  "name": "Code Reviewer",
  "description": "Reviews code for best practices and bugs",
  "avatar_url": "https://example.com/avatar.png",
  "model": "claude-3-5-sonnet-20241022",
  "temperature": 0.3,
  "max_steps": 5,
  "system_prompt": "You are an expert code reviewer. Focus on code quality, security, and best practices.",
  "servers": [
    {
      "url": "https://mcp-server.example.com",
      "type": "sse",
      "headers": [
        {"key": "Authorization", "value": "Bearer token"}
      ]
    }
  ],
  "few_shot_examples": [
    {
      "input": "Review this function",
      "output": "Here's my analysis..."
    }
  ],
  "team_id": "team_xyz789",
  "team_role": "reviewer",
  "is_team_agent": false
}
```

**Required:**
- `name` - Agent name

**Optional:**
- `description` - Agent description
- `avatar_url` - Avatar image URL
- `servers` - Array of MCP server configurations
- `model` - Model ID to use
- `temperature` - 0-1, sampling temperature
- `max_steps` - Maximum number of steps
- `system_prompt` - System prompt for the agent
- `few_shot_examples` - Array of example inputs/outputs
- `team_id` - Team ID this agent belongs to
- `team_role` - Role within the team
- `is_team_agent` - Whether this is a team agent (default: false)

**Response:**
```json
{
  "status": "success",
  "data": {
    "id": "agent_abc123",
    "name": "Code Reviewer",
    ...
  }
}
```

### Get Agent Details

```http
GET /v1/agents/{agentId}
```

Retrieve full agent configuration.

### Get Agent MCP Servers

```http
GET /v1/agents/{agentId}/servers
```

List MCP servers connected to this agent.

**Response:**
```json
{
  "status": "success",
  "data": {
    "servers": [
      {
        "url": "https://mcp-server.example.com",
        "type": "sse",
        "headers": [...]
      }
    ],
    "tools": [...]
  }
}
```

### Update Agent

```http
PUT /v1/agents/{agentId}
```

Modify agent settings. At least one field must be provided.

**Request:**
```json
{
  "name": "Updated Name",
  "temperature": 0.5,
  "system_prompt": "New system prompt..."
}
```

All fields from create are optional.

### Delete Agent

```http
DELETE /v1/agents/{agentId}
```

**Response:**
```json
{
  "status": "success"
}
```

## Using Agents

### Create Agent Completion

```http
POST /v1/agents/{agentId}/completions
```

Start a conversation with an agent. The agent will use its configured model, system prompt, MCP servers, and tools automatically.

**Request:**
```json
{
  "messages": [
    {
      "role": "user",
      "content": "Review this code: function add(a,b){return a+b}"
    }
  ],
  "stream": true
}
```

Uses the same parameters as `/v1/chat/completions`, but with agent configuration applied automatically.

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

Each server in the `servers` array supports:

**Required:**
- `url` - MCP server endpoint URL

**Optional:**
- `type` - `"sse"` (Server-Sent Events) or `"stdio"` (default: "sse")
- `command` - Command for stdio transports
- `args` - Arguments for stdio transports
- `env` - Environment variables: `[{key: "VAR", value: "value"}]`
- `headers` - HTTP headers for SSE: `[{key: "Header", value: "value"}]`

**Example SSE Server:**
```json
{
  "url": "https://mcp.example.com",
  "type": "sse",
  "headers": [
    {"key": "Authorization", "value": "Bearer token123"}
  ]
}
```

**Example stdio Server:**
```json
{
  "url": "file:///path/to/server",
  "type": "stdio",
  "command": "node",
  "args": ["server.js"],
  "env": [
    {"key": "API_KEY", "value": "key123"}
  ]
}
```

## Agent Configuration

### System Prompts

Define how your agent behaves:

```json
{
  "system_prompt": "You are a helpful coding assistant. Always provide examples and explain your reasoning. Format code using markdown."
}
```

### Model Parameters

Control the model:

```json
{
  "model": "claude-3-5-sonnet-20241022",
  "temperature": 0.7,
  "max_steps": 10
}
```

- `model` - Any available model ID
- `temperature` - 0-1, controls randomness
- `max_steps` - Maximum sequential LLM calls (for tool use)

### Few-Shot Examples

Provide example inputs/outputs to guide behavior:

```json
{
  "few_shot_examples": [
    {
      "input": "How do I sort a list?",
      "output": "Here's how to sort a list in Python:\n```python\nmy_list.sort()\n```"
    }
  ]
}
```

### Team Configuration

Organize agents into teams:

```json
{
  "team_id": "team_xyz789",
  "team_role": "researcher",
  "is_team_agent": true
}
```

## Use Cases

### Code Review Agent

```json
{
  "name": "Senior Code Reviewer",
  "model": "claude-3-5-sonnet-20241022",
  "system_prompt": "Review code for:\n1. Security issues\n2. Performance problems\n3. Best practices\n4. Code style\nProvide specific, actionable feedback.",
  "temperature": 0.2,
  "servers": [
    {
      "url": "https://git-mcp.example.com",
      "type": "sse"
    }
  ]
}
```

### Research Assistant

```json
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
```

### Customer Support

```json
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
```

## Examples

### Create a Code Assistant

```bash
curl -X POST https://api.polychat.app/v1/agents \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Code Helper",
    "model": "claude-3-5-sonnet-20241022",
    "system_prompt": "You are a code assistant. Help with coding questions and provide clean, documented code examples.",
    "temperature": 0.4
  }'
```

### Use an Agent

```bash
curl -X POST https://api.polychat.app/v1/agents/agent_abc123/completions \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "How do I handle errors in async functions?"}
    ]
  }'
```

### Update an Agent

```bash
curl -X PUT https://api.polychat.app/v1/agents/agent_abc123 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type": application/json" \
  -d '{
    "system_prompt": "Updated system prompt with new instructions...",
    "temperature": 0.6
  }'
```

## Best Practices

1. **Specific System Prompts** - Be clear about the agent's role and behavior
2. **Appropriate Models** - Choose models that fit the task (cost vs capability)
3. **Temperature Settings** - Lower for deterministic tasks, higher for creative ones
4. **Test Thoroughly** - Test agents before production use
5. **MCP Security** - Secure MCP server endpoints with proper authentication
6. **Few-Shot Examples** - Provide examples for complex or specific behavior

## Related Features

- [Chat Completions](./chat-completions.md) - Understanding the completion format
- [Models](./models.md) - Choose the right model for your agent
- [MCP Documentation](https://modelcontextprotocol.io) - Learn about MCP servers

# Instructions for Claude Code

## Agent-Specific Documentation

This project maintains separate AGENTS.md files throughout the codebase that contain context-specific guidance for AI agents. **Always read the relevant AGENTS.md file(s) before working in any part of the application.**

### Available AGENTS.md Files

1. **Root**: [AGENTS.md](AGENTS.md) - Project overview, architecture, and global conventions
2. **API**: [apps/api/AGENTS.md](apps/api/AGENTS.md) - Cloudflare Worker API specifics
3. **Web App**: [apps/app/AGENTS.md](apps/app/AGENTS.md) - React Router 7 web client guidance
4. **Metrics Dashboard**: [apps/metrics/AGENTS.md](apps/metrics/AGENTS.md) - Analytics dashboard context
5. **iOS Mobile**: [apps/mobile/ios/AGENTS.md](apps/mobile/ios/AGENTS.md) - Native iOS client specifics
6. **Shared Schemas**: [packages/schemas/AGENTS.md](packages/schemas/AGENTS.md) - Type definitions and contracts

## Workflow

When working on any task:

1. **Start with the root [AGENTS.md](AGENTS.md)** for project structure and general conventions
2. **Read the relevant workspace-specific AGENTS.md** for the area you're working in
3. If changes span multiple workspaces, read all relevant AGENTS.md files before proceeding


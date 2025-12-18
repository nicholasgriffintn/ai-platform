# Project Rules (Concise)

**READ THIS DOCUMENT IN FULL BEFORE DOING ANY WORK.**  
These rules apply to _all_ work, with no exceptions. They exist due to prior failures and are mandatory.

---

## Session Start

- **Always read `PROJECT_LOG.md` first** to understand state, context, and in‑progress work.
- Never start work without full context.

---

## Task Intake

- Do **exactly** what is asked—nothing more, nothing less.
- Ask for clarification when requirements are unclear.
- Break multi-step work into todos.
- Maintain **one** in-progress task at a time.
- Each task must have a single, clear responsibility.

---

## Development

- Read files before editing them.
- Preserve existing, working code.
- Prefer editing existing files over creating new ones.
- Use the correct tools for reading, editing, writing, searching, and globbing.
- Batch tool calls where possible.
- Pin dependency versions and use stable releases.
- **No placeholders**—all code must be complete and functional.
- Use extended timeouts for installs, builds, Docker, and git operations.
- Test before claiming success.
- Never mark work complete without verification.
- Update todo status immediately and accurately.

---

## Safety

- Verify before any destructive operation.
- Ask before irreversible actions.
- Actively monitor file count and disk usage.
- Prevent file bloat with `.gitignore` and cleanup.
- Recycle and version files instead of creating new ones.
- Follow security best practices:
  - No secrets in repos
  - Use environment variables
  - Validate inputs
  - Secure APIs, data, and dependencies

---

## Quality Assurance

- Mandatory code review before completion.
- Tests are required for production code (scope depends on project type).
- Performance must be verified where relevant.
- Document benchmarks and regressions.

---

## Session End

- Use Git and GitHub for all projects.
- Commit often, clearly, and atomically.
- Push regularly.
- Follow defined branching strategies.
- Update `PROJECT_LOG.md` with **rebuild-level detail** after major changes.
- At phase boundaries, run a **mandatory phase completion review** covering:
  - Background processes
  - Git status
  - Documentation
  - Code quality
  - Todos
  - Safety

---

## Operating Principles

- Be concise.
- Do not create unsolicited documentation.
- Safety overrides speed.
- When in doubt, stop and ask.

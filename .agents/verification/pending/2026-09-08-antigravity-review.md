# Unused external-agent commands are removed

The Antigravity launch, comparison and local-commit bridge commands had no application callers. Remove those commands and their fake test responses rather than advertise an unfinished integration. Agent processes continue through the compiled CLI drivers and explicitly selected working directories.

## Verify

- [x] Confirm the desktop does not offer Antigravity as an executable chat agent.
- [ ] Confirm configured CLI agents still start from the folder picker and return output.

## Automated evidence — 9 September 2026

- Reviewed the current desktop, shared runtime contracts and React discovery sources: no Antigravity executable registration remains. Compiled AgentDriver choices and program dispatch omit it. Existing native tests cover the remaining typed CLI argument builders; configured real-provider execution remains a separate unchecked item.

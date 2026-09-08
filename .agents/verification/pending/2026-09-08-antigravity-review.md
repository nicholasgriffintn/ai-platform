# Unused external-agent commands are removed

The Antigravity launch, comparison and local-commit bridge commands had no application callers. Remove those commands and their fake test responses rather than advertise an unfinished integration. Agent processes continue through the compiled CLI drivers and explicitly selected working directories.

## Verify

- [ ] Confirm the desktop does not offer Antigravity as an executable chat agent.
- [ ] Confirm configured CLI agents still start from the folder picker and return output.

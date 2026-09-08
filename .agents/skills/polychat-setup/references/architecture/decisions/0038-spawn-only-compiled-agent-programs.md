# 0038: Spawn only programs the core was compiled knowing

Status: accepted

## Problem

The desktop renderer must not be able to turn user-controlled input into an arbitrary local process. Coding agents also need an approved workspace boundary and a useful record of the repository state before a run starts.

## Decision

The Rust core owns process spawning, argv construction, stdio, working-directory checks and cancellation. The renderer selects a compiled driver and supplies typed run parameters; it never supplies a program name or shell command. Directory grants are canonicalised, persisted locally and revocable. Discovery and send preflight probe installed CLIs through their version and sign-in commands. Polychat does not parse or copy their credential files. OpenCode must report a configured credential or provider environment variable before it is offered as ready. Process output crosses the bridge as raw lines; TypeScript parses it into the desktop stream contract.

The core refuses unsafe or unapproved directories, dirty repositories unless explicitly acknowledged, concurrent runs in one directory and missing or unsupported executables. It records the starting `HEAD` in the run-start event. It never commits, changes branches or rewrites repository history.

## Consequences

Adding a provider requires a compiled driver mapping and recognised assistant output. A local run can leave a dirty checkout and cannot promise that a third-party process will behave well after it has been launched. The desktop asks for a working folder before each process turn; accepting a directory remains an explicit action.

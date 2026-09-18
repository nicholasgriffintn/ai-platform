import type { PromptEntry } from "../schema.js";

export const sandboxPromptEntries = [
  {
    id: "sandbox/planning",
    task: "sandbox-agent",
    title: "Sandbox planning prompt",
    description: "Plans an implementation for a repository before the sandbox agent starts work.",
    text: `You are planning a code implementation for repository {{repoName}}.
Task: {{task}}

{{repositoryContext}}

{{strategySection}}

Planning requirements:
1. If PRD user stories exist, choose one passes=false story to implement first and cite its story id/title.
2. Explain what files should be changed and why.
3. Define key implementation steps and ordering.
4. Include a 'Validation commands' section with one shell command per line (no chaining).
5. Call out risks or assumptions to verify during execution.
6. If checks are independent and safe to run together, call out a run_parallel batch candidate (for example: git status --short, rg --files, lint, test).`,
    variables: [
      { name: "repoName", description: "Name of the repository being planned." },
      { name: "task", description: "Task the sandbox agent has been asked to implement." },
      {
        name: "repositoryContext",
        description:
          "Pre-rendered repository context (top-level entries, file snippets and task instructions).",
      },
      {
        name: "strategySection",
        description:
          "Pre-rendered prompt-strategy section containing the selected strategy, reason, planning focus and examples.",
      },
    ],
  },
  {
    id: "sandbox/agent-system",
    task: "sandbox-agent",
    title: "Sandbox agent system prompt",
    description:
      "System prompt for the autonomous coding agent that runs inside the sandboxed shell.",
    text: `You are an autonomous coding agent running inside a sandboxed shell.
Repository root is '{{repoTargetDir}}'.
Selected prompt strategy: {{strategyLabel}} ({{strategy}}).
Selection reason: {{reason}}
Execution focus:
{{executionFocus}}
Respond with exactly one JSON object per message and no markdown.
Allowed actions:
- run_command: {"action":"run_command","command":"...","reasoning":"..."}
- run_parallel: {"action":"run_parallel","commands":["...","..."],"reasoning":"..."}
- read_file: {"action":"read_file","path":"path/from/repo/root","startLine":1,"endLine":120,"reasoning":"..."}
- read_files: {"action":"read_files","files":[{"path":"path/from/repo/root","startLine":1,"endLine":120},{"path":"another/path"}],"reasoning":"..."}
- run_script: {"action":"run_script","code":"...","language":"python","reasoning":"..."}
- update_plan: {"action":"update_plan","plan":"...","reasoning":"..."}
- finish: {"action":"finish","summary":"...","reasoning":"..."}
Rules for run_command:
- Must be a single command.
- Do not include cd.
- Do not chain commands with &&, ||, ;, pipes, or command substitution.
- Do not run git add, branch, checkout, commit, push or switch; delivery is handled after validation.
- Prefer safe inspection/edit/build/test commands.
{{#readOnlyCommandsRule}}- This run is read-only: use only inspection and test/lint/typecheck commands.
{{/readOnlyCommandsRule}}Rules for run_parallel:
- Use only independent read-only inspection/verification commands.
- Maximum 4 commands per run_parallel action.
- Each command must follow all run_command safety rules.
- Do not use run_parallel for mutating commands.
Rules for read_files:
- Maximum {{maxReadFilesBatch}} files per read_files action.
- Use for parallel context gathering across independent files.
- Each file target accepts path and optional startLine/endLine.
Rules for run_script:
- Write a script that performs multiple file operations or shell commands in one step.
- Supported languages: python, javascript, typescript (default: javascript).
- The script runs inside the sandbox container with full filesystem access at '{{repoTargetDir}}'.
- Use run_script when you need to batch multiple file reads, writes, or edits in one step.
- Prefer run_script over sequential run_command calls when making changes to 3+ files.
- The script's stdout/stderr will be returned as the observation.
{{#readOnlyCommandsRule}}- Scripts are not allowed for this read-only run.
{{/readOnlyCommandsRule}}Tool-use heuristics:
- Prefer read_file first when the target file or exact edit location is uncertain.
- Prefer read_files for fast multi-file context gathering before writing code.
- Prefer run_parallel for independent, safe checks (for example: git status --short plus rg/ls/test/lint).
- Prefer run_script for coordinated edits across multiple files or when a command pipeline would otherwise be required.
- Prefer deterministic inspection commands (rg, ls, cat, git status, git diff) before build/test commands.
- If a command/script is blocked or fails, do not repeat it unchanged: update_plan with a revised approach before continuing.
Use read_file when you need more context before deciding on commands.
After each command result, adapt the next action based on the output.
Use finish only when the task is implemented and validated, or when blocked with a clear reason.`,
    variables: [
      {
        name: "repoTargetDir",
        description: "Absolute path of the repository root inside the sandbox.",
      },
      {
        name: "strategyLabel",
        description: "Human-readable label of the selected prompt strategy.",
      },
      {
        name: "strategy",
        description: "Resolved prompt-strategy key (for example, feature-delivery).",
      },
      { name: "reason", description: "Reason the prompt strategy was selected." },
      {
        name: "executionFocus",
        description: "Execution-focus bullets for the selected prompt strategy.",
      },
      {
        name: "maxReadFilesBatch",
        description: "Maximum number of files allowed per read_files action.",
      },
      {
        name: "readOnlyCommandsRule",
        description:
          "Set when the run is read-only; gates the additional command and script restriction lines.",
      },
    ],
  },
  {
    id: "sandbox/kickoff",
    task: "sandbox-agent",
    title: "Sandbox agent kickoff prompt",
    description: "Seeds the sandbox agent with the approved plan and execution limits.",
    text: `Repository: {{repoName}}
Task: {{task}}

Prompt strategy: {{strategyLabel}} ({{strategy}})
Reason: {{reason}}

Current implementation plan:
{{plan}}

{{repositoryContext}}

Execution limits: max {{maxCommands}} commands and {{maxAgentSteps}} total agent steps.
Return the next best action as JSON.`,
    variables: [
      { name: "repoName", description: "Name of the repository being worked on." },
      { name: "task", description: "Task the sandbox agent has been asked to implement." },
      {
        name: "strategyLabel",
        description: "Human-readable label of the selected prompt strategy.",
      },
      {
        name: "strategy",
        description: "Resolved prompt-strategy key (for example, feature-delivery).",
      },
      { name: "reason", description: "Reason the prompt strategy was selected." },
      { name: "plan", description: "Approved implementation plan to execute." },
      {
        name: "repositoryContext",
        description:
          "Pre-rendered repository context (top-level entries, file snippets and task instructions).",
      },
      { name: "maxCommands", description: "Maximum number of commands the agent may run." },
      { name: "maxAgentSteps", description: "Maximum number of agent steps for the run." },
    ],
  },
  {
    id: "sandbox/observation/read-error",
    task: "sandbox-agent",
    title: "Sandbox read observation (error)",
    description: "Observation returned to the sandbox agent when a file read fails.",
    text: `File read failed for {{path}}.
Error: {{error}}
Choose a different path or action.`,
    variables: [
      { name: "path", description: "Path the agent attempted to read." },
      { name: "error", description: "Truncated error message from the failed read." },
    ],
  },
  {
    id: "sandbox/observation/read",
    task: "sandbox-agent",
    title: "Sandbox read observation (success)",
    description: "Observation returned to the sandbox agent after a successful file read.",
    text: `Read file {{path}} lines {{startLine}}-{{endLine}}.
{{#truncatedNotice}}{{truncatedNotice}}
{{/truncatedNotice}}File contents:
\`\`\`
{{content}}
\`\`\``,
    variables: [
      { name: "path", description: "Path of the file that was read." },
      { name: "startLine", description: "First line returned." },
      { name: "endLine", description: "Last line returned." },
      {
        name: "truncatedNotice",
        description:
          "Set to 'Output was truncated.' when the read output was truncated; empty otherwise.",
      },
      { name: "content", description: "Truncated file contents that were read." },
    ],
  },
  {
    id: "sandbox/observation/command",
    task: "sandbox-agent",
    title: "Sandbox command observation",
    description: "Observation returned to the sandbox agent after a command runs.",
    text: `Command: {{command}}
Success: {{success}}
Exit code: {{exitCode}}
STDOUT:
\`\`\`
{{stdout}}
\`\`\`
STDERR:
\`\`\`
{{stderr}}
\`\`\``,
    variables: [
      { name: "command", description: "Command that was run." },
      { name: "success", description: "Whether the command succeeded." },
      { name: "exitCode", description: "Exit code returned by the command." },
      { name: "stdout", description: "Trimmed, truncated standard output." },
      { name: "stderr", description: "Trimmed, truncated standard error." },
    ],
  },
  {
    id: "sandbox/strategy/feature-delivery/planning",
    task: "sandbox-strategy",
    variant: "planning",
    title: "Feature delivery planning focus",
    description: "Planning-focus bullets from the feature-delivery prompt strategy.",
    text: `- Prioritise end-to-end behaviour before internal refactors.
- Reuse existing modules and patterns unless there is a strong reason to diverge.
- List state, validation, and user-facing edge cases in the plan.`,
  },
  {
    id: "sandbox/strategy/feature-delivery/execution",
    task: "sandbox-strategy",
    variant: "execution",
    title: "Feature delivery execution focus",
    description: "Execution-focus bullets from the feature-delivery prompt strategy.",
    text: `- Implement in small, verifiable steps and keep interfaces stable.
- Prefer extending existing services/components over introducing new abstraction layers.
- Validate behaviour with targeted tests or checks before finishing.`,
  },
  {
    id: "sandbox/strategy/feature-delivery/examples",
    task: "sandbox-strategy",
    variant: "examples",
    title: "Feature delivery implementation examples",
    description: "Good implementation examples from the feature-delivery prompt strategy.",
    text: `Example 1: Ship a new user-facing capability
Situation: Adding a new action in an existing product flow.
Approach:
- Trace the full flow from input to persistence and response rendering.
- Update API contracts and UI handling together to avoid drift.
- Reuse existing validators/utilities for payload parsing and error shapes.
Validation:
- Run integration checks for the full happy path.
- Add failure-path coverage for validation and permission errors.

Example 2: Extend an existing workflow safely
Situation: Enhancing behaviour without breaking existing callers.
Approach:
- Keep existing function signatures stable where possible.
- Gate new behaviour behind explicit branching with clear defaults.
- Refactor duplicated logic only when needed by the new flow.
Validation:
- Verify existing tests still pass.
- Add targeted checks for the new branch and fallback path.`,
  },
  {
    id: "sandbox/strategy/bug-fix/planning",
    task: "sandbox-strategy",
    variant: "planning",
    title: "Bug fix planning focus",
    description: "Planning-focus bullets from the bug-fix prompt strategy.",
    text: `- Reproduce the failure first and record concrete signals of the bug.
- Identify the narrowest safe fix that resolves the root cause.
- Include explicit regression validation in plan commands.`,
  },
  {
    id: "sandbox/strategy/bug-fix/execution",
    task: "sandbox-strategy",
    variant: "execution",
    title: "Bug fix execution focus",
    description: "Execution-focus bullets from the bug-fix prompt strategy.",
    text: `- Avoid broad rewrites unless root-cause analysis proves they are required.
- Preserve existing behaviour outside the failing scenario.
- Add regression coverage for the exact failure mode.`,
  },
  {
    id: "sandbox/strategy/bug-fix/examples",
    task: "sandbox-strategy",
    variant: "examples",
    title: "Bug fix implementation examples",
    description: "Good implementation examples from the bug-fix prompt strategy.",
    text: `Example 1: Fix a runtime failure
Situation: A request fails due to missing guardrails on input handling.
Approach:
- Add missing validation close to the input boundary.
- Return consistent typed errors instead of throwing generic exceptions.
- Keep downstream services unchanged unless they contribute to the bug.
Validation:
- Run the failing scenario before and after the change.
- Add a regression test that would fail without the fix.

Example 2: Resolve a behavioural regression
Situation: Recent change altered expected state transitions.
Approach:
- Compare current vs expected transition logic with small diffs.
- Restore invariants at the state boundary, not at every call site.
- Document assumptions in the updated plan to prevent repeat regressions.
Validation:
- Validate both regression case and unaffected adjacent states.
- Run targeted tests to prove old behaviour remains intact.`,
  },
  {
    id: "sandbox/strategy/refactor/planning",
    task: "sandbox-strategy",
    variant: "planning",
    title: "Refactor planning focus",
    description: "Planning-focus bullets from the refactor prompt strategy.",
    text: `- Define clear maintainability goals before changing structure.
- Prefer incremental refactors with preserved behaviour at each step.
- Use existing shared utilities before adding new helper layers.`,
  },
  {
    id: "sandbox/strategy/refactor/execution",
    task: "sandbox-strategy",
    variant: "execution",
    title: "Refactor execution focus",
    description: "Execution-focus bullets from the refactor prompt strategy.",
    text: `- Keep business behaviour unchanged while reducing duplication and complexity.
- Extract shared logic only when at least two call sites benefit immediately.
- Retain public contracts unless task explicitly allows API changes.`,
  },
  {
    id: "sandbox/strategy/refactor/examples",
    task: "sandbox-strategy",
    variant: "examples",
    title: "Refactor implementation examples",
    description: "Good implementation examples from the refactor prompt strategy.",
    text: `Example 1: Reduce duplicated backend logic
Situation: Multiple services repeat the same parsing and validation flow.
Approach:
- Create one focused shared utility with clear input/output typing.
- Migrate one call site at a time and run checks between changes.
- Delete dead branches after migration to avoid parallel code paths.
Validation:
- Run integration tests for all migrated call sites.
- Check that logging and error payloads remain consistent.

Example 2: Refactor UI flow for readability
Situation: Single component has too much conditional rendering logic.
Approach:
- Extract stable subcomponents aligned to explicit view states.
- Keep state management in the parent unless shared state is needed.
- Reuse existing UI primitives and class naming conventions.
Validation:
- Verify each view state renders correctly.
- Run existing UI tests and add one for the split state boundary.`,
  },
  {
    id: "sandbox/strategy/test-hardening/planning",
    task: "sandbox-strategy",
    variant: "planning",
    title: "Test hardening planning focus",
    description: "Planning-focus bullets from the test-hardening prompt strategy.",
    text: `- Focus on integration-style coverage for validation, state, and error handling.
- Prefer high-signal tests over broad low-value unit assertions.
- Map each new test to a concrete risk or requirement.`,
  },
  {
    id: "sandbox/strategy/test-hardening/execution",
    task: "sandbox-strategy",
    variant: "execution",
    title: "Test hardening execution focus",
    description: "Execution-focus bullets from the test-hardening prompt strategy.",
    text: `- Test externally visible behaviour, not implementation details.
- Cover edge cases and failure paths that would impact users or data integrity.
- Keep test fixtures minimal and representative.`,
  },
  {
    id: "sandbox/strategy/test-hardening/examples",
    task: "sandbox-strategy",
    variant: "examples",
    title: "Test hardening implementation examples",
    description: "Good implementation examples from the test-hardening prompt strategy.",
    text: `Example 1: Add coverage for a stateful API path
Situation: Endpoint has weak validation and sparse error-path tests.
Approach:
- Write integration tests around realistic request/response flows.
- Assert status codes and response payload semantics.
- Include invalid input and permission-denied cases.
Validation:
- Run focused test suite and verify failure messages are clear.
- Confirm no unrelated tests became flaky after fixture updates.

Example 2: Harden long-running workflow tests
Situation: Workflow passes happy path but fails silently on intermediate errors.
Approach:
- Add tests per transition step with explicit failure assertions.
- Stub external dependencies at stable boundaries only.
- Keep setup reusable through existing test helpers.
Validation:
- Run the workflow suite with deterministic inputs.
- Verify error handling paths produce expected recovery or fail-fast behaviour.`,
  },
  {
    id: "sandbox/repository-context/top-level-unavailable",
    task: "sandbox-agent",
    title: "Repository context: no top-level entries",
    description: "Fallback line used when top-level repository entries cannot be detected.",
    text: "- (unable to detect top-level entries)",
  },
  {
    id: "sandbox/repository-context/file",
    task: "sandbox-agent",
    title: "Repository context: file snippet",
    description: "One detected file snippet in the repository context.",
    text: `File: {{path}}
\`\`\`
{{snippet}}
\`\`\``,
    variables: [
      { name: "path", description: "Repository-relative file path." },
      { name: "snippet", description: "Truncated file snippet." },
    ],
  },
  {
    id: "sandbox/repository-context/no-files",
    task: "sandbox-agent",
    title: "Repository context: no files",
    description: "Fallback text when no context files were detected.",
    text: "No context files were detected.",
  },
  {
    id: "sandbox/repository-context/instruction-found",
    task: "sandbox-agent",
    title: "Repository context: task instructions",
    description: "Task instruction file discovered in the repository.",
    text: `Found {{source}} instructions in {{path}}:
\`\`\`
{{snippet}}
\`\`\``,
    variables: [
      { name: "source", description: "Uppercased instruction source, for example PRD." },
      { name: "path", description: "Instruction file path." },
      { name: "snippet", description: "Truncated instruction snippet." },
    ],
  },
  {
    id: "sandbox/repository-context/no-instructions",
    task: "sandbox-agent",
    title: "Repository context: no instructions",
    description: "Fallback text when no task instruction files were found.",
    text: "No task instruction files were found.",
  },
  {
    id: "sandbox/repository-context",
    task: "sandbox-agent",
    title: "Repository context block",
    description: "Repository context embedded in sandbox planning and kickoff prompts.",
    text: `Repository top-level entries:
{{topLevelEntries}}

Detected file context snippets:
{{fileContext}}

Task instructions (PRD preferred):
{{taskInstructions}}`,
    variables: [
      { name: "topLevelEntries", description: "Top-level entries as a Markdown list." },
      { name: "fileContext", description: "Detected file snippets." },
      { name: "taskInstructions", description: "Task instruction snippet or fallback." },
    ],
  },
  {
    id: "sandbox/strategy/planning-section",
    task: "sandbox-strategy",
    title: "Sandbox planning strategy section",
    description: "Strategy summary embedded in the planning prompt.",
    text: `Selected prompt strategy: {{strategyLabel}} ({{strategy}})
Selection reason: {{reason}}

Planning focus:
{{planningFocus}}

Good implementation examples to emulate:
{{examples}}`,
    variables: [
      { name: "strategyLabel", description: "Human-readable strategy label." },
      { name: "strategy", description: "Strategy key." },
      { name: "reason", description: "Reason the strategy was selected." },
      { name: "planningFocus", description: "Planning focus bullets." },
      { name: "examples", description: "Good implementation examples." },
    ],
  },
  {
    id: "sandbox/notice/repeated-action",
    task: "sandbox-agent",
    title: "Repeated action notice",
    description: "Injected when the agent repeats the same action too many times.",
    text: `Do not repeat the same action again.
Use update_plan now with a new approach before continuing.`,
  },
  {
    id: "sandbox/notice/read-batch-truncated",
    task: "sandbox-agent",
    title: "Read batch truncation notice",
    description: "Injected when a read_files batch hit its file limit.",
    text: "Only the first {{maxReadFilesBatch}} files were read in this batch.",
    variables: [{ name: "maxReadFilesBatch", description: "Maximum files allowed per batch." }],
  },
  {
    id: "sandbox/notice/read-batch-completed",
    task: "sandbox-agent",
    title: "Read batch completion notice",
    description: "Header for a completed read_files batch observation.",
    text: "Completed read_files batch for {{fileCount}} files.",
    variables: [{ name: "fileCount", description: "Number of files read." }],
  },
  {
    id: "sandbox/notice/approval-rejected",
    task: "sandbox-agent",
    title: "Command approval rejection notice",
    description: "Injected when a command approval request is rejected.",
    text: "Command approval was not granted for: {{command}}. {{reason}} Choose a safer alternative command or continue with read_file/update_plan.",
    variables: [
      { name: "command", description: "Command that was rejected." },
      { name: "reason", description: "Rejection message or default details." },
    ],
  },
  {
    id: "sandbox/notice/command-blocked",
    task: "sandbox-agent",
    title: "Command blocked notice",
    description: "Injected when sandbox command policy blocks a command.",
    text: `Command blocked: {{command}}
Error: {{error}}
Choose a single safe command without shell chaining, pipes, or substitution.`,
    variables: [
      { name: "command", description: "Command that was blocked." },
      { name: "error", description: "Truncated policy error." },
    ],
  },
  {
    id: "sandbox/notice/commands-failing",
    task: "sandbox-agent",
    title: "Commands failing notice",
    description: "Injected when consecutive commands fail.",
    text: `Commands have failed repeatedly.
Use update_plan to revise the approach with safer, more targeted steps before running more commands.`,
  },
  {
    id: "sandbox/notice/command-failures-exhausted",
    task: "sandbox-agent",
    title: "Command failures exhausted notice",
    description: "Injected when command policy failures exhaust the retry budget.",
    text: `Multiple command attempts were blocked.
Use update_plan now to revise the execution strategy before trying another action.`,
  },
  {
    id: "sandbox/notice/review-parallel-outputs",
    task: "sandbox-agent",
    title: "Parallel failure review notice",
    description: "Injected when a run_parallel batch reports failures.",
    text: "Review outputs and revise with update_plan before retrying.",
  },
  {
    id: "sandbox/notice/script-not-allowed",
    task: "sandbox-agent",
    title: "Script not allowed notice",
    description: "Injected when scripts are unavailable in the run mode.",
    text: "Scripts are not allowed in this run mode. Use run_command or read_file instead.",
  },
  {
    id: "sandbox/notice/script-failed",
    task: "sandbox-agent",
    title: "Script failed notice",
    description: "Injected when a script throws before execution starts.",
    text: `Script execution failed.
Error: {{error}}
Use python/javascript/typescript run_script, run_command, or read_file instead.`,
    variables: [{ name: "error", description: "Truncated script error." }],
  },
  {
    id: "sandbox/notice/script-attempts-failing",
    task: "sandbox-agent",
    title: "Script attempts failing notice",
    description: "Injected when script attempts repeatedly fail.",
    text: `Script attempts are failing repeatedly.
Use update_plan now to choose a safer next approach before further execution.`,
  },
  {
    id: "sandbox/notice/script-error",
    task: "sandbox-agent",
    title: "Script error notice",
    description: "Injected when a script completes with an execution error.",
    text: `Script execution failed.
Error: {{error}}{{#traceback}}
Traceback:
{{traceback}}{{/traceback}}
Fix the issue or try a different approach.`,
    variables: [
      { name: "error", description: "Truncated script error." },
      { name: "traceback", description: "Truncated traceback when one is available." },
    ],
  },
  {
    id: "sandbox/notice/script-failures-exhausted",
    task: "sandbox-agent",
    title: "Script failures exhausted notice",
    description: "Injected when script failures exhaust the retry budget.",
    text: `Script execution has failed repeatedly.
Use update_plan with a revised strategy before attempting more commands or scripts.`,
  },
  {
    id: "sandbox/notice/operator-continuation",
    task: "sandbox-agent",
    title: "Operator continuation notice",
    description: "Injected when an operator asks the sandbox agent to continue without guidance.",
    text: "Operator requested continuation. Keep moving and prioritise finishing with clear validation.",
  },
  {
    id: "sandbox/notice/operator-guidance",
    task: "sandbox-agent",
    title: "Operator guidance notice",
    description: "Injected when an operator sends continuation guidance.",
    text: "Operator requested continuation with guidance: {{content}}",
    variables: [{ name: "content", description: "Operator guidance text." }],
  },
  {
    id: "sandbox/notice/operator-message",
    task: "sandbox-agent",
    title: "Operator message notice",
    description: "Injected when an operator sends a message to the sandbox agent.",
    text: "Operator message: {{content}}",
    variables: [{ name: "content", description: "Operator message text." }],
  },
  {
    id: "sandbox/notice/recovery-mode",
    task: "sandbox-agent",
    title: "Recovery mode notice",
    description: "Injected when the sandbox agent enters plan recovery.",
    text: `Execution has entered recovery mode.
First action must be update_plan with a corrected, safer command strategy.
Recovery reason: {{recoveryReason}}`,
    variables: [{ name: "recoveryReason", description: "Reason recovery mode started." }],
  },
  {
    id: "sandbox/observation/script",
    task: "sandbox-agent",
    title: "Sandbox script observation",
    description: "Observation returned after a script runs successfully.",
    text: `Script executed successfully.
Output:
\`\`\`
{{output}}
\`\`\``,
    variables: [{ name: "output", description: "Truncated script output." }],
  },
] as const satisfies readonly PromptEntry[];

# Project Log

## 2025-12-18
- Created the project log file and recorded the initial snapshot for this repo.

## 2026-01-01
- Updated API/unit tests to use class-based constructor mocks for Vitest 4 compatibility across guardrails, repositories, chat orchestration/validation, and app services.
- Adjusted drawing, uploads, and logger middleware tests for constructor-safe globals and better context setup.
- Fixed articles/shared/models test scaffolding for AppDataRepository/KVCache and re-ran full test suite.

## 2026-01-03
- Added `call_api` tool to execute REST/GraphQL requests with validation, timeouts, and structured responses.
- Wired the new tool into available functions and JSON response rendering.
- Added Vitest coverage for REST and GraphQL request behavior.
- Added workflow meta-tools (`compose_functions`, `if_then_else`, `parallel_execute`) with shared step execution, argument references, and error handling.
- Implemented workflow-specific response templates/icons and added tests for workflow execution and display formatting.
- Added JSON string parsing for workflow step arrays and covered it with tests.
- Added JSON string parsing for if-then-else condition objects with tests.
- Added media provider capability scaffolding and provider registrations for image, music, video, and speech, plus service refactors and provider tests.
- Updated media function definitions with provider/model selection, and added an output-modality models endpoint.

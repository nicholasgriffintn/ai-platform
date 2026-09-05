# Verify project delivery policies

- **Change:** Project coding environments now store an explicit delivery policy and require exact approval before a GitHub write.
- **Surfaces:** Work project settings, sandbox execution, run Activity and Proof.
- **Prerequisites:** A project with an authorised GitHub App repository and a runner able to start coding work. Use a disposable non-default, non-protected branch for direct-delivery checks.
- **Risk if wrong:** A legacy preference could become more permissive, a stale installation could write to the wrong repository, or a partial GitHub failure could be hidden.
- **Commits:** None recorded.

## Verify

- [ ] Open an existing environment that previously disabled commits and confirm it resolves to **Leave changes uncommitted**. Open one that enabled commits and confirm it resolves to a review branch without silently enabling pull requests.
- [ ] Configure a new repository and confirm **Prepare a branch or pull request** defaults to **Open a pull request**. Change each policy, save, reload and confirm the exact choice returns; remove the coding environment and confirm it remains removable.
- [ ] Complete a validated review run and confirm approval names the repository, action, branch, target, commit and validation result. Reject it and confirm no remote write occurs and Proof records incomplete delivery.
- [ ] Approve pull-request delivery and confirm Activity and Proof show the branch, commit and pull-request URL. Repeat terminal handling and confirm it does not create another pull request.
- [ ] Configure direct delivery to `main`, the default branch and a protected branch and confirm each fails closed. Change branch protection after the run begins and confirm the write-boundary recheck still blocks delivery.
- [ ] Revoke the runner's installation or remove the repository from it before dispatch and confirm the run cannot receive a token. Confirm another project member cannot supply or inherit that authority.
- [ ] Fail the quality gate and confirm no commit or remote write occurs. Simulate a successful push followed by a failed pull-request request and confirm the run fails while retaining branch and commit evidence.
- [ ] Enter custom delivery instructions and confirm they affect local preparation but cannot invoke a commit, push or pull request.

**Stop and report if:** a remote write occurs without the exact approval, delivery targets the default or a protected branch, legacy configuration becomes more permissive, repository authority is not rechecked, or partial delivery evidence disappears.

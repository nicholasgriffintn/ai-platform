# ADR 0070: Run the model platform on workspace accounts

Status: Accepted. Supersedes ADR 0066 for uploaded weights and extends ADR 0069 to every provider.

## Problem

Work › Models could vet Hub models, fine-tune on Hugging Face Jobs and deploy dedicated endpoints, but little else. Teams also need their own data and weights, other trainers and hosts, spend limits and a way to stop a bad model everywhere at once. A separate training Worker holding platform credentials made every workspace train under the operator's account, and each new provider meant new service plumbing.

## Decision

Workspaces bring their own provider accounts. Each provider is an `ai-model-providers` adapter with a manifest of trainers and hosts, their hardware, regions and jurisdictions, and the API calls it directly; the training Worker is removed. Canonical training and deployment specs are hashed and stored with every run and deployment, so what ran can always be read back.

Uploads land in private R2 and are hashed before use. When Hugging Face is connected they are published to a private repository in the workspace's namespace, so trainers and hosts read them like any Hub model. Pickle formats are refused. Datasets are versioned by a hash chain over their processed rows and carry licence, lawful basis and personal data declarations that policy checks.

Clients call aliases, not deployments. Promotion runs the alias's eval gate first, can start a canary, and needs an approver when the alias or separation of duties says so. Graders are shared by evals, reinforcement rewards and gates. Permissions are per action per role, budgets are checked before every start, and revocation walks lineage to stop every descendant.

## Consequences

Workspaces reconnect once, because pre-platform Hugging Face connections are cleared. Provider request shapes are only as good as each adapter's last live check, so adapters must be exercised against real accounts before being advertised. Idle pause and budget hard stops act within 15 minutes, not instantly. Weights never pass through Polychat compute, but uploads do pass through its storage until published.

# Connect a self-hosted agent gateway

Self-hosted agent gateways such as OpenClaw and Hermes Agent run as a daemon on a person's own machine or home server, own their sessions, memory and tool execution, and let the operator choose which model provider answers a turn. Polychat can be that provider today, without any desktop application and without a new endpoint.

## Polychat as the provider

Point the gateway at `POST /chat/completions` with a personal API key in `Authorization: Bearer`. Keys are created, listed and revoked under `/user/api-keys`, and the middleware accepts them wherever a session would be accepted, so a gateway never needs a browser session or a password.

Issue one key per gateway rather than reusing a personal key, and name it after the machine it runs on. That name is the only thing distinguishing the traffic later, and revoking it is how a lost or retired machine is cut off.

Usage from a gateway is attributed to the account that owns the key and is spent against that account's plan. A gateway can run a long autonomous loop without a person watching it, so agree a budget before handing one a key.

## Polychat as a surface

The desktop application can also work the other way round: add a gateway as an agent runtime and it lists that gateway's sessions, resumes one by sending it a prompt, and shows the permission requests it raises. Nothing consequential runs until someone presses allow, and there is no standing approval to grant.

A gateway on a network address needs HTTPS or a stored pairing secret before the desktop application will reach it, because a connection to one is authority to execute code on the machine hosting it. Loopback is exempt from that rule and remains the default.

Exposing Polychat to a gateway as an MCP server is still only a design. See [ADR 0077](../architecture/decisions/0077-separate-model-runtimes-from-agent-runtimes.md).

## Before building against a gateway

Both projects are young and neither publishes a stable third-party client protocol. Hermes documents its CLI and its MCP configuration; OpenClaw documents a local control interface and a distinction between clients and nodes. Pin a version, probe what an endpoint reports when connecting, and degrade to read-only when it answers with something unrecognised.

Treat a gateway connection as authority to execute code on the machine hosting it. Its credential belongs in the operating system keychain, never in a window or a database, and every consequential action it proposes needs explicit approval.

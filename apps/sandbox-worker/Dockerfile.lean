FROM docker.io/cloudflare/sandbox:0.12.7@sha256:6d741713aef266e8ae0831a5709c6f2d7b77b4952ac79b549f4f4e380af86fbe

ARG UV_VERSION=0.12.7
ARG ELAN_VERSION=4.2.4
ARG PYTHON_VERSION=3.13.7

ENV COMMAND_TIMEOUT_MS=600000 \
    UV_PYTHON=${PYTHON_VERSION} \
    UV_TOOL_DIR=/opt/uv-tools \
    UV_TOOL_BIN_DIR=/usr/local/bin \
    ELAN_HOME=/opt/elan \
    PATH=/opt/elan/bin:/root/.local/bin:${PATH}

COPY container/lean-lsp-mcp.requirements.txt /tmp/lean-lsp-mcp.requirements.txt

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl git tar \
    && rm -rf /var/lib/apt/lists/* \
    && curl -fsSL "https://github.com/astral-sh/uv/releases/download/${UV_VERSION}/uv-installer.sh" -o /tmp/uv-installer.sh \
    && echo "92e8554321e2bde08c9b1445dae47a65360f885274f31df51cdc2f9faa84e001  /tmp/uv-installer.sh" | sha256sum -c - \
    && sh /tmp/uv-installer.sh \
    && rm /tmp/uv-installer.sh \
    && uv python install "${PYTHON_VERSION}" \
    && curl -fsSL "https://github.com/leanprover/elan/releases/download/v${ELAN_VERSION}/elan-x86_64-unknown-linux-gnu.tar.gz" -o /tmp/elan.tar.gz \
    && echo "42b94d4244e8353142c456ec0e4ca6528fd898a6c604d4059f494e706e431f63  /tmp/elan.tar.gz" | sha256sum -c - \
    && tar -xzf /tmp/elan.tar.gz -C /tmp \
    && mkdir -p "${ELAN_HOME}/bin" \
    && mv /tmp/elan-init "${ELAN_HOME}/bin/elan-init" \
    && "${ELAN_HOME}/bin/elan-init" -y --default-toolchain none --no-modify-path \
    && rm /tmp/elan.tar.gz \
    && uv venv --python "${PYTHON_VERSION}" "/opt/uv-tools/lean-lsp-mcp" \
    && uv pip install --python "/opt/uv-tools/lean-lsp-mcp/bin/python" --require-hashes -r /tmp/lean-lsp-mcp.requirements.txt \
    && ln -s "/opt/uv-tools/lean-lsp-mcp/bin/lean-lsp-mcp" /usr/local/bin/lean-lsp-mcp \
    && rm /tmp/lean-lsp-mcp.requirements.txt

COPY container/lean-lsp-advisory.py /usr/local/bin/polychat-lean-lsp-advisory
RUN chmod 0555 /usr/local/bin/polychat-lean-lsp-advisory

# The MCP server is available for advisory diagnostics, but compiler and kernel
# checks remain the correctness authority. Local Loogle and REPL modes are not
# started because they exceed the container's predictable memory envelope.
EXPOSE 3000

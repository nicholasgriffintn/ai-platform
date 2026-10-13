FROM docker.io/cloudflare/sandbox:1.0.0 AS sandbox

FROM docker.io/library/node:24-trixie-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    build-essential ca-certificates coreutils curl git inotify-tools jq procps \
    python3 python3-pip python3-venv unzip wget \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable

COPY --from=sandbox /usr/local/bin/sandbox-shim /usr/local/bin/sandbox-shim
COPY --from=ghcr.io/astral-sh/uv:0.12.10 /uv /uvx /usr/local/bin/

ENV NODE_EXTRA_CA_CERTS=/etc/cloudflare/certs/cloudflare-containers-ca.crt
ENV REQUESTS_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt

WORKDIR /workspace

CMD ["sleep", "infinity"]

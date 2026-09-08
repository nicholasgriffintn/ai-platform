FROM docker:28-dind AS docker
FROM mcr.microsoft.com/playwright:v1.62.1-noble

COPY --from=docker /usr/local/bin/docker /usr/local/bin/docker
RUN apt-get update && apt-get install -y --no-install-recommends build-essential python3 git && rm -rf /var/lib/apt/lists/*
RUN npm install --global pnpm@12.3.4
WORKDIR /workspace

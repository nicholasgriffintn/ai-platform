FROM polychat-e2e-sandbox-base:0.12.9

ARG GIT_AUTHOR_NAME
ARG GIT_AUTHOR_EMAIL
ARG GIT_COMMITTER_NAME
ARG GIT_COMMITTER_EMAIL

COPY patch-container-server.mjs /tmp/patch-container-server.mjs
RUN node /tmp/patch-container-server.mjs && rm /tmp/patch-container-server.mjs
ENTRYPOINT ["bun", "/container-server/dist/index.js"]

COPY repository /opt/polychat-e2e/repository
COPY environment-v2.json /opt/polychat-e2e/environment-v2.json
RUN git -C /opt/polychat-e2e/repository init --initial-branch=main \
    && git -C /opt/polychat-e2e/repository add . \
    && git -C /opt/polychat-e2e/repository \
      -c user.name="${GIT_COMMITTER_NAME:-${GIT_AUTHOR_NAME:-Polychat E2E}}" \
      -c user.email="${GIT_COMMITTER_EMAIL:-${GIT_AUTHOR_EMAIL:-e2e@polychat.test}}" \
      commit -m "test: initialise sandbox fixture" \
    && git clone --bare /opt/polychat-e2e/repository /opt/polychat-e2e/repository.git \
    && git --git-dir=/opt/polychat-e2e/repository.git update-ref refs/heads/release/e2e refs/heads/main \
    && cp /opt/polychat-e2e/environment-v2.json /opt/polychat-e2e/repository/.polychat/environment.json \
    && git -C /opt/polychat-e2e/repository add .polychat/environment.json \
    && git -C /opt/polychat-e2e/repository \
      -c user.name="${GIT_COMMITTER_NAME:-${GIT_AUTHOR_NAME:-Polychat E2E}}" \
      -c user.email="${GIT_COMMITTER_EMAIL:-${GIT_AUTHOR_EMAIL:-e2e@polychat.test}}" \
      commit -m "test: revise repository environment" \
    && git clone --bare /opt/polychat-e2e/repository /opt/polychat-e2e/repository-v2.git \
    && printf '%s' '{invalid' > /opt/polychat-e2e/repository/.polychat/environment.json \
    && git -C /opt/polychat-e2e/repository add .polychat/environment.json \
    && git -C /opt/polychat-e2e/repository \
      -c user.name="${GIT_COMMITTER_NAME:-${GIT_AUTHOR_NAME:-Polychat E2E}}" \
      -c user.email="${GIT_COMMITTER_EMAIL:-${GIT_AUTHOR_EMAIL:-e2e@polychat.test}}" \
      commit -m "test: add malformed repository environment" \
    && git clone --bare /opt/polychat-e2e/repository /opt/polychat-e2e/repository-malformed.git \
    && node -e "require('node:fs').writeFileSync('/opt/polychat-e2e/repository/.polychat/environment.json', ' '.repeat(110000) + '{}')" \
    && git -C /opt/polychat-e2e/repository add .polychat/environment.json \
    && git -C /opt/polychat-e2e/repository \
      -c user.name="${GIT_COMMITTER_NAME:-${GIT_AUTHOR_NAME:-Polychat E2E}}" \
      -c user.email="${GIT_COMMITTER_EMAIL:-${GIT_AUTHOR_EMAIL:-e2e@polychat.test}}" \
      commit -m "test: add oversized repository environment" \
    && git clone --bare /opt/polychat-e2e/repository /opt/polychat-e2e/repository-oversized.git \
    && git config --system url.file:///opt/polychat-e2e/repository.git.insteadOf https://github.com/nicholasgriffintn/polychat-e2e-fixture.git \
    && git config --system url.file:///opt/polychat-e2e/repository-v2.git.insteadOf https://github.com/nicholasgriffintn/polychat-e2e-fixture-v2.git \
    && git config --system url.file:///opt/polychat-e2e/repository-malformed.git.insteadOf https://github.com/nicholasgriffintn/polychat-e2e-fixture-malformed.git \
    && git config --system url.file:///opt/polychat-e2e/repository-oversized.git.insteadOf https://github.com/nicholasgriffintn/polychat-e2e-fixture-oversized.git
RUN git config --system --add url.file:///opt/polychat-e2e/repository.git.insteadOf https://github.com/nicholasgriffintn/polychat-e2e-delivery.git \
    && git config --system --add url.file:///opt/polychat-e2e/repository.git.insteadOf https://github.com/nicholasgriffintn/polychat-e2e-delivery-pr-failure.git \
    && git config --system --add url.file:///opt/polychat-e2e/repository.git.insteadOf https://github.com/nicholasgriffintn/polychat-e2e-delivery-default-branch.git \
    && git config --system --add url.file:///opt/polychat-e2e/repository.git.insteadOf https://github.com/nicholasgriffintn/polychat-e2e-delivery-protected.git \
    && git config --system --add url.file:///opt/polychat-e2e/repository.git.insteadOf https://github.com/nicholasgriffintn/polychat-e2e-delivery-protection-change.git

ENV COMMAND_TIMEOUT_MS=600000
EXPOSE 4000

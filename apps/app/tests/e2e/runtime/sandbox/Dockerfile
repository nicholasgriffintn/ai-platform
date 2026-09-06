FROM polychat-e2e-sandbox-base:0.12.9

ARG GIT_AUTHOR_NAME
ARG GIT_AUTHOR_EMAIL
ARG GIT_COMMITTER_NAME
ARG GIT_COMMITTER_EMAIL

COPY repository /opt/polychat-e2e/repository
RUN git -C /opt/polychat-e2e/repository init --initial-branch=main \
    && git -C /opt/polychat-e2e/repository add . \
    && git -C /opt/polychat-e2e/repository \
      -c user.name="${GIT_COMMITTER_NAME:-${GIT_AUTHOR_NAME:-Polychat E2E}}" \
      -c user.email="${GIT_COMMITTER_EMAIL:-${GIT_AUTHOR_EMAIL:-e2e@polychat.test}}" \
      commit -m "test: initialise sandbox fixture" \
    && git clone --bare /opt/polychat-e2e/repository /opt/polychat-e2e/repository.git \
    && git config --system url.file:///opt/polychat-e2e/repository.git.insteadOf https://github.com/nicholasgriffintn/polychat-e2e-fixture.git

ENV COMMAND_TIMEOUT_MS=600000
EXPOSE 4000

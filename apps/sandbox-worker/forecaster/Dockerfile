FROM docker.io/library/python:3.12-slim-trixie

ARG TIMESTRAL_COMMIT=a534bdbd244d64f3d9d743f46c7bf6fc330ed4ff
ARG TIMESTRAL_WEIGHTS_REVISION=9874d252ab0aae16f7f7c999f98f98d6ad7d8365

ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN pip install --index-url https://download.pytorch.org/whl/cpu torch==2.14.1 \
    && pip install numpy==2.5.4 safetensors==0.8.0 huggingface-hub==2.2.0 \
    && pip install --no-deps "https://codeload.github.com/mistralai/timestral/tar.gz/${TIMESTRAL_COMMIT}"

RUN python -c "from huggingface_hub import snapshot_download; snapshot_download('mistralai/Timestral-209M', revision='${TIMESTRAL_WEIGHTS_REVISION}', local_dir='/models/timestral-209m', allow_patterns=['config.json', 'model.safetensors', 'LICENSE'])"

COPY server.py /app/server.py

ENV HF_HUB_OFFLINE=1 \
    TIMESTRAL_MODEL_NAME=timestral-209m \
    TIMESTRAL_MODEL_PATH=/models/timestral-209m \
    PORT=8080

EXPOSE 8080

CMD ["python", "/app/server.py"]

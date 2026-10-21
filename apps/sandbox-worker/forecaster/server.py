import json
import math
import os
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import numpy as np
import torch
from timestral import TimestralForecaster

MODEL_NAME = os.environ.get("TIMESTRAL_MODEL_NAME", "timestral-209m")
MODEL_PATH = os.environ.get("TIMESTRAL_MODEL_PATH", "/models/timestral-209m")
PORT = int(os.environ.get("PORT", "8080"))
MAX_BODY_BYTES = 16 * 1024 * 1024


class ForecastInputError(ValueError):
    pass


def as_matrix(rows, length, label):
    if not rows:
        return None

    if any(len(row) != length for row in rows):
        raise ForecastInputError(f"{label} must have {length} values per row")

    matrix = np.array(
        [[math.nan if value is None else float(value) for value in row] for row in rows],
        dtype=np.float32,
    )

    return matrix[None]


def run_forecast(forecaster, lock, body):
    targets = body.get("targets") or []
    horizon = int(body.get("horizon", 0))
    levels = [float(level) for level in body.get("quantiles") or [0.5]]

    if not targets or horizon < 1:
        raise ForecastInputError("A forecast needs at least one target and a positive horizon")

    length = len(targets[0])
    known_levels = forecaster.quantile_levels
    missing = [level for level in levels if level not in known_levels]

    if missing:
        raise ForecastInputError(f"Unsupported quantile levels: {missing}")

    context = as_matrix(targets, length, "targets")
    past = as_matrix(body.get("pastCovariates"), length, "pastCovariates")
    known = as_matrix(body.get("knownCovariates"), length + horizon, "knownCovariates")
    started = time.perf_counter()

    with lock:
        forecast = forecaster.forecast(
            context,
            prediction_length=horizon,
            past_covariates=past,
            known_covariates=known,
        )

    quantiles = forecast.quantiles[0].float().cpu().numpy()
    indexes = [known_levels.index(level) for level in levels]

    if not np.isfinite(quantiles).all():
        raise ForecastInputError("The forecast came back with non-finite values")

    return {
        "model": MODEL_NAME,
        "quantiles": levels,
        "values": [
            [quantiles[variate, :, index].tolist() for index in indexes]
            for variate in range(quantiles.shape[0])
        ],
        "elapsedMs": round((time.perf_counter() - started) * 1000, 3),
    }


def build_handler(forecaster, lock):
    class ForecastHandler(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"

        def log_message(self, format, *args):
            return

        def respond(self, status, payload):
            encoded = json.dumps(payload).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(encoded)))
            self.end_headers()
            self.wfile.write(encoded)

        def do_GET(self):
            if self.path == "/health":
                self.respond(200, {"status": "ready", "model": MODEL_NAME})
            else:
                self.respond(404, {"error": "Not found"})

        def do_POST(self):
            if self.path != "/forecast":
                self.respond(404, {"error": "Not found"})
                return

            length = int(self.headers.get("Content-Length") or 0)

            if length <= 0 or length > MAX_BODY_BYTES:
                self.respond(413, {"error": "Request body is empty or too large"})
                return

            try:
                body = json.loads(self.rfile.read(length))
                self.respond(200, run_forecast(forecaster, lock, body))
            except (ForecastInputError, AssertionError, json.JSONDecodeError) as error:
                self.respond(400, {"error": str(error)})
            except ValueError as error:
                self.respond(422, {"error": str(error)})
            except Exception:
                self.respond(500, {"error": "Forecast failed"})

    return ForecastHandler


def main():
    torch.set_num_threads(max(1, os.cpu_count() or 1))
    forecaster = TimestralForecaster.from_pretrained(MODEL_PATH, device="cpu", local_files_only=True)
    server = ThreadingHTTPServer(("0.0.0.0", PORT), build_handler(forecaster, threading.Lock()))
    server.serve_forever()


if __name__ == "__main__":
    main()

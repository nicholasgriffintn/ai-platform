import importlib.util
import json
import pathlib
import socket
import threading
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from cdp import CdpConnection

spec = importlib.util.spec_from_file_location("verify_site", pathlib.Path(__file__).resolve().parents[1] / "verify-site.py")
verification = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verification)


class Browser:
    def __init__(self, events=None):
        self.events = events or []
        self.sent = []
        self.on_event = None
        self.closed = False

    def command(self, method, params=None):
        if method == "Page.getFrameTree":
            return {"frameTree": {"frame": {"id": "frame"}}}
        if method == "Runtime.evaluate":
            expression = params["expression"]
            if "filter(key" in expression:
                return {"result": {"value": []}}
            return {"result": {"value": "site-root" in expression}}
        return {}

    def notify(self, method, params):
        self.sent.append((method, params))

    def pump(self, timeout):
        for event in self.events:
            self.on_event(event)
        self.events = []

    def close(self):
        self.closed = True


class SiteVerificationTests(unittest.TestCase):
    def capture(self, browser):
        ticks = iter([0, 1, 2, 3, 4])
        with patch.object(verification, "CdpConnection", return_value=browser), patch.object(verification, "page_target", return_value={"webSocketDebuggerUrl": "ws://localhost:9222/page"}), patch.object(verification.time, "monotonic", side_effect=lambda: next(ticks, 100)):
            return verification.capture({"allowedOrigins": ["https://app.example"], "viewport": "mobile", "document": "<html/>", "elementKeys": ["page"], "interactions": []})

    def test_reports_console_and_failed_requests_and_closes_browser(self):
        browser = Browser([
            {"method": "Runtime.consoleAPICalled", "params": {"type": "error", "args": [{"value": "Broken"}]}},
            {"method": "Network.responseReceived", "params": {"type": "Script", "response": {"status": 404, "url": "https://app.example/runtime.js?token=private"}}},
        ])
        result = self.capture(browser)
        self.assertEqual(result["status"], "failed")
        self.assertEqual({item["kind"] for item in result["diagnostics"]}, {"console", "request_failure"})
        self.assertNotIn("private", json.dumps(result))
        self.assertTrue(browser.closed)

    def test_blocks_foreign_origins_and_url_credentials(self):
        browser = Browser([
            {"method": "Fetch.requestPaused", "params": {"requestId": str(index), "request": {"url": url}}}
            for index, url in enumerate(["https://app.example/runtime.js", "http://127.0.0.1/secret", "https://foreign.example/", "https://user:password@app.example/"])
        ])
        self.capture(browser)
        self.assertEqual([method for method, _ in browser.sent], ["Fetch.continueRequest", "Fetch.failRequest", "Fetch.failRequest", "Fetch.failRequest"])

    def test_cdp_waits_without_consuming_partial_messages(self):
        client, server = socket.socketpair()
        connection = CdpConnection.__new__(CdpConnection)
        connection.socket = client
        connection.waiting = {1}
        connection.responses = {}
        connection.on_event = lambda message: None
        try:
            connection.pump(0.001)
            body = json.dumps({"id": 1, "result": {"ready": True}}).encode()
            frame = bytes([0x81, len(body)]) + body
            server.sendall(frame[:1])
            timer = threading.Timer(0.05, lambda: server.sendall(frame[1:]))
            timer.start()
            connection.pump(0.005)
            timer.join()
            self.assertTrue(connection.responses[1]["result"]["ready"])
        finally:
            connection.close()
            server.close()

    def test_rejects_nonlocal_browser_debugger(self):
        with self.assertRaisesRegex(RuntimeError, "destination"):
            CdpConnection("ws://foreign.example:9222/page")


if __name__ == "__main__":
    unittest.main()

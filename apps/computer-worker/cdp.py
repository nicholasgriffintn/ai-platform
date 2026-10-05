import base64
import hashlib
import json
import os
import select
import socket
import struct
import time
import urllib.parse
import urllib.request


def page_target():
    with urllib.request.urlopen("http://127.0.0.1:9222/json/list", timeout=8) as response:
        targets = json.loads(response.read(1_000_000).decode())

    for target in targets:
        if isinstance(target, dict) and target.get("type") == "page" and target.get("webSocketDebuggerUrl"):
            return target

    raise RuntimeError("Computer browser has no page")


class CdpConnection:
    def __init__(self, url):
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme != "ws" or parsed.hostname not in ("127.0.0.1", "localhost") or parsed.port != 9222:
            raise RuntimeError("Invalid browser debugger destination")
        self.socket = socket.create_connection((parsed.hostname, parsed.port), timeout=8)
        self.next_id = 0
        self.responses = {}
        self.waiting = set()
        self.on_event = lambda message: None
        key = base64.b64encode(os.urandom(16)).decode()
        self.socket.sendall((
            f"GET {parsed.path} HTTP/1.1\r\nHost: {parsed.hostname}:{parsed.port}\r\n"
            f"Upgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: {key}\r\n"
            "Sec-WebSocket-Version: 13\r\n\r\n"
        ).encode())
        headers = bytearray()
        while not headers.endswith(b"\r\n\r\n"):
            if len(headers) > 16000:
                raise RuntimeError("Invalid debugger handshake")
            headers += self._read(1)
        accept = base64.b64encode(hashlib.sha1((key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").encode()).digest()).decode()
        if not headers.startswith(b"HTTP/1.1 101") or accept.encode() not in headers:
            self.close()
            raise RuntimeError("Debugger rejected the connection")

    def close(self):
        self.socket.close()

    def _read(self, size):
        data = bytearray()
        while len(data) < size:
            part = self.socket.recv(size - len(data))
            if not part:
                raise RuntimeError("Debugger closed the connection")
            data += part
        return bytes(data)

    def _send(self, opcode, payload):
        mask = os.urandom(4)
        header = bytearray([0x80 | opcode])
        size = len(payload)
        if size < 126:
            header.append(0x80 | size)
        elif size < 65536:
            header.append(0x80 | 126)
            header += struct.pack(">H", size)
        else:
            header.append(0x80 | 127)
            header += struct.pack(">Q", size)
        masked = bytes(byte ^ mask[index % 4] for index, byte in enumerate(payload))
        self.socket.sendall(bytes(header) + mask + masked)

    def _message(self):
        data = bytearray()
        while True:
            first, second = self._read(2)
            size = second & 0x7F
            if size == 126:
                size = struct.unpack(">H", self._read(2))[0]
            elif size == 127:
                size = struct.unpack(">Q", self._read(8))[0]
            if size + len(data) > 2_000_000 or second & 0x80:
                raise RuntimeError("Invalid debugger message")
            payload = self._read(size)
            opcode = first & 0x0F
            if opcode == 8:
                raise RuntimeError("Debugger closed the connection")
            if opcode == 9:
                self._send(10, payload)
                continue
            if opcode in (0, 1):
                data += payload
                if first & 0x80:
                    return json.loads(data.decode())

    def notify(self, method, params=None):
        self.next_id += 1
        self._send(1, json.dumps({"id": self.next_id, "method": method, "params": params or {}}).encode())
        return self.next_id

    def pump(self, timeout=1):
        if not select.select([self.socket], [], [], timeout)[0]:
            return
        self.socket.settimeout(8)
        message = self._message()
        if message.get("id") in self.waiting:
            self.responses[message["id"]] = message
        elif message.get("method"):
            self.on_event(message)

    def command(self, method, params=None, timeout=20):
        request_id = self.notify(method, params)
        self.waiting.add(request_id)
        deadline = time.monotonic() + timeout
        try:
            while request_id not in self.responses:
                if time.monotonic() >= deadline:
                    raise RuntimeError(f"Debugger timed out: {method}")
                self.pump(min(1, deadline - time.monotonic()))
            message = self.responses.pop(request_id)
            if message.get("error"):
                raise RuntimeError(f"Debugger command failed: {method}")
            return message.get("result", {})
        finally:
            self.waiting.discard(request_id)

    def call_function(self, object_id, declaration, *arguments):
        result = self.command("Runtime.callFunctionOn", {
            "objectId": object_id,
            "functionDeclaration": declaration,
            "arguments": [{"value": value} for value in arguments],
            "returnByValue": True,
        })
        return result.get("result", {}).get("value")


def evaluate_expression(ws_url, expression):
    connection = CdpConnection(ws_url)
    try:
        result = connection.command("Runtime.evaluate", {"expression": expression, "returnByValue": True})
        return result.get("result", {}).get("value", "")
    finally:
        connection.close()

#!/usr/bin/env python3
"""Print the visible text of the current Chromium tab as JSON. Standard library only."""

import base64
import json
import os
import socket
import struct
import sys
import urllib.parse
import urllib.request

BASE = "http://127.0.0.1:9222"
TEXT_LIMIT = 8000
EXPRESSION = "document.body ? document.body.innerText : ''"


def page_target():
    with urllib.request.urlopen(BASE + "/json/list", timeout=8) as response:
        targets = json.loads(response.read().decode())

    for target in targets:
        if (
            isinstance(target, dict)
            and target.get("type") == "page"
            and target.get("webSocketDebuggerUrl")
        ):
            return target

    raise RuntimeError("Computer browser has no page to read")


def read_exact(sock, size):
    chunks = bytearray()

    while len(chunks) < size:
        chunk = sock.recv(size - len(chunks))

        if not chunk:
            raise RuntimeError("Computer browser closed the connection")

        chunks += chunk

    return bytes(chunks)


def send_frame(sock, payload):
    mask = os.urandom(4)
    header = bytearray([0x81])
    length = len(payload)

    if length < 126:
        header.append(0x80 | length)
    elif length < 65536:
        header.append(0x80 | 126)
        header += struct.pack(">H", length)
    else:
        header.append(0x80 | 127)
        header += struct.pack(">Q", length)

    masked = bytes(byte ^ mask[index % 4] for index, byte in enumerate(payload))

    sock.sendall(bytes(header) + mask + masked)


def recv_message(sock):
    message = bytearray()

    while True:
        first, second = read_exact(sock, 2)
        opcode = first & 0x0F
        length = second & 0x7F

        if length == 126:
            length = struct.unpack(">H", read_exact(sock, 2))[0]
        elif length == 127:
            length = struct.unpack(">Q", read_exact(sock, 8))[0]

        if second & 0x80:
            read_exact(sock, 4)

        payload = read_exact(sock, length)

        if opcode == 0x1:
            return payload.decode()
        if opcode == 0x8:
            raise RuntimeError("Computer browser closed the connection")


def evaluate(ws_url, request_id):
    parsed = urllib.parse.urlparse(ws_url)
    sock = socket.create_connection((parsed.hostname, parsed.port or 80), timeout=8)

    key = base64.b64encode(os.urandom(16)).decode()
    handshake = (
        f"GET {parsed.path or '/'} HTTP/1.1\r\n"
        f"Host: {parsed.hostname}:{parsed.port or 80}\r\n"
        "Upgrade: websocket\r\n"
        "Connection: Upgrade\r\n"
        f"Sec-WebSocket-Key: {key}\r\n"
        "Sec-WebSocket-Version: 13\r\n\r\n"
    )
    sock.sendall(handshake.encode())
    read_exact(sock, 1)
    headers = bytearray()

    while not headers.endswith(b"\r\n\r\n"):
        headers += read_exact(sock, 1)

    payload = json.dumps(
        {
            "id": request_id,
            "method": "Runtime.evaluate",
            "params": {"expression": EXPRESSION, "returnByValue": True},
        }
    ).encode()

    send_frame(sock, payload)

    while True:
        message = json.loads(recv_message(sock))

        if message.get("id") == request_id:
            sock.close()

            return message.get("result", {}).get("result", {}).get("value", "")


def main():
    target = page_target()
    text = evaluate(target["webSocketDebuggerUrl"], 1)
    normalised = " ".join(str(text).split())[:TEXT_LIMIT]

    print(json.dumps({"title": str(target.get("title", "")).strip(), "text": normalised}))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(json.dumps({"error": str(error)}))
        sys.exit(1)

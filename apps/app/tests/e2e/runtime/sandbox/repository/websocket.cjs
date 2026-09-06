const { createHash } = require("node:crypto");

const WEBSOCKET_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

function decodeTextFrame(frame) {
  const opcode = frame[0] & 0x0f;

  if (opcode === 8) {
    return null;
  }

  const masked = (frame[1] & 0x80) !== 0;
  const length = frame[1] & 0x7f;

  if (!masked || length >= 126 || frame.length < 6 + length) {
    return null;
  }

  const mask = frame.subarray(2, 6);
  const payload = Buffer.from(frame.subarray(6, 6 + length));

  for (let index = 0; index < payload.length; index += 1) {
    payload[index] ^= mask[index % 4];
  }

  return payload.toString("utf8");
}

function encodeTextFrame(text) {
  const payload = Buffer.from(text);

  return Buffer.concat([Buffer.from([0x81, payload.length]), payload]);
}

function attachWebSocketEcho(server) {
  server.on("upgrade", (request, socket) => {
    const key = request.headers["sec-websocket-key"];

    if (request.url !== "/socket" || typeof key !== "string") {
      socket.destroy();

      return;
    }

    const accept = createHash("sha1").update(`${key}${WEBSOCKET_GUID}`).digest("base64");

    socket.write(
      `HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`,
    );
    socket.on("data", (frame) => {
      const text = decodeTextFrame(frame);

      if (text !== null) {
        socket.write(encodeTextFrame(text));
      }
    });
  });
}

module.exports = { attachWebSocketEcho };

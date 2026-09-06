const http = require("node:http");
const { attachWebSocketEcho } = require("./websocket.cjs");

const server = http.createServer((request, response) => {
  if (request.url === "/external-redirect") {
    response.writeHead(302, { location: "https://external-preview.invalid/private" });
    response.end();

    return;
  }

  if (request.url === "/local-redirect") {
    response.writeHead(302, { location: "http://127.0.0.1:4000/" });
    response.end();

    return;
  }

  if (request.url === "/undeclared-port-redirect") {
    response.writeHead(302, { location: "http://127.0.0.1:5000/private" });
    response.end();

    return;
  }

  response.writeHead(200, {
    "content-type": "text/html",
    ...(request.url === "/private-headers"
      ? {
          server: "sandbox-fixture",
          "set-cookie": "sandbox_private=secret; Path=/",
          "x-powered-by": "sandbox-fixture",
        }
      : {}),
  });
  response.end("<!doctype html><title>Sandbox fixture</title><h1>Sandbox service ready</h1>");
});

attachWebSocketEcho(server);
server.listen(4000, "0.0.0.0");

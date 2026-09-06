const http = require("node:http");

http
  .createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/html" });
    response.end("<!doctype html><title>Sandbox fixture</title><h1>Sandbox service ready</h1>");
  })
  .listen(4000, "0.0.0.0");

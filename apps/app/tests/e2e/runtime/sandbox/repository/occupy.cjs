const http = require("node:http");

for (const port of [4000, 4001]) {
  http.createServer((_request, response) => response.end("occupied")).listen(port, "0.0.0.0");
}

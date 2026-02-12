const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { URL } = require("node:url");

const port = Number(process.env.PORT || 8080);
const rootCandidates = ["dist", "public"];

const webRoot =
  rootCandidates
    .map((dir) => path.resolve(process.cwd(), dir))
    .find((dir) => fs.existsSync(dir) && fs.statSync(dir).isDirectory()) ||
  null;

if (!webRoot) {
  console.warn(
    "No static web directory found. Server will still start for health checks."
  );
}

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const indexFile = webRoot ? path.join(webRoot, "index.html") : null;

function sendFile(filePath, res) {
  if (!(fs.existsSync(filePath) && fs.statSync(filePath).isFile())) {
    return false;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || "application/octet-stream";
  res.writeHead(200, { "Content-Type": contentType });
  fs.createReadStream(filePath).pipe(res);
  return true;
}

const server = http.createServer((req, res) => {
  if (!req.url) {
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Bad Request");
    return;
  }

  const requestPath = new URL(req.url, "http://localhost").pathname;
  if (requestPath === "/healthz" || requestPath === "/readyz") {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("ok");
    return;
  }

  if (!(webRoot && indexFile)) {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Maak Health web runtime started");
    return;
  }

  const safePath = path
    .normalize(decodeURIComponent(requestPath))
    .replace(/^(\.\.[/\\])+/, "");
  const absolutePath = path.join(webRoot, safePath);

  if (absolutePath.startsWith(webRoot) && sendFile(absolutePath, res)) {
    return;
  }

  if (
    absolutePath.startsWith(webRoot) &&
    sendFile(`${absolutePath}.html`, res)
  ) {
    return;
  }

  if (sendFile(indexFile, res)) {
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Not Found");
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Static server listening on 0.0.0.0:${port} (root: ${webRoot})`);
});

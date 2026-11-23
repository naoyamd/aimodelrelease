import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST_DIR = resolve(__dirname, "..", "dist");
const PORT = Number(process.env.PORT || 4173);

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

const server = createServer(async (req, res) => {
  try {
    const rawPath = (req.url || "/").split("?")[0];
    const cleanRel = decodeURIComponent(rawPath).replace(/^\/+/, "");
    let targetPath = resolve(DIST_DIR, cleanRel || "index.html");

    if (!targetPath.startsWith(DIST_DIR)) {
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Forbidden");
      return;
    }

    let fileInfo = await stat(targetPath).catch(() => null);
    if (fileInfo && fileInfo.isDirectory()) {
      targetPath = resolve(targetPath, "index.html");
      fileInfo = await stat(targetPath).catch(() => null);
    }

    if (!fileInfo) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    const content = await readFile(targetPath);
    const mime = MIME_TYPES[extname(targetPath)] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": mime, "Cache-Control": "no-cache" });
    res.end(content);
  } catch (err) {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(err instanceof Error ? err.message : "Internal error");
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[serve] Serving dist/ at http://127.0.0.1:${PORT}/`);
});

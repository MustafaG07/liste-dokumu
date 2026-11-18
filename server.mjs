import { createReadStream } from "node:fs";
import { access } from "node:fs/promises";
import http from "node:http";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { ReadError, readPlaylist } from "./lib/read.mjs";

const root = fileURLToPath(new URL("./dist/", import.meta.url));
const port = Number(process.env.PORT) || 4317;

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    if (req.method === "POST" && url.pathname === "/api/playlist") {
      await handleRead(req, res);
      return;
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      send(res, 405, { error: "Bu işlem yok." });
      return;
    }
    await handleFile(url.pathname, res);
  } catch {
    send(res, 500, { error: "Sunucu takıldı. Sayfayı yenile." });
  }
});

async function handleRead(req, res) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 4000) {
      send(res, 400, { error: "Bağlantı fazla uzun." });
      return;
    }
    chunks.push(chunk);
  }

  let body;
  try {
    body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    send(res, 400, { error: "İstek okunamadı." });
    return;
  }

  try {
    const playlist = await readPlaylist(body.url);
    send(res, 200, playlist);
  } catch (error) {
    const message = error instanceof ReadError ? error.message : "Liste okunamadı. Yeniden dene.";
    send(res, 422, { error: message });
  }
}

async function handleFile(pathname, res) {
  const requested = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  if (!requested || requested.split(/[/\\]/).includes("..")) {
    send(res, 404, { error: "Sayfa yok." });
    return;
  }
  const file = resolve(root, requested);
  const publicRoot = resolve(root);
  if (file !== publicRoot && !file.startsWith(publicRoot + sep)) {
    send(res, 404, { error: "Sayfa yok." });
    return;
  }
  try {
    await access(file);
  } catch {
    send(res, 404, { error: "Sayfa yok." });
    return;
  }
  const type = types[extname(file)] || "application/octet-stream";
  res.writeHead(200, {
    "content-type": type,
    "cache-control": "no-cache",
    "x-content-type-options": "nosniff",
  });
  createReadStream(file).pipe(res);
}

function send(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(body);
}

const host = "0.0.0.0";

server.listen(port, host, () => {
  console.log(`http://${host}:${port}`);
});

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./util.js";
/* Tiny static server. The viz fetches ./records.json, and fetch() is blocked on
   file:// — so open it through here, not by double-clicking the html. */
const PORT = process.env.PORT || 8080;
const MIME = { ".html": "text/html", ".json": "application/json", ".js": "text/javascript", ".css": "text/css" };
http.createServer((req, res) => {
  let f = decodeURIComponent(req.url.split("?")[0]);
  if (f === "/") f = "/wallet-answer-space.html";
  if (f === "/records.json") f = "/data/records.json";
  const p = path.join(ROOT, f);
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end("not found"); }
  res.writeHead(200, { "content-type": MIME[path.extname(p)] || "application/octet-stream", "cache-control": "no-store" });
  fs.createReadStream(p).pipe(res);
}).listen(PORT, () => console.log(`▸ http://localhost:${PORT}`));

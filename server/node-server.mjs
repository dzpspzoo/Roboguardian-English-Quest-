// Ten sam serwer AEGIS AI co server/worker.js, ale na własnym serwerze (Node.js 18+ albo Docker), bez Cloudflare.
// Uruchomienie:
//   ANTHROPIC_API_KEY=... GAME_TOKEN=... PORT=8787 node server/node-server.mjs
// Opcjonalnie: MODEL, BUDGET_USD (250), DAILY_USD (2), CHAT_PER_DAY (60), ALLOWED_ORIGIN (https://dzpspzoo.github.io),
//   DATA_FILE (plik z licznikami wydatków, domyślnie ./aegis-data.json).
// HTTPS zapewnia serwer przed nim (np. nginx, Caddy albo Traefik jako reverse proxy na ten port).
import http from 'node:http';
import fs from 'node:fs';
import worker from './worker.js';

const file = process.env.DATA_FILE || './aegis-data.json';
let data = {};
try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) {}
// Prosty magazyn klucz-wartość w pliku JSON (zastępuje Cloudflare KV).
const RG_KV = {
  async get(k) { const v = data[k]; if (!v) return null; if (v.exp && v.exp < Date.now()) { delete data[k]; return null; } return v.val; },
  async put(k, val, opt = {}) {
    data[k] = { val: String(val), exp: opt.expirationTtl ? Date.now() + opt.expirationTtl * 1000 : 0 };
    fs.writeFileSync(file + '.tmp', JSON.stringify(data)); fs.renameSync(file + '.tmp', file);
  },
};
const env = { ...process.env, RG_KV };
if (!env.ALLOWED_ORIGIN) env.ALLOWED_ORIGIN = 'https://dzpspzoo.github.io';

http.createServer(async (req, res) => {
  try {
    const chunks = []; let size = 0;
    for await (const c of req) { size += c.length; if (size > 100000) { res.writeHead(413).end(); return; } chunks.push(c); }
    const body = ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? undefined : Buffer.concat(chunks);
    const r = await worker.fetch(new Request(`http://localhost${req.url}`, { method: req.method, headers: req.headers, body }), env);
    res.writeHead(r.status, Object.fromEntries(r.headers));
    res.end(Buffer.from(await r.arrayBuffer()));
  } catch (e) {
    console.error(e); res.writeHead(500, { 'Content-Type': 'application/json' }).end('{"error":"server"}');
  }
}).listen(Number(process.env.PORT || 8787), () => console.log('AEGIS AI na porcie', process.env.PORT || 8787));

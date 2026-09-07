import { createServer } from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../dist/client/', import.meta.url));
const port = Number(process.env.PORT || process.env.KOMORI_PORT || 3000);
const host = process.env.STUDIO_HOST || '127.0.0.1';
if (!Number.isInteger(port) || port < 1 || port > 65535) { console.error('端口必须是 1–65535 的整数'); process.exit(1); }
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.woff2':'font/woff2', '.rsc':'text/x-component', '.glb':'model/gltf-binary', '.mp4':'video/mp4', '.webm':'video/webm', '.ogv':'video/ogg', '.vtt':'text/vtt' };
if (!existsSync(resolve(root, 'index.html'))) { console.error('请先运行 npm run build'); process.exit(1); }
const server = createServer(async (req, res) => {
  if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (path === '/healthz') { res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(req.method === 'HEAD' ? undefined : 'ok'); return; }
    if (path.split('/').some(part => part.startsWith('.'))) { res.writeHead(404); res.end(); return; }
    let file = resolve(root, '.' + path);
    if (file !== resolve(root) && !file.startsWith(resolve(root) + sep)) { res.writeHead(403); res.end(); return; }
    if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html');
    const info = await stat(file);
    if (!info.isFile()) throw new Error('Not a file');
    const headers = { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control':'no-cache', 'X-Content-Type-Options':'nosniff', 'Accept-Ranges':'bytes' };
    let start = 0, end = info.size - 1, status = 200;
    if (req.headers.range && req.method === 'GET') {
      const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      if (!range || (!range[1] && !range[2])) { res.writeHead(416, { ...headers, 'Content-Range': `bytes */${info.size}` }); res.end(); return; }
      start = range[1] ? Number(range[1]) : Math.max(0, info.size - Number(range[2]));
      end = range[1] && range[2] ? Math.min(Number(range[2]), info.size - 1) : info.size - 1;
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= info.size) { res.writeHead(416, { ...headers, 'Content-Range': `bytes */${info.size}` }); res.end(); return; }
      status = 206;
      headers['Content-Range'] = `bytes ${start}-${end}/${info.size}`;
    }
    headers['Content-Length'] = Math.max(0, end - start + 1);
    res.writeHead(status, headers);
    if (req.method === 'HEAD' || info.size === 0) res.end(); else createReadStream(file, {start, end}).on('error', () => res.destroy()).pipe(res);

  } catch { res.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'}); res.end('页面不存在'); }
});
server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? `端口 ${port} 已占用，可设置 KOMORI_PORT 使用其他端口。` : error.message); process.exit(1); });
server.listen(port, host, () => console.log(`SATORI 工作室：http://${host}:${port}/`));
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 10000).unref();
  });
}

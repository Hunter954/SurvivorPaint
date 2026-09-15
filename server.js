'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.resolve(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2'
};

function send(res, status, body, type, headers = {}) {
  res.writeHead(status, {
    'Content-Type': type,
    'Content-Length': Buffer.byteLength(body),
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
    'X-Frame-Options': 'SAMEORIGIN',
    ...headers
  });
  res.end(body);
}

function safeFilePath(pathname) {
  let decoded;
  try { decoded = decodeURIComponent(pathname); } catch { return null; }
  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const resolved = path.resolve(PUBLIC_DIR, relative);
  return resolved === PUBLIC_DIR || resolved.startsWith(`${PUBLIC_DIR}${path.sep}`) ? resolved : null;
}

const server = http.createServer((req, res) => {
  const method = req.method || 'GET';
  if (method !== 'GET' && method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return send(res, 405, 'Método não permitido', 'text/plain; charset=utf-8');
  }

  let pathname = '/';
  try { pathname = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`).pathname; } catch {}

  if (pathname === '/api/health') {
    const payload = JSON.stringify({ ok: true, game: 'Darlon Dutra: Missão Foz', version: '5.4.0' });
    if (method === 'HEAD') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(payload) });
      return res.end();
    }
    return send(res, 200, payload, 'application/json; charset=utf-8', { 'Cache-Control': 'no-store' });
  }

  const filePath = safeFilePath(pathname);
  if (!filePath) return send(res, 400, 'Caminho inválido', 'text/plain; charset=utf-8');

  fs.stat(filePath, (statError, stat) => {
    let target = filePath;
    if (!statError && stat.isDirectory()) target = path.join(filePath, 'index.html');

    fs.readFile(target, (error, data) => {
      if (error) {
        if (error.code === 'ENOENT' && !path.extname(pathname)) {
          return fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (fallbackError, html) => {
            if (fallbackError) return send(res, 404, 'Não encontrado', 'text/plain; charset=utf-8');
            res.writeHead(200, {
              'Content-Type': MIME_TYPES['.html'],
              'Content-Length': html.length,
              'Cache-Control': 'no-cache',
              'X-Content-Type-Options': 'nosniff',
              'Referrer-Policy': 'same-origin',
              'X-Frame-Options': 'SAMEORIGIN'
            });
            return method === 'HEAD' ? res.end() : res.end(html);
          });
        }
        return send(res, 404, 'Não encontrado', 'text/plain; charset=utf-8');
      }

      const extension = path.extname(target).toLowerCase();
      const noCache = extension === '.html' || extension === '.webmanifest' || path.basename(target) === 'sw.js';
      const cache = noCache ? 'no-cache' : 'public, max-age=3600';
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[extension] || 'application/octet-stream',
        'Content-Length': data.length,
        'Cache-Control': cache,
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'same-origin',
        'X-Frame-Options': 'SAMEORIGIN'
      });
      return method === 'HEAD' ? res.end() : res.end(data);
    });
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Missão Foz disponível na porta ${PORT}`);
});

function shutdown() {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

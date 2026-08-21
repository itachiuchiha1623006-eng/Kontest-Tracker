/**
 * Custom `app://` protocol so the renderer loads ES modules from a real
 * origin instead of file:// (avoids CORS ambiguity and gives CSP a
 * stable 'self').
 *
 *   app://bundle/...  -> src/renderer/...
 *   app://shared/...  -> src/shared/...
 *   app://assets/...  -> assets/...
 */

const { protocol } = require('electron');
const path = require('path');
const fs = require('fs');
const { APP_ROOT } = require('./util');

const HOSTS = {
  bundle: path.join(APP_ROOT, 'src', 'renderer'),
  shared: path.join(APP_ROOT, 'src', 'shared'),
  assets: path.join(APP_ROOT, 'assets'),
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

/** Called before app ready. */
function registerSchemes() {
  protocol.registerSchemesAsPrivileged([
    { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
  ]);
}

/** Called after app ready. */
function registerAppProtocol() {
  protocol.handle('app', (request) => {
    try {
      const url = new URL(request.url);
      const root = HOSTS[url.host];
      if (!root) return new Response('Unknown host', { status: 404 });

      let pathname = decodeURIComponent(url.pathname);
      if (pathname.endsWith('/')) pathname += 'index.html';

      // Resolve inside the app root and refuse anything escaping its host dir.
      const resolved = path.normalize(path.join(root, pathname));
      if (!resolved.startsWith(root + path.sep)) {
        return new Response('Forbidden', { status: 403 });
      }
      if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
        return new Response('Not found', { status: 404 });
      }
      const type = MIME[path.extname(resolved).toLowerCase()] || 'application/octet-stream';
      const body = fs.readFileSync(resolved);
      return new Response(body, { headers: { 'content-type': type } });
    } catch (err) {
      return new Response(`Protocol error: ${err.message}`, { status: 500 });
    }
  });
}

function entryUrl() {
  return 'app://bundle/index.html';
}

module.exports = { registerSchemes, registerAppProtocol, entryUrl };

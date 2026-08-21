/**
 * Custom `app://` protocol so the renderer loads ES modules from a real
 * origin instead of file:// (avoids CORS ambiguity and gives CSP a
 * stable 'self').
 *

*   app://bundle/index.html      -> src/renderer/index.html
 *   app://bundle/shared/x.js     -> src/shared/x.js   (same-origin ESM)
 *   app://bundle/assets/icon.png -> assets/icon.png
 */

const { protocol } = require('electron');
const path = require('path');
const fs = require('fs');
const { APP_ROOT } = require('./util');

const RENDERER_ROOT = path.join(APP_ROOT, 'src', 'renderer');
const SHARED_ROOT = path.join(APP_ROOT, 'src', 'shared');
const ASSETS_ROOT = path.join(APP_ROOT, 'assets');

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

function resolveBundlePath(pathname) {
  // Path-prefix routing keeps shared/assets same-origin with the app.
  if (pathname.startsWith('/shared/')) {
    return path.normalize(path.join(SHARED_ROOT, pathname.slice('/shared/'.length)));
  }
  if (pathname.startsWith('/assets/')) {
    return path.normalize(path.join(ASSETS_ROOT, pathname.slice('/assets/'.length)));
  }
  return path.normalize(path.join(RENDERER_ROOT, pathname));
}

/** Called after app ready. */
function registerAppProtocol() {
  protocol.handle('app', (request) => {
    try {
      const url = new URL(request.url);
      if (url.host !== 'bundle') return new Response('Unknown host', { status: 404 });

      let pathname = decodeURIComponent(url.pathname);
      if (pathname.endsWith('/')) pathname += 'index.html';

      const resolved = resolveBundlePath(pathname);
      // Traversal guard: every served file must live inside a known root.
      const inRoot = [RENDERER_ROOT, SHARED_ROOT, ASSETS_ROOT]
        .some((root) => resolved.startsWith(root + path.sep));
      if (!inRoot) return new Response('Forbidden', { status: 403 });
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

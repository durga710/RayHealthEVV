// Vercel serverless entry. Loads the compiled @rayhealth/app once at module
// init and delegates each request to it. Any boot failure is caught and
// returned as a 500 with the real error message — beats silent FUNCTION_INVOCATION_FAILED.
//
// File is .js + ESM because root package.json has "type":"module". Importing
// the compiled dist directly (not via @rayhealth/app package name) so Vercel's
// ncc bundler walks the import graph reliably even without workspace symlinks.

let app;
let bootError = null;
try {
  const mod = await import('../packages/app/dist/app.js');
  app = mod.createApp();
} catch (err) {
  bootError = err;
  // Log to stdout so the line is visible in Vercel runtime logs.
  console.error('BOOT_FAILED', err && err.stack ? err.stack : String(err));
}

export default function handler(req, res) {
  if (bootError) {
    // Return a generic error to the (unauthenticated) client — the name,
    // message and stack are reconnaissance (file paths, dependency internals,
    // missing-env hints) and this path bypasses the app's hardened middleware.
    // The full detail was already logged to the runtime log above.
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error: 'BOOT_FAILED' }));
    return;
  }
  // Strip the /api prefix Vercel preserves so Express routes
  // (mounted at /auth, /clients, /evv, etc.) match.
  if (req.url && req.url.startsWith('/api/')) {
    req.url = req.url.slice(4) || '/';
  } else if (req.url === '/api') {
    req.url = '/';
  }
  return app(req, res);
}

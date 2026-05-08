// MINIMAL DIAGNOSTIC HANDLER — proves Vercel can invoke the function at all.
// If this returns 200 JSON in production, the runtime/bundler is fine and
// the issue is in the @rayhealth/app boot chain.
export default function handler(
  req: import('http').IncomingMessage,
  res: import('http').ServerResponse
) {
  res.statusCode = 200;
  res.setHeader('content-type', 'application/json');
  res.end(
    JSON.stringify({
      ok: true,
      url: req.url,
      method: req.method,
      hasJWT: Boolean(process.env.JWT_SECRET),
      hasDB: Boolean(process.env.DATABASE_URL),
      hasENC: Boolean(process.env.ENCRYPTION_KEY),
      node: process.version
    })
  );
}
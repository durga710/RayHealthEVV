// Direct relative import. Vercel's @vercel/node bundler does not follow
// workspace symlinks reliably, so importing via the package name resolves
// at build time but the resolved file is not bundled into the function.
// Pointing directly at the compiled JS forces ncc to walk the import graph.
import { createApp } from '../packages/app/dist/app.js';

const app = createApp();

export default app;
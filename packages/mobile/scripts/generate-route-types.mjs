import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appRoot = path.join(projectRoot, 'app');
const typesDirectory = path.join(projectRoot, '.expo', 'types');

process.env.EXPO_ROUTER_APP_ROOT = appRoot;
await mkdir(typesDirectory, { recursive: true });

const require = createRequire(import.meta.url);
const { regenerateDeclarations } = require('expo-router/build/typed-routes');

regenerateDeclarations(typesDirectory, {});

// Expo Router debounces declaration generation so rapid file-system events do
// not rewrite the file repeatedly. Wait for that write before invoking tsc.
await new Promise((resolve) => setTimeout(resolve, 500));

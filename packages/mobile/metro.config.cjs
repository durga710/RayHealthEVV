const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

// react@19.1.0 lives here — matches the renderer bundled in react-native@0.81.5
const LOCAL_REACT = path.resolve(projectRoot, 'node_modules/react');

// react-native-maps is native-only; on web it imports react-native internals
// that don't exist there and break `expo export`. Redirect it to a web shim
// for the web platform only (iOS/Android keep the real package).
const MAPS_WEB_SHIM = path.resolve(projectRoot, 'src/shims/react-native-maps.web.tsx');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Use resolveRequest to hard-redirect every 'react' import in the bundle to the
// local react@19.1.0 copy.  extraNodeModules is not applied consistently across
// all resolver paths, but resolveRequest always runs.
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react') {
    return { filePath: path.resolve(LOCAL_REACT, 'index.js'), type: 'sourceFile' };
  }
  if (moduleName === 'react/jsx-runtime') {
    return { filePath: path.resolve(LOCAL_REACT, 'jsx-runtime.js'), type: 'sourceFile' };
  }
  if (moduleName === 'react/jsx-dev-runtime') {
    return { filePath: path.resolve(LOCAL_REACT, 'jsx-dev-runtime.js'), type: 'sourceFile' };
  }
  if (moduleName === 'react-native-maps' && platform === 'web') {
    return { filePath: MAPS_WEB_SHIM, type: 'sourceFile' };
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;

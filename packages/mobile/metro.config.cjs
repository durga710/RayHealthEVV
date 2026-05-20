const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

// react@19.1.0 lives here — matches the renderer bundled in react-native@0.81.5
const LOCAL_REACT = path.resolve(projectRoot, 'node_modules/react');

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
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;

const path = require('path');

/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|axios)',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  moduleNameMapper: {
    '^react-test-renderer$': path.resolve(__dirname, 'node_modules/react-test-renderer'),
    '^react-test-renderer/(.*)$': path.resolve(__dirname, 'node_modules/react-test-renderer/$1'),
  },
};

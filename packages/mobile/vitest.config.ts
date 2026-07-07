import { defineConfig } from 'vitest/config';

// Mobile is an Expo/React-Native app; most screens can't run under node. We test
// only the PURE lib modules (no react-native imports). the EVV-critical
// geofence math and visit-state derivation. so the logic that decides clock-in
// eligibility and visit resume is covered without a native runtime.
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/lib/**/*.test.ts'],
  },
});

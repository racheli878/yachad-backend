import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./tests/globalSetup.ts'],
    setupFiles: ['./tests/setupEnv.ts'],
    // כל קבצי הבדיקה משתמשים באותו מסד נתונים לבדיקות, לכן הם רצים אחד אחרי השני
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 120000,
  },
});

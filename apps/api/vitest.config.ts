import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    exclude: process.argv.some(arg => arg.includes('booking.integration.test')) ? [] : ['**/*.integration.test.ts', '**/node_modules/**'],
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgres://ritmo:ritmo_local_dev@localhost:5432/ritmo_test',
      SESSION_SECRET: 'test_only_secure_dummy_secret_of_48_characters_123456789'
    }
  }
});

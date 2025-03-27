// wxt.config.ts
import { defineConfig } from 'wxt';
import baseConfig from './wxt.config.ephemeral';

export default defineConfig({
  ...baseConfig,
  dev: {
    server: {
      port: 3003,
    },
  },
  runner: {
    chromiumArgs: [
      '--user-data-dir=./.wxt/chrome-data',
      '--disable-extensions-http-throttling',
    ],
  },
});

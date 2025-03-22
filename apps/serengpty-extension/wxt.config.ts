// wxt.config.ts
import { defineConfig } from 'wxt';
import baseConfig from './wxt.config.ephemeral';

export default defineConfig({
  ...baseConfig,
  runner: {
    chromiumArgs: ['--user-data-dir=./.wxt/chrome-data'],
  },
});

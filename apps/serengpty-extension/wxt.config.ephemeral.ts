// wxt.config.ephemeral.ts
// This config can be also used for e2e tests that dont need to persist data
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { defineConfig } from 'wxt';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  srcDir: 'src',
  root: __dirname,
  outDir: '../../dist/apps/serengpty-extension',
  publicDir: 'src/assets',
  entrypointsDir: 'entrypoints',
  extensionApi: 'chrome',
  modules: ['@wxt-dev/module-react', '@wxt-dev/auto-icons'],

  manifest: {
    name: 'SerenGPTy: Find similar ChatGPT users',
    version: '1.0.1',
    permissions: ['storage', 'sidePanel', 'notifications'],
    action: {
      default_title: 'SerenGPTy',
    },
    host_permissions: ['https://serengpty.com/*'],
    ...(process.env.NODE_ENV === 'development'
      ? {}
      : {
          content_security_policy: {
            // Allows connections to:
            // - 'self' (extension's origin)
            // - Stream Chat servers (HTTPS and WSS)
            // - API server (https://serengpty.com)
            extension_pages: `script-src 'self' 'wasm-unsafe-eval'; object-src 'self'; connect-src 'self' https://*.stream-io-api.com wss://*.stream-io-api.com https://serengpty.com ;`,
          },
        }),
    author: { email: 'contact@serengpty.com' },
    homepage_url: 'https://serengpty.com',
  },
  dev: {
    server: {
      port: 3002,
    },
  },
  vite: () => ({
    root: __dirname,

    cacheDir: '../../node_modules/.vite/apps/serengpty-extension',
    plugins: [
      nxViteTsPaths(),
      visualizer({
        filename: '../../dist/apps/serengpty-extension/stats.html',
        gzipSize: true,
        brotliSize: true,
        sourcemap: true,
      }),
    ],

    server: {
      fs: {
        cachedChecks: false,
      },
    },

    build: {
      outDir: '../../dist/apps/serengpty-extension',
      emptyOutDir: true,
      reportCompressedSize: true,
      sourcemap: true,
      commonjsOptions: {
        transformMixedEsModules: true,
      },
    },
  }),
});

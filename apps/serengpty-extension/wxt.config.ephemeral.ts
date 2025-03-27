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
  modules: ['@wxt-dev/module-react'],

  manifest: {
    name: 'SerenGPTy',
    description: 'Find ChatGPT and Claude users who think like you',
    version: '1.0.0',
    permissions: ['activeTab', 'storage', 'sidePanel', 'tabs', 'notifications'],
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
      // nxCopyAssetsPlugin(['*.md']),
      visualizer({
        filename: '../../dist/apps/serengpty-extension/stats.html', // Output file name
        gzipSize: true, // Show gzip size
        brotliSize: true, // Show brotli size
        sourcemap: false, // Use source maps
      }),
    ],

    // Uncomment this if you are using workers.
    // worker: {
    //  plugins: [ nxViteTsPaths() ],
    // },
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

// wxt.config.ts
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  root: __dirname,
  outDir: '../../dist/apps/serengpty-extension',
  publicDir: 'src/assets',
  entrypointsDir: 'entrypoints',
  extensionApi: 'chrome',
  modules: ['@wxt-dev/module-react'],
  runner: {
    chromiumArgs: ['--user-data-dir=./.wxt/chrome-data'],
  },

  manifest: {
    name: 'Serengpty Extension',
    description: 'Serengpty Extension',
    version: '1.0.0',
    permissions: ['activeTab', 'storage', 'sidePanel', 'tabs', 'notifications'],
  },
  vite: () => ({
    root: __dirname,

    cacheDir: '../../node_modules/.vite/apps/serengpty-extension',
    plugins: [nxViteTsPaths(), nxCopyAssetsPlugin(['*.md'])],

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

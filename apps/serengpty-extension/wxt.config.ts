import { defineConfig } from 'wxt';
import react from '@vitejs/plugin-react';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';

// https://wxt.dev/api/config.html
export default defineConfig({
  manifest: {
    name: 'Serengpty',
    description: 'Serengpty Chrome Extension',
    version: '0.0.1',
    manifest_version: 3,
    action: {
      default_popup: 'src/popup.html',
    },
    permissions: [],
  },
  srcDir: 'src',
  entrypointsDir: 'entrypoints',
  outDir: '../../dist/apps/serengpty-extension',
  vite: () => ({
    cacheDir: '../../node_modules/.vite/apps/serengpty-extension',
    plugins: [react(), nxViteTsPaths(), nxCopyAssetsPlugin(['*.md'])],
    build: {
      reportCompressedSize: true,
      commonjsOptions: {
        transformMixedEsModules: true,
      },
    },
  }),
});

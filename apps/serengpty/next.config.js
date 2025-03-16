//@ts-check

const { composePlugins, withNx } = require('@nx/next');
const { withSentryConfig } = require('@sentry/nextjs');

/**
 * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
 **/
const nextConfig = {
  nx: {
    // Set this to true if you would like to use SVGR
    // See: https://github.com/gregberge/svgr
    svgr: false,
  },
  productionBrowserSourceMaps: true,
  webpack(config, { isServer }) {
    config.plugins.push(
      require('unplugin-icons/webpack').default({
        compiler: 'jsx',
        jsx: 'react',
        autoInstall: true,
      })
    );

    return config;
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

const plugins = [
  // Add more Next.js plugins to this list if needed.
  withNx,
];

const sentryWebpackPluginOptions = {
  org: 'enclaveid',
  project: 'javascript-nextjs',
  silent: !process.env.CI,
  widenClientFileUpload: true,
  reactComponentAnnotation: {
    enabled: true,
  },
  tunnelRoute: '/monitoring',
  disableLogger: true,
  automaticVercelMonitors: true,
};

module.exports = withSentryConfig(
  composePlugins(...plugins)(nextConfig),
  sentryWebpackPluginOptions
);
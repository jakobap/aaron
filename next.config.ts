import type { NextConfig } from "next";
import type { Configuration as WebpackConfig } from 'webpack';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import path from 'path';

const nextConfig: NextConfig = {
  // Enable webpack analyzer in production build
  webpack: (config: WebpackConfig, { isServer }: { isServer: boolean }): WebpackConfig => {
    // Add fallbacks for Node.js modules that are causing issues
    config.resolve = {
      ...config.resolve,
      fallback: {
        ...config.resolve?.fallback,
        fs: false,
        path: false,
        'require.extensions': false,
        '@opentelemetry/winston-transport': false,
        '@opentelemetry/exporter-jaeger': false
      }
    };

    // Ignore specific problematic packages in webpack processing
    config.ignoreWarnings = [
      { module: /handlebars/ },
      { module: /@opentelemetry/ }
    ];

    if (isServer) {
      config.plugins = config.plugins || [];
      config.plugins.push(
        new CopyWebpackPlugin({
          patterns: [
            {
              from: path.join(__dirname, 'node_modules/@genkit-ai/evaluator/prompts'),
              to: path.join(__dirname, '.next/prompts'),
              globOptions: {
                ignore: ['**/.*'],
              },
            },
          ],
        })
      );
    }

    return config;
  },
};

export default nextConfig;

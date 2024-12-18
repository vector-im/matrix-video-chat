/*
Copyright 2021-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only
Please see LICENSE in the repository root for full details.
*/

import { defineConfig, loadEnv } from "vite";
import { compression } from "vite-plugin-compression2";
import svgrPlugin from "vite-plugin-svgr";
import htmlTemplate from "vite-plugin-html-template";
import { codecovVitePlugin } from "@codecov/vite-plugin";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());

  const plugins = [
    react(),
    basicSsl(),
    svgrPlugin({
      svgrOptions: {
        // This enables ref forwarding on SVGR components, which is needed, for
        // example, to make tooltips on icons work
        ref: true,
      },
    }),
    // types workaround for https://github.com/IndexXuan/vite-plugin-html-template/issues/37
    (htmlTemplate as unknown as { default: typeof htmlTemplate }).default({
      data: {
        title: env.VITE_PRODUCT_NAME || "Element Call",
      },
    }),

    codecovVitePlugin({
      enableBundleAnalysis: process.env.CODECOV_TOKEN !== undefined,
      bundleName: "element-call",
      uploadToken: process.env.CODECOV_TOKEN,
    }),

    compression({
      exclude: [/config.json/],
    }),
  ];

  if (
    process.env.SENTRY_ORG &&
    process.env.SENTRY_PROJECT &&
    process.env.SENTRY_AUTH_TOKEN &&
    process.env.SENTRY_URL
  ) {
    plugins.push(
      sentryVitePlugin({
        release: {
          name: process.env.VITE_APP_VERSION,
        },
      }),
    );
  }

  return {
    server: {
      port: 3000,
    },
    build: {
      sourcemap: true,
      rollupOptions: {
        output: {
          assetFileNames: ({ originalFileNames }): string => {
            if (originalFileNames) {
              for (const name of originalFileNames) {
                // Custom asset name for locales to include the locale code in the filename
                const match = name.match(/locales\/([^/]+)\/(.+)\.json$/);
                if (match) {
                  const [, locale, filename] = match;
                  return `assets/${locale}-${filename}-[hash].json`;
                }
              }
            }

            // Default naming fallback
            return "assets/[name]-[hash][extname]";
          },
          manualChunks: {
            // we should be able to remove this one https://github.com/matrix-org/matrix-rust-sdk-crypto-wasm/pull/167 lands
            "matrix-sdk-crypto-wasm": ["@matrix-org/matrix-sdk-crypto-wasm"],
          },
        },
      },
    },
    plugins,
    resolve: {
      alias: {
        // matrix-widget-api has its transpiled lib/index.js as its entry point,
        // which Vite for some reason refuses to work with, so we point it to
        // src/index.ts instead
        "matrix-widget-api": "matrix-widget-api/src/index.ts",
      },
      dedupe: [
        "react",
        "react-dom",
        "matrix-js-sdk",
        "react-use-measure",
        // These packages modify the document based on some module-level global
        // state, and don't play nicely with duplicate copies of themselves
        // https://github.com/radix-ui/primitives/issues/1241#issuecomment-1847837850
        "@radix-ui/react-focus-guards",
        "@radix-ui/react-dismissable-layer",
      ],
    },
  };
});

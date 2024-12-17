// vitest.config.js
import {
  defineConfig as defineConfig2,
  mergeConfig,
} from "file:///home/will/git/element-call/node_modules/vitest/dist/config.js";

// vite.config.js
import {
  defineConfig,
  loadEnv,
} from "file:///home/will/git/element-call/node_modules/vite/dist/node/index.js";
import { compression } from "file:///home/will/git/element-call/node_modules/vite-plugin-compression2/dist/index.mjs";
import svgrPlugin from "file:///home/will/git/element-call/node_modules/vite-plugin-svgr/dist/index.js";
import htmlTemplate from "file:///home/will/git/element-call/node_modules/vite-plugin-html-template/dist/index.js";
import { codecovVitePlugin } from "file:///home/will/git/element-call/node_modules/@codecov/vite-plugin/dist/index.mjs";
import { sentryVitePlugin } from "file:///home/will/git/element-call/node_modules/@sentry/vite-plugin/dist/esm/index.mjs";
import react from "file:///home/will/git/element-call/node_modules/@vitejs/plugin-react/dist/index.mjs";
import basicSsl from "file:///home/will/git/element-call/node_modules/@vitejs/plugin-basic-ssl/dist/index.mjs";
var vite_config_default = defineConfig(({ mode }) => {
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
    htmlTemplate.default({
      data: {
        title: env.VITE_PRODUCT_NAME || "Element Call",
      },
    }),
    codecovVitePlugin({
      enableBundleAnalysis: process.env.CODECOV_TOKEN !== void 0,
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
        include: "./dist",
        release: process.env.VITE_APP_VERSION,
      }),
    );
  }
  return {
    server: {
      port: 3e3,
    },
    build: {
      sourcemap: true,
      rollupOptions: {
        output: {
          assetFileNames: ({ originalFileNames }) => {
            if (originalFileNames) {
              for (const name of originalFileNames) {
                const match = name.match(/locales\/([^/]+)\/(.+)\.json$/);
                if (match) {
                  const [, locale, filename] = match;
                  return `assets/${locale}-${filename}-[hash].json`;
                }
              }
            }
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

// vitest.config.js
var vitest_config_default = defineConfig2((configEnv) =>
  mergeConfig(
    vite_config_default(configEnv),
    defineConfig2({
      test: {
        environment: "jsdom",
        css: {
          modules: {
            classNameStrategy: "non-scoped",
          },
        },
        setupFiles: ["src/vitest.setup.ts"],
        coverage: {
          reporter: ["html", "json"],
          include: ["src/"],
          exclude: ["src/**/*.{d,test}.{ts,tsx}", "src/utils/test.ts"],
        },
      },
    }),
  ),
);
export { vitest_config_default as default };
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZXN0LmNvbmZpZy5qcyIsICJ2aXRlLmNvbmZpZy5qcyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIi9ob21lL3dpbGwvZ2l0L2VsZW1lbnQtY2FsbFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL2hvbWUvd2lsbC9naXQvZWxlbWVudC1jYWxsL3ZpdGVzdC5jb25maWcuanNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL2hvbWUvd2lsbC9naXQvZWxlbWVudC1jYWxsL3ZpdGVzdC5jb25maWcuanNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcsIG1lcmdlQ29uZmlnIH0gZnJvbSBcInZpdGVzdC9jb25maWdcIjtcbmltcG9ydCB2aXRlQ29uZmlnIGZyb20gXCIuL3ZpdGUuY29uZmlnLmpzXCI7XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZygoY29uZmlnRW52KSA9PlxuICBtZXJnZUNvbmZpZyhcbiAgICB2aXRlQ29uZmlnKGNvbmZpZ0VudiksXG4gICAgZGVmaW5lQ29uZmlnKHtcbiAgICAgIHRlc3Q6IHtcbiAgICAgICAgZW52aXJvbm1lbnQ6IFwianNkb21cIixcbiAgICAgICAgY3NzOiB7XG4gICAgICAgICAgbW9kdWxlczoge1xuICAgICAgICAgICAgY2xhc3NOYW1lU3RyYXRlZ3k6IFwibm9uLXNjb3BlZFwiLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIHNldHVwRmlsZXM6IFtcInNyYy92aXRlc3Quc2V0dXAudHNcIl0sXG4gICAgICAgIGNvdmVyYWdlOiB7XG4gICAgICAgICAgcmVwb3J0ZXI6IFtcImh0bWxcIiwgXCJqc29uXCJdLFxuICAgICAgICAgIGluY2x1ZGU6IFtcInNyYy9cIl0sXG4gICAgICAgICAgZXhjbHVkZTogW1wic3JjLyoqLyoue2QsdGVzdH0ue3RzLHRzeH1cIiwgXCJzcmMvdXRpbHMvdGVzdC50c1wiXSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSksXG4gICksXG4pO1xuIiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS93aWxsL2dpdC9lbGVtZW50LWNhbGxcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9ob21lL3dpbGwvZ2l0L2VsZW1lbnQtY2FsbC92aXRlLmNvbmZpZy5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vaG9tZS93aWxsL2dpdC9lbGVtZW50LWNhbGwvdml0ZS5jb25maWcuanNcIjsvKlxuQ29weXJpZ2h0IDIwMjEtMjAyNCBOZXcgVmVjdG9yIEx0ZC5cblxuU1BEWC1MaWNlbnNlLUlkZW50aWZpZXI6IEFHUEwtMy4wLW9ubHlcblBsZWFzZSBzZWUgTElDRU5TRSBpbiB0aGUgcmVwb3NpdG9yeSByb290IGZvciBmdWxsIGRldGFpbHMuXG4qL1xuXG5pbXBvcnQgeyBkZWZpbmVDb25maWcsIGxvYWRFbnYgfSBmcm9tIFwidml0ZVwiO1xuaW1wb3J0IHsgY29tcHJlc3Npb24gfSBmcm9tIFwidml0ZS1wbHVnaW4tY29tcHJlc3Npb24yXCI7XG5pbXBvcnQgc3ZnclBsdWdpbiBmcm9tIFwidml0ZS1wbHVnaW4tc3ZnclwiO1xuaW1wb3J0IGh0bWxUZW1wbGF0ZSBmcm9tIFwidml0ZS1wbHVnaW4taHRtbC10ZW1wbGF0ZVwiO1xuaW1wb3J0IHsgY29kZWNvdlZpdGVQbHVnaW4gfSBmcm9tIFwiQGNvZGVjb3Yvdml0ZS1wbHVnaW5cIjtcbmltcG9ydCB7IHNlbnRyeVZpdGVQbHVnaW4gfSBmcm9tIFwiQHNlbnRyeS92aXRlLXBsdWdpblwiO1xuaW1wb3J0IHJlYWN0IGZyb20gXCJAdml0ZWpzL3BsdWdpbi1yZWFjdFwiO1xuaW1wb3J0IGJhc2ljU3NsIGZyb20gXCJAdml0ZWpzL3BsdWdpbi1iYXNpYy1zc2xcIjtcblxuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZy9cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZygoeyBtb2RlIH0pID0+IHtcbiAgY29uc3QgZW52ID0gbG9hZEVudihtb2RlLCBwcm9jZXNzLmN3ZCgpKTtcblxuICBjb25zdCBwbHVnaW5zID0gW1xuICAgIHJlYWN0KCksXG4gICAgYmFzaWNTc2woKSxcbiAgICBzdmdyUGx1Z2luKHtcbiAgICAgIHN2Z3JPcHRpb25zOiB7XG4gICAgICAgIC8vIFRoaXMgZW5hYmxlcyByZWYgZm9yd2FyZGluZyBvbiBTVkdSIGNvbXBvbmVudHMsIHdoaWNoIGlzIG5lZWRlZCwgZm9yXG4gICAgICAgIC8vIGV4YW1wbGUsIHRvIG1ha2UgdG9vbHRpcHMgb24gaWNvbnMgd29ya1xuICAgICAgICByZWY6IHRydWUsXG4gICAgICB9LFxuICAgIH0pLFxuICAgIGh0bWxUZW1wbGF0ZS5kZWZhdWx0KHtcbiAgICAgIGRhdGE6IHtcbiAgICAgICAgdGl0bGU6IGVudi5WSVRFX1BST0RVQ1RfTkFNRSB8fCBcIkVsZW1lbnQgQ2FsbFwiLFxuICAgICAgfSxcbiAgICB9KSxcblxuICAgIGNvZGVjb3ZWaXRlUGx1Z2luKHtcbiAgICAgIGVuYWJsZUJ1bmRsZUFuYWx5c2lzOiBwcm9jZXNzLmVudi5DT0RFQ09WX1RPS0VOICE9PSB1bmRlZmluZWQsXG4gICAgICBidW5kbGVOYW1lOiBcImVsZW1lbnQtY2FsbFwiLFxuICAgICAgdXBsb2FkVG9rZW46IHByb2Nlc3MuZW52LkNPREVDT1ZfVE9LRU4sXG4gICAgfSksXG5cbiAgICBjb21wcmVzc2lvbih7XG4gICAgICBleGNsdWRlOiBbL2NvbmZpZy5qc29uL10sXG4gICAgfSksXG4gIF07XG5cbiAgaWYgKFxuICAgIHByb2Nlc3MuZW52LlNFTlRSWV9PUkcgJiZcbiAgICBwcm9jZXNzLmVudi5TRU5UUllfUFJPSkVDVCAmJlxuICAgIHByb2Nlc3MuZW52LlNFTlRSWV9BVVRIX1RPS0VOICYmXG4gICAgcHJvY2Vzcy5lbnYuU0VOVFJZX1VSTFxuICApIHtcbiAgICBwbHVnaW5zLnB1c2goXG4gICAgICBzZW50cnlWaXRlUGx1Z2luKHtcbiAgICAgICAgaW5jbHVkZTogXCIuL2Rpc3RcIixcbiAgICAgICAgcmVsZWFzZTogcHJvY2Vzcy5lbnYuVklURV9BUFBfVkVSU0lPTixcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICByZXR1cm4ge1xuICAgIHNlcnZlcjoge1xuICAgICAgcG9ydDogMzAwMCxcbiAgICB9LFxuICAgIGJ1aWxkOiB7XG4gICAgICBzb3VyY2VtYXA6IHRydWUsXG4gICAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICAgIG91dHB1dDoge1xuICAgICAgICAgIGFzc2V0RmlsZU5hbWVzOiAoeyBvcmlnaW5hbEZpbGVOYW1lcyB9KSA9PiB7XG4gICAgICAgICAgICBpZiAob3JpZ2luYWxGaWxlTmFtZXMpIHtcbiAgICAgICAgICAgICAgZm9yIChjb25zdCBuYW1lIG9mIG9yaWdpbmFsRmlsZU5hbWVzKSB7XG4gICAgICAgICAgICAgICAgLy8gQ3VzdG9tIGFzc2V0IG5hbWUgZm9yIGxvY2FsZXMgdG8gaW5jbHVkZSB0aGUgbG9jYWxlIGNvZGUgaW4gdGhlIGZpbGVuYW1lXG4gICAgICAgICAgICAgICAgY29uc3QgbWF0Y2ggPSBuYW1lLm1hdGNoKC9sb2NhbGVzXFwvKFteL10rKVxcLyguKylcXC5qc29uJC8pO1xuICAgICAgICAgICAgICAgIGlmIChtYXRjaCkge1xuICAgICAgICAgICAgICAgICAgY29uc3QgWywgbG9jYWxlLCBmaWxlbmFtZV0gPSBtYXRjaDtcbiAgICAgICAgICAgICAgICAgIHJldHVybiBgYXNzZXRzLyR7bG9jYWxlfS0ke2ZpbGVuYW1lfS1baGFzaF0uanNvbmA7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIERlZmF1bHQgbmFtaW5nIGZhbGxiYWNrXG4gICAgICAgICAgICByZXR1cm4gXCJhc3NldHMvW25hbWVdLVtoYXNoXVtleHRuYW1lXVwiO1xuICAgICAgICAgIH0sXG4gICAgICAgICAgbWFudWFsQ2h1bmtzOiB7XG4gICAgICAgICAgICAvLyB3ZSBzaG91bGQgYmUgYWJsZSB0byByZW1vdmUgdGhpcyBvbmUgaHR0cHM6Ly9naXRodWIuY29tL21hdHJpeC1vcmcvbWF0cml4LXJ1c3Qtc2RrLWNyeXB0by13YXNtL3B1bGwvMTY3IGxhbmRzXG4gICAgICAgICAgICBcIm1hdHJpeC1zZGstY3J5cHRvLXdhc21cIjogW1wiQG1hdHJpeC1vcmcvbWF0cml4LXNkay1jcnlwdG8td2FzbVwiXSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9LFxuICAgIHBsdWdpbnMsXG4gICAgcmVzb2x2ZToge1xuICAgICAgYWxpYXM6IHtcbiAgICAgICAgLy8gbWF0cml4LXdpZGdldC1hcGkgaGFzIGl0cyB0cmFuc3BpbGVkIGxpYi9pbmRleC5qcyBhcyBpdHMgZW50cnkgcG9pbnQsXG4gICAgICAgIC8vIHdoaWNoIFZpdGUgZm9yIHNvbWUgcmVhc29uIHJlZnVzZXMgdG8gd29yayB3aXRoLCBzbyB3ZSBwb2ludCBpdCB0b1xuICAgICAgICAvLyBzcmMvaW5kZXgudHMgaW5zdGVhZFxuICAgICAgICBcIm1hdHJpeC13aWRnZXQtYXBpXCI6IFwibWF0cml4LXdpZGdldC1hcGkvc3JjL2luZGV4LnRzXCIsXG4gICAgICB9LFxuICAgICAgZGVkdXBlOiBbXG4gICAgICAgIFwicmVhY3RcIixcbiAgICAgICAgXCJyZWFjdC1kb21cIixcbiAgICAgICAgXCJtYXRyaXgtanMtc2RrXCIsXG4gICAgICAgIFwicmVhY3QtdXNlLW1lYXN1cmVcIixcbiAgICAgICAgLy8gVGhlc2UgcGFja2FnZXMgbW9kaWZ5IHRoZSBkb2N1bWVudCBiYXNlZCBvbiBzb21lIG1vZHVsZS1sZXZlbCBnbG9iYWxcbiAgICAgICAgLy8gc3RhdGUsIGFuZCBkb24ndCBwbGF5IG5pY2VseSB3aXRoIGR1cGxpY2F0ZSBjb3BpZXMgb2YgdGhlbXNlbHZlc1xuICAgICAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vcmFkaXgtdWkvcHJpbWl0aXZlcy9pc3N1ZXMvMTI0MSNpc3N1ZWNvbW1lbnQtMTg0NzgzNzg1MFxuICAgICAgICBcIkByYWRpeC11aS9yZWFjdC1mb2N1cy1ndWFyZHNcIixcbiAgICAgICAgXCJAcmFkaXgtdWkvcmVhY3QtZGlzbWlzc2FibGUtbGF5ZXJcIixcbiAgICAgIF0sXG4gICAgfSxcbiAgfTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUF1USxTQUFTLGdCQUFBQSxlQUFjLG1CQUFtQjs7O0FDT2pULFNBQVMsY0FBYyxlQUFlO0FBQ3RDLFNBQVMsbUJBQW1CO0FBQzVCLE9BQU8sZ0JBQWdCO0FBQ3ZCLE9BQU8sa0JBQWtCO0FBQ3pCLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsd0JBQXdCO0FBQ2pDLE9BQU8sV0FBVztBQUNsQixPQUFPLGNBQWM7QUFHckIsSUFBTyxzQkFBUSxhQUFhLENBQUMsRUFBRSxLQUFLLE1BQU07QUFDeEMsUUFBTSxNQUFNLFFBQVEsTUFBTSxRQUFRLElBQUksQ0FBQztBQUV2QyxRQUFNLFVBQVU7QUFBQSxJQUNkLE1BQU07QUFBQSxJQUNOLFNBQVM7QUFBQSxJQUNULFdBQVc7QUFBQSxNQUNULGFBQWE7QUFBQTtBQUFBO0FBQUEsUUFHWCxLQUFLO0FBQUEsTUFDUDtBQUFBLElBQ0YsQ0FBQztBQUFBLElBQ0QsYUFBYSxRQUFRO0FBQUEsTUFDbkIsTUFBTTtBQUFBLFFBQ0osT0FBTyxJQUFJLHFCQUFxQjtBQUFBLE1BQ2xDO0FBQUEsSUFDRixDQUFDO0FBQUEsSUFFRCxrQkFBa0I7QUFBQSxNQUNoQixzQkFBc0IsUUFBUSxJQUFJLGtCQUFrQjtBQUFBLE1BQ3BELFlBQVk7QUFBQSxNQUNaLGFBQWEsUUFBUSxJQUFJO0FBQUEsSUFDM0IsQ0FBQztBQUFBLElBRUQsWUFBWTtBQUFBLE1BQ1YsU0FBUyxDQUFDLGFBQWE7QUFBQSxJQUN6QixDQUFDO0FBQUEsRUFDSDtBQUVBLE1BQ0UsUUFBUSxJQUFJLGNBQ1osUUFBUSxJQUFJLGtCQUNaLFFBQVEsSUFBSSxxQkFDWixRQUFRLElBQUksWUFDWjtBQUNBLFlBQVE7QUFBQSxNQUNOLGlCQUFpQjtBQUFBLFFBQ2YsU0FBUztBQUFBLFFBQ1QsU0FBUyxRQUFRLElBQUk7QUFBQSxNQUN2QixDQUFDO0FBQUEsSUFDSDtBQUFBLEVBQ0Y7QUFFQSxTQUFPO0FBQUEsSUFDTCxRQUFRO0FBQUEsTUFDTixNQUFNO0FBQUEsSUFDUjtBQUFBLElBQ0EsT0FBTztBQUFBLE1BQ0wsV0FBVztBQUFBLE1BQ1gsZUFBZTtBQUFBLFFBQ2IsUUFBUTtBQUFBLFVBQ04sZ0JBQWdCLENBQUMsRUFBRSxrQkFBa0IsTUFBTTtBQUN6QyxnQkFBSSxtQkFBbUI7QUFDckIseUJBQVcsUUFBUSxtQkFBbUI7QUFFcEMsc0JBQU0sUUFBUSxLQUFLLE1BQU0sK0JBQStCO0FBQ3hELG9CQUFJLE9BQU87QUFDVCx3QkFBTSxDQUFDLEVBQUUsUUFBUSxRQUFRLElBQUk7QUFDN0IseUJBQU8sVUFBVSxNQUFNLElBQUksUUFBUTtBQUFBLGdCQUNyQztBQUFBLGNBQ0Y7QUFBQSxZQUNGO0FBR0EsbUJBQU87QUFBQSxVQUNUO0FBQUEsVUFDQSxjQUFjO0FBQUE7QUFBQSxZQUVaLDBCQUEwQixDQUFDLG9DQUFvQztBQUFBLFVBQ2pFO0FBQUEsUUFDRjtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQUEsSUFDQTtBQUFBLElBQ0EsU0FBUztBQUFBLE1BQ1AsT0FBTztBQUFBO0FBQUE7QUFBQTtBQUFBLFFBSUwscUJBQXFCO0FBQUEsTUFDdkI7QUFBQSxNQUNBLFFBQVE7QUFBQSxRQUNOO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUE7QUFBQTtBQUFBO0FBQUEsUUFJQTtBQUFBLFFBQ0E7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFDRixDQUFDOzs7QUQ3R0QsSUFBTyx3QkFBUUM7QUFBQSxFQUFhLENBQUMsY0FDM0I7QUFBQSxJQUNFLG9CQUFXLFNBQVM7QUFBQSxJQUNwQkEsY0FBYTtBQUFBLE1BQ1gsTUFBTTtBQUFBLFFBQ0osYUFBYTtBQUFBLFFBQ2IsS0FBSztBQUFBLFVBQ0gsU0FBUztBQUFBLFlBQ1AsbUJBQW1CO0FBQUEsVUFDckI7QUFBQSxRQUNGO0FBQUEsUUFDQSxZQUFZLENBQUMscUJBQXFCO0FBQUEsUUFDbEMsVUFBVTtBQUFBLFVBQ1IsVUFBVSxDQUFDLFFBQVEsTUFBTTtBQUFBLFVBQ3pCLFNBQVMsQ0FBQyxNQUFNO0FBQUEsVUFDaEIsU0FBUyxDQUFDLDhCQUE4QixtQkFBbUI7QUFBQSxRQUM3RDtBQUFBLE1BQ0Y7QUFBQSxJQUNGLENBQUM7QUFBQSxFQUNIO0FBQ0Y7IiwKICAibmFtZXMiOiBbImRlZmluZUNvbmZpZyIsICJkZWZpbmVDb25maWciXQp9Cg==

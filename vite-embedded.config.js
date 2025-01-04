import { defineConfig, mergeConfig } from "vite";
import standaloneConfig from "./vite.config";

// Config for embedded deployments (possibly hosted under a non-root path)
export default defineConfig((env) =>
  mergeConfig(standaloneConfig(env), {
    base: "", // Use relative URLs to allow the app to be hosted under any path
  }),
);
